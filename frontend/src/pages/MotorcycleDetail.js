import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { 
  ArrowLeft, 
  Bike, 
  Calendar,
  Gauge,
  Palette,
  CheckCircle,
  ShoppingCart,
  Clock,
  Gavel,
  TrendingUp,
  Zap,
  Truck,
  CreditCard,
  Gift,
  Tag,
  Store
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MotorcycleDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [motorcycle, setMotorcycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [buyNowDialogOpen, setBuyNowDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [needsDelivery, setNeedsDelivery] = useState(false);
  const [needsInspection, setNeedsInspection] = useState(false);
  const [needsValuation, setNeedsValuation] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherValid, setVoucherValid] = useState(false);
  const [checkingVoucher, setCheckingVoucher] = useState(false);
  const [myVoucher, setMyVoucher] = useState(null);

  useEffect(() => {
    fetchMotorcycle();
    fetchMyVoucher();
  }, [id]);

  useEffect(() => {
    if (motorcycle?.auction_end_time) {
      const timer = setInterval(() => {
        const end = new Date(motorcycle.auction_end_time);
        const now = new Date();
        const diff = end - now;
        
        if (diff <= 0) {
          setTimeLeft({ expired: true });
          clearInterval(timer);
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeLeft({ hours, minutes, seconds, expired: false });
        }
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [motorcycle?.auction_end_time]);

  const fetchMotorcycle = async () => {
    try {
      const response = await axios.get(`${API}/motorcycles/${id}`);
      setMotorcycle(response.data);
      // Set minimum bid amount
      const minBid = response.data.highest_bid 
        ? response.data.highest_bid + 100 
        : response.data.starting_price || response.data.price * 0.8;
      setBidAmount(Math.ceil(minBid));
    } catch (error) {
      toast.error('Kon motor niet laden');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const fetchBids = async () => {
    try {
      const response = await axios.get(`${API}/bids/${id}`);
      setBids(response.data);
    } catch (error) {
      console.error('Failed to fetch bids:', error);
    }
  };

  const fetchMyVoucher = async () => {
    try {
      const response = await axios.get(`${API}/voucher/my-voucher`);
      if (response.data.has_voucher && !response.data.is_used) {
        setMyVoucher(response.data);
        setVoucherCode(response.data.code);
        setVoucherDiscount(response.data.amount);
        setVoucherValid(true);
      }
    } catch (error) {
      console.error('Failed to fetch voucher:', error);
    }
  };

  const checkVoucher = async () => {
    if (!voucherCode.trim()) return;
    
    setCheckingVoucher(true);
    try {
      const response = await axios.get(`${API}/voucher/check/${voucherCode}`);
      setVoucherDiscount(response.data.amount);
      setVoucherValid(true);
      toast.success(`Voucher geldig! €${response.data.amount} korting wordt toegepast.`);
    } catch (error) {
      setVoucherDiscount(0);
      setVoucherValid(false);
      toast.error(error.response?.data?.detail || 'Ongeldige voucher');
    } finally {
      setCheckingVoucher(false);
    }
  };

  const calculatePayment = async (delivery = needsDelivery) => {
    try {
      const response = await axios.get(`${API}/payments/calculate?motorcycle_id=${id}&needs_delivery=${delivery}`);
      setPaymentInfo(response.data);
    } catch (error) {
      console.error('Failed to calculate payment:', error);
    }
  };

  const handleDeliveryChange = (checked) => {
    setNeedsDelivery(checked);
    calculatePayment(checked);
  };

  const handleBid = async () => {
    setSubmitting(true);
    try {
      await axios.post(`${API}/bids`, {
        motorcycle_id: id,
        amount: parseFloat(bidAmount)
      });
      toast.success(t('bid.bidSuccess'));
      setBidDialogOpen(false);
      fetchMotorcycle();
      fetchBids();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('messages.errorOccurred'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBuyNow = async () => {
    setSubmitting(true);
    try {
      const response = await axios.post(`${API}/orders/buy-now`, {
        motorcycle_id: id,
        needs_delivery: needsDelivery,
        needs_inspection: needsInspection,
        needs_valuation: needsValuation,
        voucher_code: voucherValid ? voucherCode : null
      });
      
      const discountMsg = voucherValid ? ` (${t('order.welcomeDiscount')}: €${voucherDiscount})` : '';
      toast.success(t('detail.orderPlaced') + discountMsg);
      setBuyNowDialogOpen(false);
      
      // Redirect to pakbon page with auto-print
      const orderId = response.data.order_id;
      setTimeout(() => {
        window.location.href = `/pakbon/${orderId}?print=true`;
      }, 1500);
    } catch (error) {
      toast.error(error.response?.data?.detail || t('messages.errorOccurred'));
    } finally {
      setSubmitting(false);
    }
  };

  const getTotalPrice = () => {
    if (!motorcycle) return 0;
    const basePrice = motorcycle.price + 
      (needsDelivery ? 50 : 0) + 
      (needsInspection ? 125 : 0) + 
      (needsValuation ? 160 : 0);
    return Math.max(0, basePrice - (voucherValid ? voucherDiscount : 0));
  };

  const getConditionBadge = (condition) => {
    const styles = {
      new: 'bg-emerald-100 text-emerald-800',
      excellent: 'bg-blue-100 text-blue-800',
      good: 'bg-amber-100 text-amber-800',
      fair: 'bg-zinc-100 text-zinc-800'
    };
    const labels = {
      new: t('motorcycle.new'),
      excellent: t('motorcycle.excellent'),
      good: t('motorcycle.good'),
      fair: t('motorcycle.fair')
    };
    return <Badge className={`${styles[condition]} text-sm px-3 py-1`}>{labels[condition]}</Badge>;
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0
    }).format(price);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  if (!motorcycle) {
    return null;
  }

  const images = motorcycle.images?.length > 0 ? motorcycle.images : [];
  const currentBid = motorcycle.highest_bid || motorcycle.starting_price;
  const minNextBid = motorcycle.highest_bid ? motorcycle.highest_bid + 100 : motorcycle.starting_price;
  const auctionActive = motorcycle.is_available && timeLeft && !timeLeft.expired;

  return (
    <Layout>
      <div className="content-header">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate(-1)}
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              {motorcycle.brand} {motorcycle.model}
            </h1>
            <p className="text-zinc-500 mt-1">{motorcycle.year} • {motorcycle.color}</p>
          </div>
        </div>
      </div>

      <div className="content-body" data-testid="motorcycle-detail">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Image Gallery */}
          <div className="lg:col-span-8">
            <Card className="overflow-hidden">
              <div className="aspect-[16/10] bg-zinc-100 relative">
                {images.length > 0 ? (
                  <img 
                    src={images[selectedImage]} 
                    alt={`${motorcycle.brand} ${motorcycle.model}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Bike className="w-32 h-32 text-zinc-300" />
                  </div>
                )}
                {!motorcycle.is_available && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Badge className="bg-red-600 text-white text-lg px-4 py-2">{t('motorcycle.sold')}</Badge>
                  </div>
                )}
                {/* Timer Badge */}
                {auctionActive && (
                  <div className="absolute top-4 right-4 bg-black/80 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                    <Clock className="w-5 h-5 text-red-500" />
                    <span className="font-barlow font-bold">
                      {timeLeft.hours}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <div className="p-4 flex gap-2 overflow-x-auto">
                  {images.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImage === index ? 'border-red-600' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      data-testid={`thumbnail-${index}`}
                    >
                      <img src={img} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Bids History */}
            {bids.length > 0 && (
              <Card className="mt-6">
                <CardContent className="p-6">
                  <h3 className="font-barlow text-lg font-bold uppercase tracking-tight text-zinc-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-red-600" />
                    {t('motorcycle.bids')} ({bids.length})
                  </h3>
                  <div className="space-y-3">
                    {bids.slice(0, 5).map((bid, index) => (
                      <div key={bid.id} className={`flex items-center justify-between p-3 rounded-lg ${index === 0 ? 'bg-red-50 border border-red-200' : 'bg-zinc-50'}`}>
                        <div className="flex items-center gap-3">
                          {index === 0 && <Badge className="bg-red-600 text-white">{t('motorcycle.highestBid')}</Badge>}
                          <span className="text-zinc-600">{bid.dealer_company}</span>
                        </div>
                        <span className={`font-barlow font-bold ${index === 0 ? 'text-red-600 text-xl' : 'text-zinc-700'}`}>
                          {formatPrice(bid.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Description */}
            {motorcycle.description && (
              <Card className="mt-6">
                <CardContent className="p-6">
                  <h3 className="font-barlow text-lg font-bold uppercase tracking-tight text-zinc-900 mb-4">
                    {t('motorcycle.description')}
                  </h3>
                  <p className="text-zinc-600 whitespace-pre-wrap">{motorcycle.description}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Specs & Actions */}
          <div className="lg:col-span-4 space-y-6">
            {/* Auction Card */}
            <Card className="border-2 border-red-200 bg-red-50/30">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  {getConditionBadge(motorcycle.condition)}
                  {motorcycle.is_available ? (
                    timeLeft?.expired ? (
                      <Badge className="bg-zinc-500 text-white">{t('motorcycle.auctionEnded')}</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800">{t('motorcycle.active')}</Badge>
                    )
                  ) : (
                    <Badge className="bg-red-100 text-red-800">{t('motorcycle.sold')}</Badge>
                  )}
                </div>

                {/* Current Bid */}
                <div className="mb-4 p-4 bg-white rounded-lg border border-red-200">
                  <p className="font-barlow uppercase tracking-wider text-xs text-zinc-500 mb-1">
                    {motorcycle.highest_bid ? t('motorcycle.currentBidLabel') : t('motorcycle.fromPrice')}
                  </p>
                  <p className="font-barlow text-4xl font-bold text-red-600">
                    {formatPrice(currentBid)}
                  </p>
                  {motorcycle.highest_bid && (
                    <p className="text-sm text-zinc-500 mt-1">
                      {bids.length} {t('motorcycle.bids')}
                    </p>
                  )}
                </div>

                {/* Buy Now Price */}
                <div className="mb-6 p-4 bg-zinc-900 rounded-lg text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <p className="font-barlow uppercase tracking-wider text-xs text-zinc-400">
                      {t('motorcycle.buyNow')}
                    </p>
                  </div>
                  <p className="font-barlow text-3xl font-bold">
                    {formatPrice(motorcycle.price)}
                  </p>
                </div>

                {user?.role === 'dealer' && motorcycle.is_available && (
                  <div className="space-y-3">
                    {/* Warning for dealer listings - buyer fee */}
                    {motorcycle.is_dealer_listing && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-amber-800 text-sm font-medium flex items-center gap-2">
                          <Tag className="w-4 h-4" />
                          {t('motorcycle.buyerFeeWarning')}
                        </p>
                      </div>
                    )}
                    
                    {!timeLeft?.expired && (
                      <Button 
                        className="w-full h-12 bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide"
                        onClick={() => setBidDialogOpen(true)}
                        disabled={motorcycle.highest_bidder_id === user?.id}
                        data-testid="bid-btn"
                      >
                        <Gavel className="w-5 h-5 mr-2" />
                        {motorcycle.highest_bidder_id === user?.id 
                          ? t('bid.alreadyHighestBidder')
                          : t('bid.placeBid')}
                      </Button>
                    )}
                    <Button 
                      className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 font-barlow uppercase tracking-wide"
                      onClick={() => {
                        setNeedsDelivery(false);
                        setBuyNowDialogOpen(true);
                      }}
                      data-testid="buy-now-btn"
                    >
                      <ShoppingCart className="w-5 h-5 mr-2" />
                      {t('motorcycle.buyNow')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Specs Card */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-barlow text-lg font-bold uppercase tracking-tight text-zinc-900 mb-4">
                  {t('motorcycle.specifications')}
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 bg-zinc-50 rounded-lg">
                    <div className="w-10 h-10 bg-zinc-200 rounded-lg flex items-center justify-center">
                      <Bike className="w-5 h-5 text-zinc-600" />
                    </div>
                    <div>
                      <p className="font-barlow uppercase tracking-wider text-xs text-zinc-500">{t('motorcycle.brandModel')}</p>
                      <p className="font-semibold text-zinc-900">{motorcycle.brand} {motorcycle.model}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 bg-zinc-50 rounded-lg">
                    <div className="w-10 h-10 bg-zinc-200 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-zinc-600" />
                    </div>
                    <div>
                      <p className="font-barlow uppercase tracking-wider text-xs text-zinc-500">{t('motorcycle.year')}</p>
                      <p className="font-semibold text-zinc-900">{motorcycle.year}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 bg-zinc-50 rounded-lg">
                    <div className="w-10 h-10 bg-zinc-200 rounded-lg flex items-center justify-center">
                      <Gauge className="w-5 h-5 text-zinc-600" />
                    </div>
                    <div>
                      <p className="font-barlow uppercase tracking-wider text-xs text-zinc-500">{t('motorcycle.mileage')}</p>
                      <p className="font-semibold text-zinc-900">{motorcycle.mileage.toLocaleString('nl-NL')} km</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 bg-zinc-50 rounded-lg">
                    <div className="w-10 h-10 bg-zinc-200 rounded-lg flex items-center justify-center">
                      <Palette className="w-5 h-5 text-zinc-600" />
                    </div>
                    <div>
                      <p className="font-barlow uppercase tracking-wider text-xs text-zinc-500">{t('motorcycle.color')}</p>
                      <p className="font-semibold text-zinc-900">{motorcycle.color}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 bg-zinc-50 rounded-lg">
                    <div className="w-10 h-10 bg-zinc-200 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-zinc-600" />
                    </div>
                    <div>
                      <p className="font-barlow uppercase tracking-wider text-xs text-zinc-500">{t('motorcycle.condition')}</p>
                      <p className="font-semibold text-zinc-900">
                        {{new: t('motorcycle.new'), excellent: t('motorcycle.excellent'), good: t('motorcycle.good'), fair: t('motorcycle.fair')}[motorcycle.condition]}
                      </p>
                    </div>
                  </div>

                  {/* Seller info for dealer listings */}
                  {motorcycle.is_dealer_listing && motorcycle.seller_company && (
                    <div className="flex items-center gap-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="w-10 h-10 bg-amber-200 rounded-lg flex items-center justify-center">
                        <Store className="w-5 h-5 text-amber-700" />
                      </div>
                      <div>
                        <p className="font-barlow uppercase tracking-wider text-xs text-amber-600">{t('motorcycle.dealerListing')}</p>
                        <p className="font-semibold text-amber-900">{motorcycle.seller_company}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Bid Dialog */}
      <Dialog open={bidDialogOpen} onOpenChange={setBidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-barlow text-xl font-bold uppercase tracking-tight">
              {t('bid.placeBid')}
            </DialogTitle>
            <DialogDescription>
              {t('motorcycle.currentBid')}: {formatPrice(currentBid)} • {t('bid.minimumBid')}: {formatPrice(minNextBid)}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
              {t('bid.yourBid')} (€)
            </Label>
            <Input
              type="number"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              min={minNextBid}
              step="100"
              className="mt-2 text-2xl font-bold h-14"
              data-testid="bid-amount-input"
            />
            <p className="text-sm text-zinc-500 mt-2">
              {t('bid.minimumBid')}: {formatPrice(minNextBid)} • {t('motorcycle.buyNowPrice')}: {formatPrice(motorcycle.price)}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBidDialogOpen(false)} data-testid="cancel-bid-btn">
              {t('common.cancel')}
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={handleBid}
              disabled={submitting || parseFloat(bidAmount) < minNextBid}
              data-testid="confirm-bid-btn"
            >
              {submitting ? t('common.loading') : `${t('bid.placeBid')} ${formatPrice(parseFloat(bidAmount) || 0)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Buy Now Dialog */}
      <Dialog open={buyNowDialogOpen} onOpenChange={setBuyNowDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-barlow text-xl font-bold uppercase tracking-tight">
              {t('order.placeOrder')}
            </DialogTitle>
            <DialogDescription>
              {motorcycle.brand} {motorcycle.model} ({motorcycle.year})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Price Summary */}
            <div className="p-4 bg-zinc-900 rounded-lg text-white">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">{t('order.motorcyclePrice')}</span>
                  <span>{formatPrice(motorcycle.price)}</span>
                </div>
                {needsDelivery && (
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">{t('order.deliveryCosts')}</span>
                    <span>€50,00</span>
                  </div>
                )}
                {voucherValid && voucherDiscount > 0 && (
                  <div className="flex justify-between items-center text-green-400">
                    <span className="flex items-center gap-1">
                      <Gift className="w-4 h-4" />
                      {t('order.welcomeDiscount')}
                    </span>
                    <span>-€{voucherDiscount.toLocaleString('nl-NL')}</span>
                  </div>
                )}
                <div className="border-t border-zinc-700 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{t('order.total')}</span>
                    <span className="font-barlow text-2xl font-bold text-red-500">
                      {formatPrice(getTotalPrice())}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Voucher Input */}
            <div className="p-4 border rounded-lg bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
              <div className="flex items-center gap-2 mb-3">
                <Gift className="w-5 h-5 text-red-600" />
                <label className="font-semibold text-zinc-900">{t('voucher.title')}</label>
              </div>
              {myVoucher && !myVoucher.is_used ? (
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">{t('voucher.activeWelcome')}</p>
                      <p className="font-mono font-bold text-lg">{myVoucher.code}</p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">-€{myVoucher.amount}</Badge>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder={t('voucher.placeholder')}
                    value={voucherCode}
                    onChange={(e) => {
                      setVoucherCode(e.target.value.toUpperCase());
                      if (voucherValid) {
                        setVoucherValid(false);
                        setVoucherDiscount(0);
                      }
                    }}
                    className="font-mono uppercase"
                    data-testid="voucher-input"
                  />
                  <Button 
                    variant="outline" 
                    onClick={checkVoucher}
                    disabled={checkingVoucher || !voucherCode.trim()}
                  >
                    {checkingVoucher ? '...' : t('voucher.apply')}
                  </Button>
                </div>
              )}
              {voucherValid && !myVoucher && (
                <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  {t('voucher.applied')}: €{voucherDiscount} {t('voucher.discount')}!
                </p>
              )}
            </div>

            {/* Delivery Option */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="delivery"
                  checked={needsDelivery}
                  onCheckedChange={(checked) => setNeedsDelivery(checked)}
                  data-testid="delivery-checkbox"
                />
                <div className="flex-1">
                  <label htmlFor="delivery" className="font-semibold text-zinc-900 cursor-pointer flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    {t('order.deliveryWanted')}
                  </label>
                  <p className="text-sm text-zinc-500 mt-1">
                    {t('order.deliveryInfo')} <strong>€50,00</strong>
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-100 text-sm text-green-600 font-medium">
                ✓ {t('order.pickupFree')}
              </div>
            </div>

            {/* Inspection Option */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="inspection"
                  checked={needsInspection}
                  onCheckedChange={(checked) => setNeedsInspection(checked)}
                  data-testid="inspection-checkbox"
                />
                <div className="flex-1">
                  <label htmlFor="inspection" className="font-semibold text-zinc-900 cursor-pointer flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {t('order.inspectionWanted')}
                  </label>
                  <p className="text-sm text-zinc-500 mt-1">
                    {t('order.inspectionInfo')} <strong>€125,00</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Valuation Option */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="valuation"
                  checked={needsValuation}
                  onCheckedChange={(checked) => setNeedsValuation(checked)}
                  data-testid="valuation-checkbox"
                />
                <div className="flex-1">
                  <label htmlFor="valuation" className="font-semibold text-zinc-900 cursor-pointer flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    {t('order.valuationWanted')}
                  </label>
                  <p className="text-sm text-zinc-500 mt-1">
                    {t('order.valuationInfo')} <strong>€160,00</strong> <span className="text-xs text-zinc-400">{t('order.exclVat')}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-800">
              <p>{t('order.orderConfirmation')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyNowDialogOpen(false)} data-testid="cancel-buy-btn">
              {t('common.cancel')}
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={handleBuyNow}
              disabled={submitting}
              data-testid="confirm-buy-btn"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {submitting ? t('common.loading') : `${t('order.orderButton')} (${formatPrice(getTotalPrice())})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default MotorcycleDetail;
