import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  CreditCard
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
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [motorcycle, setMotorcycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [bids, setBids] = useState([]);
  const [bidAmount, setBidAmount] = useState('');
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [buyNowDialogOpen, setBuyNowDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [needsDelivery, setNeedsDelivery] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState(null);

  useEffect(() => {
    fetchMotorcycle();
    fetchBids();
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
      toast.success(`Bod van €${parseFloat(bidAmount).toLocaleString('nl-NL')} geplaatst!`);
      setBidDialogOpen(false);
      fetchMotorcycle();
      fetchBids();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Kon bod niet plaatsen');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBuyNow = async () => {
    setSubmitting(true);
    try {
      const response = await axios.post(`${API}/payments/create-checkout`, {
        motorcycle_id: id,
        needs_delivery: needsDelivery,
        order_type: "buy_now",
        origin_url: window.location.origin
      });
      
      // Redirect to Stripe checkout
      window.location.href = response.data.checkout_url;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Kon betaling niet starten');
      setSubmitting(false);
    }
  };

  const getConditionBadge = (condition) => {
    const styles = {
      new: 'bg-emerald-100 text-emerald-800',
      excellent: 'bg-blue-100 text-blue-800',
      good: 'bg-amber-100 text-amber-800',
      fair: 'bg-zinc-100 text-zinc-800'
    };
    const labels = {
      new: 'Nieuw',
      excellent: 'Uitstekend',
      good: 'Goed',
      fair: 'Redelijk'
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
                    <Badge className="bg-red-600 text-white text-lg px-4 py-2">Verkocht</Badge>
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
                    Biedingen ({bids.length})
                  </h3>
                  <div className="space-y-3">
                    {bids.slice(0, 5).map((bid, index) => (
                      <div key={bid.id} className={`flex items-center justify-between p-3 rounded-lg ${index === 0 ? 'bg-red-50 border border-red-200' : 'bg-zinc-50'}`}>
                        <div className="flex items-center gap-3">
                          {index === 0 && <Badge className="bg-red-600 text-white">Hoogste</Badge>}
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
                    Beschrijving
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
                      <Badge className="bg-zinc-500 text-white">Veiling Afgelopen</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800">Actief</Badge>
                    )
                  ) : (
                    <Badge className="bg-red-100 text-red-800">Verkocht</Badge>
                  )}
                </div>

                {/* Current Bid */}
                <div className="mb-4 p-4 bg-white rounded-lg border border-red-200">
                  <p className="font-barlow uppercase tracking-wider text-xs text-zinc-500 mb-1">
                    {motorcycle.highest_bid ? 'Huidig Bod' : 'Vanaf Prijs'}
                  </p>
                  <p className="font-barlow text-4xl font-bold text-red-600">
                    {formatPrice(currentBid)}
                  </p>
                  {motorcycle.highest_bid && (
                    <p className="text-sm text-zinc-500 mt-1">
                      {bids.length} {bids.length === 1 ? 'bod' : 'biedingen'}
                    </p>
                  )}
                </div>

                {/* Buy Now Price */}
                <div className="mb-6 p-4 bg-zinc-900 rounded-lg text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <p className="font-barlow uppercase tracking-wider text-xs text-zinc-400">
                      Koop Nu
                    </p>
                  </div>
                  <p className="font-barlow text-3xl font-bold">
                    {formatPrice(motorcycle.price)}
                  </p>
                </div>

                {user?.role === 'dealer' && motorcycle.is_available && !timeLeft?.expired && (
                  <div className="space-y-3">
                    <Button 
                      className="w-full h-12 bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide"
                      onClick={() => setBidDialogOpen(true)}
                      data-testid="bid-btn"
                    >
                      <Gavel className="w-5 h-5 mr-2" />
                      Plaats Bod
                    </Button>
                    <Button 
                      className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 font-barlow uppercase tracking-wide"
                      onClick={() => setBuyNowDialogOpen(true)}
                      data-testid="buy-now-btn"
                    >
                      <Zap className="w-5 h-5 mr-2" />
                      Koop Nu voor {formatPrice(motorcycle.price)}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Specs Card */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-barlow text-lg font-bold uppercase tracking-tight text-zinc-900 mb-4">
                  Specificaties
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 bg-zinc-50 rounded-lg">
                    <div className="w-10 h-10 bg-zinc-200 rounded-lg flex items-center justify-center">
                      <Bike className="w-5 h-5 text-zinc-600" />
                    </div>
                    <div>
                      <p className="font-barlow uppercase tracking-wider text-xs text-zinc-500">Merk & Model</p>
                      <p className="font-semibold text-zinc-900">{motorcycle.brand} {motorcycle.model}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 bg-zinc-50 rounded-lg">
                    <div className="w-10 h-10 bg-zinc-200 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-zinc-600" />
                    </div>
                    <div>
                      <p className="font-barlow uppercase tracking-wider text-xs text-zinc-500">Bouwjaar</p>
                      <p className="font-semibold text-zinc-900">{motorcycle.year}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 bg-zinc-50 rounded-lg">
                    <div className="w-10 h-10 bg-zinc-200 rounded-lg flex items-center justify-center">
                      <Gauge className="w-5 h-5 text-zinc-600" />
                    </div>
                    <div>
                      <p className="font-barlow uppercase tracking-wider text-xs text-zinc-500">Kilometerstand</p>
                      <p className="font-semibold text-zinc-900">{motorcycle.mileage.toLocaleString('nl-NL')} km</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 bg-zinc-50 rounded-lg">
                    <div className="w-10 h-10 bg-zinc-200 rounded-lg flex items-center justify-center">
                      <Palette className="w-5 h-5 text-zinc-600" />
                    </div>
                    <div>
                      <p className="font-barlow uppercase tracking-wider text-xs text-zinc-500">Kleur</p>
                      <p className="font-semibold text-zinc-900">{motorcycle.color}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 bg-zinc-50 rounded-lg">
                    <div className="w-10 h-10 bg-zinc-200 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-zinc-600" />
                    </div>
                    <div>
                      <p className="font-barlow uppercase tracking-wider text-xs text-zinc-500">Conditie</p>
                      <p className="font-semibold text-zinc-900">
                        {{new: 'Nieuw', excellent: 'Uitstekend', good: 'Goed', fair: 'Redelijk'}[motorcycle.condition]}
                      </p>
                    </div>
                  </div>
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
              Plaats Bod
            </DialogTitle>
            <DialogDescription>
              Huidig bod: {formatPrice(currentBid)} • Minimum volgend bod: {formatPrice(minNextBid)}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
              Uw Bod (€)
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
              Minimum bod: {formatPrice(minNextBid)} • Koop nu prijs: {formatPrice(motorcycle.price)}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBidDialogOpen(false)} data-testid="cancel-bid-btn">
              Annuleren
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={handleBid}
              disabled={submitting || parseFloat(bidAmount) < minNextBid}
              data-testid="confirm-bid-btn"
            >
              {submitting ? 'Bezig...' : `Bied ${formatPrice(parseFloat(bidAmount) || 0)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Buy Now Dialog */}
      <Dialog open={buyNowDialogOpen} onOpenChange={setBuyNowDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-barlow text-xl font-bold uppercase tracking-tight">
              Koop Nu Bevestigen
            </DialogTitle>
            <DialogDescription>
              U staat op het punt om de {motorcycle.brand} {motorcycle.model} direct te kopen.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-zinc-900 rounded-lg text-white text-center">
              <p className="font-barlow uppercase tracking-wider text-xs text-zinc-400 mb-1">Totaalprijs</p>
              <p className="font-barlow text-4xl font-bold">{formatPrice(motorcycle.price)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyNowDialogOpen(false)} data-testid="cancel-buy-btn">
              Annuleren
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={handleBuyNow}
              disabled={submitting}
              data-testid="confirm-buy-btn"
            >
              {submitting ? 'Bezig...' : 'Bevestig Koop'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default MotorcycleDetail;
