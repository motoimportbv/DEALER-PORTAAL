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
import { Textarea } from '../components/ui/textarea';
import { 
  ArrowLeft, 
  Bike, 
  Calendar,
  Gauge,
  Palette,
  CheckCircle,
  ShoppingCart,
  Truck,
  CreditCard,
  Gift,
  Tag,
  Store,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  MessageSquare,
  Send,
  ClipboardCheck,
  Calculator,
  Share2,
  Mail,
  FileText
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
const PRODUCTION_URL = 'https://www.motoimportbv.nl';

const MotorcycleDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [motorcycle, setMotorcycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [buyNowDialogOpen, setBuyNowDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [needsDelivery, setNeedsDelivery] = useState(false);
  const [needsInspection, setNeedsInspection] = useState(false);
  const [needsValuation, setNeedsValuation] = useState(false);
  const [needsCoc, setNeedsCoc] = useState(false);
  const [cocBrand, setCocBrand] = useState('');
  const [cocType, setCocType] = useState('');
  const [cocChassis, setCocChassis] = useState('');
  const [cocDocumentUrl, setCocDocumentUrl] = useState('');
  const [uploadingCocPhoto, setUploadingCocPhoto] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState(null);

  // COC/CVO pricing per brand (case-insensitive). Honda NOT included: dealer bestelt zelf via Honda portal.
  const COC_PRICES = {
    yamaha: 75,
    kawasaki: 75,
    triumph: 120,
    ktm: 75,
  };
  const HONDA_COC_LINK = 'https://coc-registration.honda.eu/cocobo/termsAndConditions;jsessionid=e001532b5e9a5dcd9ef8ade61897:grxQ?locale=de_CH';
  const getCocPrice = () => {
    const brand = (motorcycle?.brand || '').trim().toLowerCase();
    return COC_PRICES[brand] || 0;
  };
  const cocAvailable = () => getCocPrice() > 0 && !isEuOnlyModel();
  const isHonda = () => (motorcycle?.brand || '').trim().toLowerCase() === 'honda';
  // EU-typegoedgekeurde modellen (geen keuring/COC door Moto Import). Mundi Moto = Italiaanse EU-leverancier.
  const isEuOnlyModel = () => /mundi/i.test(motorcycle?.foreign_dealer_company || '');

  // Redirect from preview URLs to production
  useEffect(() => {
    const hostname = window.location.hostname;
    // ALWAYS redirect preview URLs to production (except localhost)
    if (hostname.includes('preview.emergentagent.com') && !hostname.includes('localhost')) {
      // Redirect to production URL with same path
      const productionUrl = `${PRODUCTION_URL}${window.location.pathname}`;
      window.location.replace(productionUrl);  // Use replace to not add to history
    }
  }, []);
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherValid, setVoucherValid] = useState(false);
  const [checkingVoucher, setCheckingVoucher] = useState(false);
  const [myVoucher, setMyVoucher] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  
  // Price proposal state
  const [priceProposalOpen, setPriceProposalOpen] = useState(false);
  const [proposedPrice, setProposedPrice] = useState('');
  const [proposalReason, setProposalReason] = useState('');
  const [submittingProposal, setSubmittingProposal] = useState(false);
  const [proposalIncludeInspection, setProposalIncludeInspection] = useState(false);
  const [proposalIncludeAppraisal, setProposalIncludeAppraisal] = useState(false);
  const [proposalIncludeDelivery, setProposalIncludeDelivery] = useState(false);

  const openLightbox = (index = 0) => {
    setSelectedImage(index);
    setLightboxOpen(true);
  };

  const nextImage = () => {
    const images = motorcycle?.images || [];
    if (images.length > 1) {
      setSelectedImage((prev) => (prev + 1) % images.length);
    }
  };

  const prevImage = () => {
    const images = motorcycle?.images || [];
    if (images.length > 1) {
      setSelectedImage((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  useEffect(() => {
    // Wait for auth to finish loading before fetching motorcycle data
    if (!authLoading) {
      fetchMotorcycle();
      fetchMyVoucher();
    }
  }, [id, authLoading]);

  const fetchMotorcycle = async () => {
    try {
      // If user is logged in, use authenticated endpoint
      // Otherwise, use public endpoint for shared links
      const endpoint = user 
        ? `${API}/motorcycles/${id}`
        : `${API}/motorcycles/${id}/public`;
      
      const response = await axios.get(endpoint);
      setMotorcycle(response.data);
      setNotFound(false);
    } catch (error) {
      console.error('Failed to load motorcycle:', error);
      // If public endpoint fails with 404, motor might not exist or is not active
      if (error.response?.status === 404) {
        setNotFound(true);
        toast.error('Motor niet gevonden of niet meer beschikbaar');
      } else if (error.response?.status !== 401) {
        toast.error('Kon motor niet laden');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMyVoucher = async () => {
    // Don't fetch if not logged in or if foreign dealer (they don't get vouchers)
    if (!user || user.is_foreign_dealer) return;
    try {
      const response = await axios.get(`${API}/voucher/my-voucher`);
      if (response.data.has_voucher && !response.data.is_used) {
        setMyVoucher(response.data);
        setVoucherCode(response.data.code);
        setVoucherDiscount(response.data.amount);
        setVoucherValid(true);
      }
    } catch (error) {
      // Silently fail - voucher is optional
      console.log('No voucher available');
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

  const handleBuyNow = async () => {
    setSubmitting(true);
    try {
      const response = await axios.post(`${API}/orders/buy-now`, {
        motorcycle_id: id,
        needs_delivery: needsDelivery,
        needs_inspection: needsInspection,
        needs_valuation: needsValuation,
        needs_coc: needsCoc && cocAvailable(),
        coc_brand: cocBrand,
        coc_type: cocType,
        coc_chassis_number: cocChassis,
        coc_document_url: cocDocumentUrl,
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
      (needsValuation ? 160 : 0) +
      (needsCoc && cocAvailable() ? getCocPrice() : 0);
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

  // Simple wrapper for non-logged in users
  const PublicWrapper = ({ children }) => (
    <div className="min-h-screen bg-zinc-50">
      {/* Simple header for public view */}
      <header className="bg-zinc-900 text-white py-4">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bike className="w-8 h-8 text-red-500" />
            <span className="font-barlow text-xl font-bold uppercase tracking-tight">Moto Import</span>
          </div>
          <Button 
            onClick={() => navigate('/login')}
            className="bg-red-600 hover:bg-red-700"
          >
            Inloggen
          </Button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );

  // Choose wrapper based on login status
  const Wrapper = user ? Layout : PublicWrapper;

  if (loading || authLoading) {
    return (
      <Wrapper>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Wrapper>
    );
  }

  if (!motorcycle) {
    return (
      <Wrapper>
        <div className="flex flex-col items-center justify-center h-96 text-center px-4">
          <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mb-6">
            <Bike className="w-10 h-10 text-zinc-400" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-3">
            {notFound ? 'Motor niet meer beschikbaar' : t('motorcycle.notFound')}
          </h2>
          <p className="text-zinc-500 mb-6 max-w-md">
            {notFound 
              ? 'Deze motor is helaas niet meer beschikbaar. Mogelijk is deze al verkocht of uit het assortiment gehaald.'
              : t('motorcycle.notFoundDesc')
            }
          </p>
          <div className="flex gap-3">
            <Button 
              onClick={() => window.location.href = 'https://www.motoimportbv.nl'} 
              className="bg-red-600 hover:bg-red-700"
            >
              <Bike className="w-4 h-4 mr-2" />
              Bekijk ons aanbod
            </Button>
            {!user && (
              <Button 
                variant="outline"
                onClick={() => navigate('/login')}
              >
                Inloggen
              </Button>
            )}
          </div>
          <p className="text-sm text-zinc-400 mt-8">
            Heeft u vragen? Neem contact op: +31 6 24264861
          </p>
        </div>
      </Wrapper>
    );
  }

  const images = motorcycle.images?.length > 0 ? motorcycle.images : [];

  return (
    <Wrapper>
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
              <div 
                className="aspect-[16/10] bg-zinc-100 relative cursor-pointer group"
                onClick={() => images.length > 0 && openLightbox(selectedImage)}
              >
                {images.length > 0 ? (
                  <>
                    <img 
                      src={images[selectedImage]} 
                      alt={`${motorcycle.brand} ${motorcycle.model}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <ZoomIn className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                  </>
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
                      <img src={`${img}?thumb=true`} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </Card>

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
            {/* Price Card */}
            <Card className="border-2 border-red-200 bg-red-50/30">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  {getConditionBadge(motorcycle.condition)}
                  {motorcycle.is_available ? (
                    <Badge className="bg-green-100 text-green-800">{t('motorcycle.available')}</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800">{t('motorcycle.sold')}</Badge>
                  )}
                </div>

                {isEuOnlyModel() && (
                  <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg flex items-start gap-2" data-testid="eu-model-banner">
                    <span className="text-2xl leading-none">🇪🇺</span>
                    <div className="text-sm">
                      <p className="font-bold text-blue-900">EU-model — geen keuring nodig</p>
                      <p className="text-blue-700 text-xs mt-0.5">Deze motor heeft EU-typegoedkeuring. Moto Import verzorgt géén keuring/COC.</p>
                    </div>
                  </div>
                )}

                {/* Price */}
                <div className="mb-6 p-4 bg-zinc-900 rounded-lg text-white">
                  <p className="font-barlow uppercase tracking-wider text-xs text-zinc-400 mb-1">
                    {t('motorcycle.price')}
                  </p>
                  <p className="font-barlow text-4xl font-bold">
                    {formatPrice(motorcycle.price)}
                  </p>
                  
                  {/* Always show original supplier price for admin */}
                  {user?.role === 'admin' && motorcycle.original_price && (
                    <div className="mt-2 pt-2 border-t border-zinc-700">
                      <p className={`text-xs ${motorcycle.original_price !== motorcycle.price ? 'text-amber-400' : 'text-zinc-400'}`}>
                        💰 Leveranciersprijs: {motorcycle.original_currency === 'CHF' 
                          ? `CHF ${motorcycle.original_price.toLocaleString('nl-NL')}` 
                          : `€${motorcycle.original_price.toLocaleString('nl-NL')}`}
                      </p>
                      {motorcycle.price_override_active && (
                        <p className="text-xs text-blue-400 mt-1">✏️ Prijs handmatig aangepast</p>
                      )}
                    </div>
                  )}
                  
                  {motorcycle.original_currency === 'CHF' && !motorcycle.price_override_active && (
                    <div className="mt-2 pt-2 border-t border-zinc-700">
                      <p className="text-xs text-green-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                        Live CHF koers
                      </p>
                    </div>
                  )}

                  {/* Supplier price reduction banner */}
                  {motorcycle.supplier_price_reduced && motorcycle.supplier_price_reduction > 0 && (
                    <div className="mt-2 pt-2 border-t border-zinc-700" data-testid="supplier-price-reduction">
                      <div className="bg-green-900/50 border border-green-700 rounded-md px-3 py-2">
                        <p className="text-sm font-semibold text-green-400">
                          Prijsverlaging door leverancier
                        </p>
                        <p className="text-xs text-green-300 mt-0.5">
                          -{motorcycle.original_currency === 'CHF' ? 'CHF' : '€'} {motorcycle.supplier_price_reduction.toLocaleString('nl-NL')} korting
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {(user?.role === 'dealer' || user?.role === 'admin') && motorcycle.is_available && (
                  <div className="space-y-3">
                    {/* Warning for dealer listings - buyer fee */}
                    {motorcycle.is_dealer_listing && user?.role === 'dealer' && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-amber-800 text-sm font-medium flex items-center gap-2">
                          <Tag className="w-4 h-4" />
                          {t('motorcycle.buyerFeeWarning')}
                        </p>
                      </div>
                    )}
                    
                    <Button 
                      className="w-full h-12 bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide"
                      onClick={() => {
                        if (!user) {
                          // Not logged in - redirect to login
                          sessionStorage.setItem('redirectAfterLogin', `/motorcycle/${id}`);
                          navigate('/login');
                          return;
                        }
                        setNeedsDelivery(false);
                        setBuyNowDialogOpen(true);
                      }}
                      data-testid="buy-now-btn"
                    >
                      <ShoppingCart className="w-5 h-5 mr-2" />
                      {user ? t('motorcycle.orderNow') : 'Inloggen om te bestellen'}
                    </Button>
                    
                    {/* Price Proposal Button - Only for logged in dealers (not foreign) */}
                    {user && user.role === 'dealer' && !user.is_foreign_dealer && (
                      <Button 
                        variant="outline"
                        className="w-full h-12 border-2 border-amber-500 text-amber-700 hover:bg-amber-50 font-barlow uppercase tracking-wide mt-2"
                        onClick={() => {
                          setProposedPrice('');
                          setProposalReason('');
                          setPriceProposalOpen(true);
                        }}
                        data-testid="price-proposal-btn"
                      >
                        <MessageSquare className="w-5 h-5 mr-2" />
                        Prijsvoorstel
                      </Button>
                    )}
                    
                    {/* Deel met klant - voor ingelogde dealers */}
                    {user && (user.role === 'dealer' || user.role === 'admin') && motorcycle && (
                      <div className="mt-3 border-t pt-3">
                        <p className="text-xs text-zinc-500 mb-2 font-bold uppercase tracking-wider">Deel met klant (zonder prijs)</p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1 h-10 border-green-300 text-green-700 hover:bg-green-50"
                            onClick={() => {
                              const shareUrl = `https://www.motoimportbv.nl/klant/motor/${motorcycle.id}`;
                              const text = `Bekijk deze ${motorcycle.brand} ${motorcycle.model} (${motorcycle.year}):\n${shareUrl}`;
                              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                            }}
                            data-testid="share-customer-whatsapp"
                          >
                            <Share2 className="w-4 h-4 mr-1.5" />WhatsApp
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 h-10 border-blue-300 text-blue-700 hover:bg-blue-50"
                            onClick={() => {
                              const shareUrl = `https://www.motoimportbv.nl/klant/motor/${motorcycle.id}`;
                              const subject = `${motorcycle.brand} ${motorcycle.model} (${motorcycle.year})`;
                              const body = `Bekijk deze motor:\n\n${motorcycle.brand} ${motorcycle.model}\nBouwjaar: ${motorcycle.year}\nKm-stand: ${motorcycle.mileage?.toLocaleString('nl-NL')} km\nKleur: ${motorcycle.color}\n\n${shareUrl}`;
                              window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
                            }}
                            data-testid="share-customer-email"
                          >
                            <Mail className="w-4 h-4 mr-1.5" />E-mail
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Deel met klant - ALTIJD zichtbaar, ook bij verkochte motoren */}
                {user && (user.role === 'dealer' || user.role === 'admin') && motorcycle && !motorcycle.is_available && (
                  <div className="mt-4 border-t pt-4">
                    <p className="text-xs text-zinc-500 mb-2 font-bold uppercase tracking-wider">Deel met klant (zonder prijs)</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 h-10 border-green-300 text-green-700 hover:bg-green-50"
                        onClick={() => {
                          const shareUrl = `https://www.motoimportbv.nl/klant/motor/${motorcycle.id}`;
                          const text = `Bekijk deze ${motorcycle.brand} ${motorcycle.model} (${motorcycle.year}):\n${shareUrl}`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                        }}
                        data-testid="share-customer-whatsapp-sold"
                      >
                        <Share2 className="w-4 h-4 mr-1.5" />WhatsApp
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 h-10 border-blue-300 text-blue-700 hover:bg-blue-50"
                        onClick={() => {
                          const shareUrl = `https://www.motoimportbv.nl/klant/motor/${motorcycle.id}`;
                          const subject = `${motorcycle.brand} ${motorcycle.model} (${motorcycle.year})`;
                          const body = `Bekijk deze motor:\n\n${motorcycle.brand} ${motorcycle.model}\nBouwjaar: ${motorcycle.year}\nKm-stand: ${motorcycle.mileage?.toLocaleString('nl-NL')} km\nKleur: ${motorcycle.color}\n\n${shareUrl}`;
                          window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
                        }}
                        data-testid="share-customer-email-sold"
                      >
                        <Mail className="w-4 h-4 mr-1.5" />E-mail
                      </Button>
                    </div>
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

      {/* Fixed Mobile Order Button */}
      {motorcycle.is_available && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-zinc-200 shadow-lg lg:hidden z-40">
          <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
            <div>
              <p className="text-sm text-zinc-500">{motorcycle.brand} {motorcycle.model}</p>
              <p className="text-xl font-bold text-red-600">{formatPrice(motorcycle.price)}</p>
            </div>
            <Button 
              className="bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide px-6 h-12"
              onClick={() => {
                if (!user) {
                  sessionStorage.setItem('redirectAfterLogin', `/motorcycle/${id}`);
                  navigate('/login');
                  return;
                }
                setNeedsDelivery(false);
                setBuyNowDialogOpen(true);
              }}
              data-testid="mobile-buy-btn"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              {user ? t('motorcycle.orderNow') : 'Inloggen'}
            </Button>
          </div>
        </div>
      )}

      {/* Add padding at bottom for mobile to account for fixed button */}
      <div className="h-24 lg:hidden"></div>

      {/* Buy Now Dialog */}
      <Dialog open={buyNowDialogOpen} onOpenChange={setBuyNowDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-barlow text-xl font-bold uppercase tracking-tight">
              {t('order.placeOrder')}
            </DialogTitle>
            <DialogDescription>
              {motorcycle.brand} {motorcycle.model} ({motorcycle.year})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {isEuOnlyModel() && (
              <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-lg flex items-start gap-2" data-testid="eu-model-dialog-banner">
                <span className="text-xl leading-none">🇪🇺</span>
                <div className="text-sm">
                  <p className="font-bold text-blue-900">EU-typegoedkeuring</p>
                  <p className="text-blue-700 text-xs">Geen keuring/COC nodig — direct te kentekenen in NL.</p>
                </div>
              </div>
            )}
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
                {needsCoc && cocAvailable() && (
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">COC / CVO</span>
                    <span>€{getCocPrice().toLocaleString('nl-NL')},00</span>
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

            {/* Voucher Input - Only for Dutch dealers, not for foreign dealers */}
            {!user?.is_foreign_dealer && (
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
            )}

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

            {/* COC / CVO Option - alleen voor ondersteunde merken */}
            {cocAvailable() && (
              <div className="p-4 border rounded-lg" data-testid="coc-option">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="coc"
                    checked={needsCoc}
                    onCheckedChange={(checked) => {
                      setNeedsCoc(checked);
                      if (checked) {
                        // Pre-fill from motorcycle data
                        if (!cocBrand) setCocBrand(motorcycle.brand || '');
                        if (!cocType) setCocType(motorcycle.model || '');
                        if (!cocChassis) setCocChassis(motorcycle.chassis_number || '');
                      }
                    }}
                    data-testid="coc-checkbox"
                  />
                  <div className="flex-1">
                    <label htmlFor="coc" className="font-semibold text-zinc-900 cursor-pointer flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      COC / CVO bestellen
                    </label>
                    <p className="text-sm text-zinc-500 mt-1">
                      Certificaat voor <strong>{motorcycle.brand}</strong>: <strong>€{getCocPrice()},00</strong>
                    </p>
                  </div>
                </div>

                {/* COC details - alleen tonen als checkbox aan staat */}
                {needsCoc && (
                  <div className="mt-4 pt-4 border-t border-zinc-200 space-y-3" data-testid="coc-details">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-zinc-700 block mb-1">Merk *</label>
                        <Input
                          type="text"
                          value={cocBrand}
                          onChange={(e) => setCocBrand(e.target.value)}
                          placeholder="Bijv. Yamaha"
                          data-testid="coc-brand-input"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-zinc-700 block mb-1">Type *</label>
                        <Input
                          type="text"
                          value={cocType}
                          onChange={(e) => setCocType(e.target.value)}
                          placeholder="Bijv. MT-09"
                          data-testid="coc-type-input"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-700 block mb-1">Volledig chassisnummer (VIN) *</label>
                      <Input
                        type="text"
                        value={cocChassis}
                        onChange={(e) => setCocChassis(e.target.value.toUpperCase())}
                        placeholder="17 tekens, bijv. JYARN40E0JA000000"
                        className="font-mono"
                        data-testid="coc-chassis-input"
                      />
                      <p className="text-xs text-zinc-500 mt-1">
                        Of upload hieronder een foto van het kenteken in plaats van het chassisnummer
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-zinc-700 block mb-1">Foto kenteken / voertuigdocument (optioneel)</label>
                      {cocDocumentUrl ? (
                        <div className="flex items-center gap-3">
                          <img src={cocDocumentUrl} alt="Kenteken" className="h-20 rounded border border-zinc-200" />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setCocDocumentUrl('')}
                            data-testid="coc-document-remove"
                          >
                            Verwijder
                          </Button>
                        </div>
                      ) : (
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingCocPhoto}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingCocPhoto(true);
                            try {
                              const formData = new FormData();
                              formData.append('file', file);
                              const uploadRes = await axios.post(`${API}/upload`, formData, {
                                headers: { 'Content-Type': 'multipart/form-data' }
                              });
                              const url = uploadRes.data.url || uploadRes.data.image_url;
                              setCocDocumentUrl(url);
                              toast.success('Foto geüpload');
                            } catch (err) {
                              toast.error('Upload mislukt: ' + (err.response?.data?.detail || err.message));
                            } finally {
                              setUploadingCocPhoto(false);
                            }
                          }}
                          className="block w-full text-sm text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer"
                          data-testid="coc-document-upload"
                        />
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">
                      * Verplicht. Vul óf het chassisnummer in, óf upload een duidelijke foto van het kenteken.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Honda: info-link, dealer regelt zelf */}
            {isHonda() && !isEuOnlyModel() && (
              <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg" data-testid="honda-coc-info">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-blue-900 mb-1">COC / CVO voor Honda</p>
                    <p className="text-sm text-blue-800 mb-2">
                      Voor Honda motoren bestelt u het COC/CVO-document rechtstreeks bij Honda (niet via Moto Import).
                    </p>
                    <a
                      href={HONDA_COC_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 underline"
                      data-testid="honda-coc-link"
                    >
                      Bestel COC bij Honda →
                    </a>
                  </div>
                </div>
              </div>
            )}

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

      {/* Price Proposal Dialog */}
      <Dialog open={priceProposalOpen} onOpenChange={setPriceProposalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-barlow text-xl font-bold uppercase tracking-tight flex items-center gap-2">
              💰 Prijsvoorstel Indienen
            </DialogTitle>
            <DialogDescription>
              {motorcycle.brand} {motorcycle.model} ({motorcycle.year})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Current Price */}
            <div className="p-4 bg-zinc-100 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-zinc-600">Huidige vraagprijs:</span>
                <span className="text-xl font-bold text-zinc-900">{formatPrice(motorcycle.price)}</span>
              </div>
            </div>

            {/* Proposed Price Input */}
            <div className="space-y-2">
              <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                Uw voorstel (€)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">€</span>
                <Input
                  type="number"
                  placeholder="Bijv. 7500"
                  value={proposedPrice}
                  onChange={(e) => setProposedPrice(e.target.value)}
                  className="pl-8 h-12 text-lg font-bold"
                  data-testid="proposal-price-input"
                />
              </div>
              {proposedPrice && motorcycle.price && (
                <p className={`text-sm ${Number(proposedPrice) < motorcycle.price ? 'text-amber-600' : 'text-green-600'}`}>
                  {Number(proposedPrice) < motorcycle.price 
                    ? `€${(motorcycle.price - Number(proposedPrice)).toLocaleString('nl-NL')} onder vraagprijs`
                    : Number(proposedPrice) === motorcycle.price 
                      ? 'Gelijk aan vraagprijs'
                      : `€${(Number(proposedPrice) - motorcycle.price).toLocaleString('nl-NL')} boven vraagprijs`
                  }
                </p>
              )}
            </div>

            {/* Reason (Optional) */}
            <div className="space-y-2">
              <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                Toelichting (optioneel)
              </Label>
              <Textarea
                placeholder="Bijv. klant heeft beperkt budget, interesse in meerdere motors..."
                value={proposalReason}
                onChange={(e) => setProposalReason(e.target.value)}
                rows={3}
                data-testid="proposal-reason-input"
              />
            </div>

            {/* Extra Options */}
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-semibold text-blue-800 mb-3">Gewenste extra opties:</p>
              
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="proposal-inspection"
                  checked={proposalIncludeInspection}
                  onCheckedChange={setProposalIncludeInspection}
                />
                <Label htmlFor="proposal-inspection" className="flex items-center gap-2 cursor-pointer">
                  <ClipboardCheck className="w-4 h-4 text-blue-600" />
                  <span>Keuringskosten</span>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="proposal-appraisal"
                  checked={proposalIncludeAppraisal}
                  onCheckedChange={setProposalIncludeAppraisal}
                />
                <Label htmlFor="proposal-appraisal" className="flex items-center gap-2 cursor-pointer">
                  <Calculator className="w-4 h-4 text-blue-600" />
                  <span>Taxatiekosten</span>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="proposal-delivery"
                  checked={proposalIncludeDelivery}
                  onCheckedChange={setProposalIncludeDelivery}
                />
                <Label htmlFor="proposal-delivery" className="flex items-center gap-2 cursor-pointer">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span>Bezorgen</span>
                </Label>
              </div>
            </div>

            {/* Info */}
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-800">
              <p>📧 Uw voorstel wordt direct naar de admin gestuurd. U ontvangt een reactie per e-mail.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceProposalOpen(false)}>
              Annuleren
            </Button>
            <Button 
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={async () => {
                if (!proposedPrice || Number(proposedPrice) <= 0) {
                  toast.error('Vul een geldig bedrag in');
                  return;
                }
                setSubmittingProposal(true);
                try {
                  await axios.post(`${API}/price-proposals`, {
                    motorcycle_id: motorcycle.id,
                    proposed_price: Number(proposedPrice),
                    reason: proposalReason,
                    request_inspection: proposalIncludeInspection,
                    request_appraisal: proposalIncludeAppraisal,
                    request_delivery: proposalIncludeDelivery
                  });
                  toast.success('Prijsvoorstel verstuurd!');
                  setPriceProposalOpen(false);
                  // Reset form
                  setProposedPrice('');
                  setProposalReason('');
                  setProposalIncludeInspection(false);
                  setProposalIncludeAppraisal(false);
                  setProposalIncludeDelivery(false);
                } catch (error) {
                  toast.error('Fout bij versturen voorstel');
                } finally {
                  setSubmittingProposal(false);
                }
              }}
              disabled={submittingProposal || !proposedPrice}
              data-testid="submit-proposal-btn"
            >
              <Send className="w-4 h-4 mr-2" />
              {submittingProposal ? 'Versturen...' : 'Verstuur Voorstel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-5xl w-full p-0 bg-black/95 border-none">
          <div className="relative">
            {/* Close button */}
            <button 
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              data-testid="lightbox-close"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            {/* Main image */}
            <div className="flex items-center justify-center min-h-[70vh]">
              {images[selectedImage] && (
                <img 
                  src={images[selectedImage]} 
                  alt={`${motorcycle.brand} ${motorcycle.model} - Foto ${selectedImage + 1}`}
                  className="max-w-full max-h-[85vh] object-contain"
                />
              )}
            </div>

            {/* Navigation arrows */}
            {images.length > 1 && (
              <>
                <button 
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                  data-testid="lightbox-prev"
                >
                  <ChevronLeft className="w-8 h-8 text-white" />
                </button>
                <button 
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                  data-testid="lightbox-next"
                >
                  <ChevronRight className="w-8 h-8 text-white" />
                </button>

                {/* Image counter */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm">
                  {selectedImage + 1} / {images.length}
                </div>
              </>
            )}

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="flex justify-center gap-2 p-4 bg-black/80">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`w-16 h-16 rounded overflow-hidden border-2 transition-colors ${
                      idx === selectedImage ? 'border-red-500' : 'border-transparent hover:border-white/50'
                    }`}
                  >
                    <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
};

export default MotorcycleDetail;
