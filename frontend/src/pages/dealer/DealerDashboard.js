import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { useDataRefresh } from '../../components/DataRefreshProvider';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import TermsModal from '../../components/TermsModal';
import EmailNotificationBanner from '../../components/EmailNotificationBanner';
import ReviewSection from '../../components/ReviewSection';
import { toast } from 'sonner';
import { 
  Bike, 
  Filter,
  Eye,
  ShoppingCart,
  Clock,
  CheckCircle,
  Plus,
  X,
  RefreshCw,
  Mail,
  Bell,
  Settings,
  User,
  MapPin,
  Phone,
  Euro,
  Lock,
  Unlock,
  Globe,
  Rocket,
  ArrowRight,
  Sparkles
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DealerDashboard = () => {
  const { t } = useTranslation();
  const { user, token, refreshUser } = useAuth();
  const { refreshTrigger } = useDataRefresh();
  const [searchParams, setSearchParams] = useSearchParams();
  const [motorcycles, setMotorcycles] = useState([]);
  const [filteredMotorcycles, setFilteredMotorcycles] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedModel, setSelectedModel] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPriceDisclaimer, setShowPriceDisclaimer] = useState(() => {
    // Check if user has dismissed the banner in this session
    return sessionStorage.getItem('hidePriceDisclaimer') !== 'true';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showGooglePromo, setShowGooglePromo] = useState(() => {
    return localStorage.getItem('hideGoogleMotorPromo') !== 'true';
  });
  const [emailPreferences, setEmailPreferences] = useState({
    receive_price_alerts: true,
    receive_order_updates: true,
    receive_new_motorcycles: true
  });
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [activeTab, setActiveTab] = useState('import'); // 'import' or 'particulier'
  const [privateListings, setPrivateListings] = useState([]);
  const [privateLoading, setPrivateLoading] = useState(false);

  // Load email preferences from user data
  useEffect(() => {
    if (user?.email_preferences) {
      setEmailPreferences(user.email_preferences);
    }
  }, [user]);

  const handleEmailPreferenceChange = async (key, value) => {
    const newPreferences = { ...emailPreferences, [key]: value };
    setEmailPreferences(newPreferences);
    
    setSavingPreferences(true);
    try {
      await axios.put(`${API}/users/email-preferences`, newPreferences, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Email voorkeuren opgeslagen');
      refreshUser();
    } catch (error) {
      toast.error('Kon voorkeuren niet opslaan');
      // Revert on error
      setEmailPreferences(emailPreferences);
    } finally {
      setSavingPreferences(false);
    }
  };

  const dismissPriceDisclaimer = () => {
    setShowPriceDisclaimer(false);
    sessionStorage.setItem('hidePriceDisclaimer', 'true');
  };

  // Handle return from Stripe after dealer buys a private listing
  useEffect(() => {
    const privatePurchase = searchParams.get('private_purchase');
    const listingId = searchParams.get('listing_id');
    if (privatePurchase === 'success' && listingId && token) {
      setActiveTab('particulier');
      const confirmPurchase = async () => {
        try {
          const res = await axios.post(`${API}/private-listings/dealer-purchase-confirm`,
            { listing_id: listingId },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (res.data.status === 'purchased' || res.data.status === 'already_purchased') {
            toast.success('Motor succesvol gekocht!');
            fetchPrivateListings();
          } else {
            toast.info('Betaling wordt verwerkt, probeer het over enkele seconden opnieuw.');
          }
        } catch {
          toast.error('Kon aankoop niet bevestigen');
        }
        searchParams.delete('private_purchase');
        searchParams.delete('listing_id');
        setSearchParams(searchParams, { replace: true });
      };
      confirmPurchase();
    }
    // Also handle tab=particulier URL param
    if (searchParams.get('tab') === 'particulier') {
      setActiveTab('particulier');
      searchParams.delete('tab');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, token]);

  // Fetch private listings from particulieren
  const fetchPrivateListings = useCallback(async () => {
    if (!token) return;
    setPrivateLoading(true);
    try {
      const response = await axios.get(`${API}/private-listings/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrivateListings(response.data);
    } catch (error) {
      console.error('Failed to fetch private listings:', error);
    } finally {
      setPrivateLoading(false);
    }
  }, [token]);

  // Load private listings when tab switches
  useEffect(() => {
    if (activeTab === 'particulier' && privateListings.length === 0) {
      fetchPrivateListings();
    }
  }, [activeTab]);

  // Fetch motorcycles functie - kan worden hergebruikt voor refresh
  const fetchMotorcycles = useCallback(async (showToast = false) => {
    if (!token) return;
    
    try {
      setIsRefreshing(true);
      const response = await axios.get(`${API}/motorcycles/available`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMotorcycles(response.data);
      setFilteredMotorcycles(response.data);
      if (showToast) {
        toast.success('Gegevens bijgewerkt');
      }
    } catch (error) {
      // Check if it's a 403 (not approved)
      if (error.response?.status === 403) {
        setPendingApproval(true);
      }
      console.error('Failed to fetch motorcycles:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  // Auto-refresh wanneer er updates zijn
  useEffect(() => {
    if (refreshTrigger > 0 && !loading) {
      fetchMotorcycles(false);
    }
  }, [refreshTrigger]);

  // Auto-refresh when tab/app becomes visible again
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchMotorcycles(false); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); };
  }, [token]);

  // Handmatige refresh functie
  const handleManualRefresh = () => {
    fetchMotorcycles(true);
  };

  // Get unique brands with count
  const brandsWithCount = useMemo(() => {
    const brandCounts = {};
    motorcycles.forEach(m => {
      // Skip empty brands
      if (m.brand && m.brand.trim()) {
        brandCounts[m.brand] = (brandCounts[m.brand] || 0) + 1;
      }
    });
    return Object.entries(brandCounts)
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => a.brand.localeCompare(b.brand));
  }, [motorcycles]);

  // Get models with count for selected brand
  const modelsWithCount = useMemo(() => {
    const relevantMotorcycles = selectedBrand === 'all' 
      ? motorcycles 
      : motorcycles.filter(m => m.brand === selectedBrand);
    
    const modelCounts = {};
    relevantMotorcycles.forEach(m => {
      // Skip empty models
      if (m.model && m.model.trim()) {
        modelCounts[m.model] = (modelCounts[m.model] || 0) + 1;
      }
    });
    return Object.entries(modelCounts)
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => a.model.localeCompare(b.model));
  }, [motorcycles, selectedBrand]);

  // Filter motorcycles based on selections
  useEffect(() => {
    let filtered = motorcycles;
    
    if (selectedBrand !== 'all') {
      filtered = filtered.filter(m => m.brand === selectedBrand);
    }
    
    if (selectedModel !== 'all') {
      filtered = filtered.filter(m => m.model === selectedModel);
    }
    
    setFilteredMotorcycles(filtered);
  }, [selectedBrand, selectedModel, motorcycles]);

  // Reset model when brand changes
  useEffect(() => {
    setSelectedModel('all');
  }, [selectedBrand]);

  useEffect(() => {
    const checkApprovalAndLoadData = async () => {
      // Always refresh user data to get latest is_approved status
      if (user && user.role === 'dealer' && token) {
        try {
          // Fetch fresh user data from backend
          const response = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const freshUserData = response.data;
          
          if (!freshUserData.is_approved) {
            setPendingApproval(true);
            setLoading(false);
            return;
          }

          // Check if terms are accepted
          if (!freshUserData.terms_accepted) {
            setShowTermsModal(true);
          }
        } catch (error) {
          // If 403, user is not approved
          if (error.response?.status === 403) {
            setPendingApproval(true);
            setLoading(false);
            return;
          }
        }
      }
      
      // User is approved (or admin), load motorcycles
      fetchMotorcycles();
    };
    
    if (user) {
      checkApprovalAndLoadData();
    }
  }, [user]);

  // Handle terms acceptance
  const handleTermsAccepted = async () => {
    setShowTermsModal(false);
    // Refresh user data to update terms_accepted status
    if (refreshUser) {
      await refreshUser();
    }
  };

  // Auto-refresh wordt nu beheerd door DataRefreshProvider
  // Geen extra interval nodig hier - voorkomt dubbele API calls

  // Show pending approval screen
  if (pendingApproval) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Card className="max-w-lg w-full">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-amber-100 rounded-full flex items-center justify-center">
                <Clock className="w-10 h-10 text-amber-600" />
              </div>
              <h2 className="font-barlow text-2xl font-bold uppercase tracking-tight text-zinc-900 mb-3">
                {t('auth.pendingApproval')}
              </h2>
              <p className="text-zinc-600 mb-6">
                {t('auth.pendingMessage')}
              </p>
              <div className="p-4 bg-zinc-50 rounded-lg text-left">
                <h4 className="font-semibold text-sm text-zinc-700 mb-2">Status</h4>
                <ul className="text-sm text-zinc-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{t('dealer.pending')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>{t('pending.checkingDetails')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-zinc-300 mt-0.5 flex-shrink-0" />
                    <span>{t('pending.afterApproval')}</span>
                  </li>
                </ul>
              </div>
              <p className="text-sm text-zinc-500 mt-6">
                {t('pending.questions')}{' '}
                <a href="mailto:Motoimportbv@gmail.com" className="text-red-600 hover:underline">
                  Motoimportbv@gmail.com
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

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
    return <Badge className={styles[condition]}>{labels[condition]}</Badge>;
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

  return (
    <Layout>
      {/* Google Motoren Promo Popup */}
      {showGooglePromo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" data-testid="google-promo-overlay">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowGooglePromo(false); localStorage.setItem('hideGoogleMotorPromo', 'true'); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-300" data-testid="google-promo-modal">
            {/* Header */}
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 pb-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/20 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-red-600/10 rounded-full translate-y-1/2 -translate-x-1/2" />
              <button
                onClick={() => { setShowGooglePromo(false); localStorage.setItem('hideGoogleMotorPromo', 'true'); }}
                className="absolute top-3 right-3 text-zinc-400 hover:text-white transition-colors"
                data-testid="close-google-promo"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3 mb-3 relative">
                <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
                  <Globe className="w-7 h-7 text-white" />
                </div>
                <div className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> NIEUW
                </div>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                Vergroot uw verkoop met Google!
              </h2>
              <p className="text-zinc-400 mt-1 text-sm">
                Speciaal voor Moto Import dealers
              </p>
            </div>
            {/* Content */}
            <div className="p-6">
              <p className="text-zinc-700 leading-relaxed mb-4">
                Google verkoopt uw motor <strong className="text-red-600">sneller</strong> dan <strong className="text-zinc-900">MotoOccasion</strong> en <strong className="text-zinc-900">Marktplaats</strong>. 
                Bereik miljoenen kopers zonder extra moeite!
              </p>
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-zinc-700">Sneller verkopen dan via MotoOccasion & Marktplaats</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-zinc-700">Social media post automatisch gegenereerd</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-zinc-700">Eerste week <strong className="text-red-600">GRATIS</strong></span>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-zinc-50 rounded-xl p-3 mb-5">
                <span className="text-2xl font-black text-red-600" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Vanaf &euro;2,95</span>
                <span className="text-xs text-zinc-500">per motor / week</span>
              </div>
              <div className="flex gap-3">
                <Link to="/dealer/google-motors" className="flex-1" onClick={() => { setShowGooglePromo(false); localStorage.setItem('hideGoogleMotorPromo', 'true'); }}>
                  <Button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all hover:scale-[1.02]" data-testid="google-promo-cta">
                    <Rocket className="w-4 h-4 mr-2" /> Meld u nu aan
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
              <button
                onClick={() => { setShowGooglePromo(false); localStorage.setItem('hideGoogleMotorPromo', 'true'); }}
                className="w-full text-center text-xs text-zinc-400 hover:text-zinc-600 mt-3 transition-colors"
                data-testid="dismiss-google-promo"
              >
                Niet meer tonen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms and Conditions Modal */}
      <TermsModal 
        isOpen={showTermsModal} 
        onAccept={handleTermsAccepted} 
        token={token} 
      />
      
      {/* Price Disclaimer Banner */}
      {showPriceDisclaimer && (
        <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 relative">
          <button 
            onClick={dismissPriceDisclaimer}
            className="absolute top-3 right-3 text-amber-600 hover:text-amber-800 transition-colors"
            aria-label="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-start gap-3 pr-8">
            <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <span className="text-xl">💡</span>
            </div>
            <div>
              <h3 className="font-semibold text-amber-900 mb-1">Belangrijk over onze prijzen</h3>
              <p className="text-amber-800 text-sm leading-relaxed">
                Niet alle motoren zijn altijd even aantrekkelijk qua prijs. Wij als <strong>Moto Import B.V.</strong> proberen altijd de beste prijzen voor onze klanten te realiseren. 
                Heeft u vragen over een specifieke motor? Neem gerust contact met ons op!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Email Settings Panel */}
      {showSettings && (
        <div className="mb-6 bg-white border border-zinc-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-zinc-600" />
              <h3 className="font-semibold text-zinc-900">Email Notificaties</h3>
            </div>
            <button 
              onClick={() => setShowSettings(false)}
              className="text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-zinc-500 mb-4">Kies welke email notificaties u wilt ontvangen</p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-blue-500" />
                <div>
                  <Label htmlFor="price-alerts" className="font-medium">Prijsverlagingen</Label>
                  <p className="text-xs text-zinc-500">Ontvang een email wanneer een motor die u heeft bekeken in prijs daalt</p>
                </div>
              </div>
              <Switch
                id="price-alerts"
                checked={emailPreferences.receive_price_alerts}
                onCheckedChange={(checked) => handleEmailPreferenceChange('receive_price_alerts', checked)}
                disabled={savingPreferences}
              />
            </div>
            
            <div className="flex items-center justify-between py-2 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-4 h-4 text-green-500" />
                <div>
                  <Label htmlFor="order-updates" className="font-medium">Bestellingen</Label>
                  <p className="text-xs text-zinc-500">Ontvang updates over uw bestellingen en prijsvoorstellen</p>
                </div>
              </div>
              <Switch
                id="order-updates"
                checked={emailPreferences.receive_order_updates}
                onCheckedChange={(checked) => handleEmailPreferenceChange('receive_order_updates', checked)}
                disabled={savingPreferences}
              />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Bike className="w-4 h-4 text-red-500" />
                <div>
                  <Label htmlFor="new-motorcycles" className="font-medium">Nieuwe motoren</Label>
                  <p className="text-xs text-zinc-500">Ontvang een email wanneer er nieuwe motoren worden toegevoegd</p>
                </div>
              </div>
              <Switch
                id="new-motorcycles"
                checked={emailPreferences.receive_new_motorcycles}
                onCheckedChange={(checked) => handleEmailPreferenceChange('receive_new_motorcycles', checked)}
                disabled={savingPreferences}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Tab Navigation - only show Particulier tab for dealers and allowed admin */}
      {(user?.role === 'dealer' || (user?.role === 'admin' && user?.email?.toLowerCase() === 'motoimportbv@gmail.com')) && (
      <div className="flex gap-1 mb-6 bg-zinc-100 p-1 rounded-xl w-fit" data-testid="dashboard-tabs">
        <button
          onClick={() => setActiveTab('import')}
          data-testid="tab-import"
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'import'
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          <Bike className="w-4 h-4 inline mr-2" />
          Import Motoren
        </button>
        <button
          onClick={() => setActiveTab('particulier')}
          data-testid="tab-particulier"
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'particulier'
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          <User className="w-4 h-4 inline mr-2" />
          Particulier Aanbod
          {privateListings.length > 0 && (
            <span className="ml-2 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">{privateListings.length}</span>
          )}
        </button>
      </div>
      )}

      {activeTab === 'particulier' ? (
        /* ===== PARTICULIER AANBOD TAB ===== */
        <div data-testid="particulier-listings">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
                Particulier Aanbod
              </h1>
              <p className="text-zinc-500 mt-1">Motoren aangeboden door particulieren</p>
            </div>
            <Button
              variant="outline"
              onClick={fetchPrivateListings}
              disabled={privateLoading}
              className="text-zinc-600"
              data-testid="refresh-private-btn"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${privateLoading ? 'animate-spin' : ''}`} />
              Vernieuwen
            </Button>
          </div>

          {privateLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : privateListings.length === 0 ? (
            <Card>
              <CardContent className="py-16">
                <div className="text-center">
                  <User className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
                  <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                    Geen particulier aanbod
                  </h3>
                  <p className="text-zinc-500">Er zijn momenteel geen motoren aangeboden door particulieren.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {privateListings.map((listing) => {
                const daysLeft = listing.expires_at
                  ? Math.max(0, Math.ceil((new Date(listing.expires_at) - new Date()) / (1000 * 60 * 60 * 24)))
                  : 0;
                return (
                  <Card key={listing.id} className="overflow-hidden border-2 border-zinc-100 hover:border-red-200 transition-colors" data-testid={`private-listing-${listing.id}`}>
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Particulier</span>
                      <span className="text-xs text-amber-700 font-medium">{daysLeft} dag{daysLeft !== 1 ? 'en' : ''} resterend</span>
                    </div>
                    <CardContent className="p-5">
                      <div className="mb-3">
                        <h3 className="font-barlow text-xl font-bold uppercase tracking-tight text-zinc-900">
                          {listing.brand}
                        </h3>
                        <p className="text-zinc-600 text-sm">{listing.model}</p>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-zinc-500 mb-3">
                        <span>{listing.year}</span>
                        <span>·</span>
                        <span>{listing.mileage?.toLocaleString('nl-NL')} km</span>
                        {listing.color && (<><span>·</span><span>{listing.color}</span></>)}
                      </div>

                      <div className="text-2xl font-bold text-red-600 mb-4 font-barlow">
                        {formatPrice(listing.price)}
                      </div>

                      {listing.description && (
                        <p className="text-sm text-zinc-600 mb-4 line-clamp-2">{listing.description}</p>
                      )}

                      <div className="border-t border-zinc-100 pt-3 space-y-2">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Contact</h4>
                        <div className="flex items-center gap-2 text-sm text-zinc-700">
                          <User className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{listing.user_name}</span>
                        </div>
                        {listing.city && (
                          <div className="flex items-center gap-2 text-sm text-zinc-700">
                            <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{listing.city}</span>
                          </div>
                        )}
                        {listing.user_phone && (
                          <div className="flex items-center gap-2 text-sm text-zinc-700">
                            <Phone className="w-3.5 h-3.5 text-zinc-400" />
                            <a href={`tel:${listing.user_phone}`} className="text-red-600 hover:underline">{listing.user_phone}</a>
                          </div>
                        )}
                        {listing.user_email && (
                          <div className="flex items-center gap-2 text-sm text-zinc-700">
                            <Mail className="w-3.5 h-3.5 text-zinc-400" />
                            <a href={`mailto:${listing.user_email}`} className="text-red-600 hover:underline">{listing.user_email}</a>
                          </div>
                        )}

                        {/* Buy button - €175 */}
                        <div className="pt-3">
                          {listing.is_purchased ? (
                            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-semibold text-green-700">Gekocht</span>
                            </div>
                          ) : (
                            <Button
                              data-testid={`buy-btn-${listing.id}`}
                              onClick={async () => {
                                try {
                                  const res = await axios.post(`${API}/private-listings/${listing.id}/dealer-checkout`, 
                                    { origin_url: window.location.origin },
                                    { headers: { Authorization: `Bearer ${token}` } }
                                  );
                                  if (res.data.checkout_url) {
                                    window.location.href = res.data.checkout_url;
                                  }
                                } catch (err) {
                                  if (err.response?.data?.detail) {
                                    toast.error(err.response.data.detail);
                                  } else {
                                    toast.error('Er ging iets mis');
                                  }
                                }
                              }}
                              className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-semibold"
                            >
                              <ShoppingCart className="w-4 h-4 mr-2" />
                              Kopen &euro;175
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
      <>
      {/* ===== IMPORT MOTOREN TAB ===== */}
      <div className="content-header">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
                {t('nav.motorcycles')}
              </h1>
              <p className="text-zinc-500 mt-1">{filteredMotorcycles.length} {t('motorcycle.available')}</p>
            </div>
            <div className="flex gap-2">
              {/* Settings Button */}
              <Button 
                variant="outline" 
                onClick={() => setShowSettings(!showSettings)}
                className="text-zinc-600"
                data-testid="settings-btn"
              >
                <Settings className="w-4 h-4 mr-2" />
                Instellingen
              </Button>
              {/* Refresh Button */}
              <Button 
                variant="outline" 
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="text-zinc-600"
                data-testid="refresh-btn"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Laden...' : 'Vernieuwen'}
              </Button>
              {/* Prominent Sell Motorcycle Button */}
              <Link to="/dealer/sell">
                <Button className="bg-green-600 hover:bg-green-700 text-white font-semibold" data-testid="sell-motorcycle-btn">
                  <Plus className="w-5 h-5 mr-2" />
                  {t('nav.sellMotorcycle')}
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Brand Logo Filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setSelectedBrand('all')}
              className={`px-4 py-2 rounded-lg border-2 transition-all ${
                selectedBrand === 'all' 
                  ? 'border-red-600 bg-red-50 text-red-700 font-semibold' 
                  : 'border-zinc-200 hover:border-zinc-300 bg-white'
              }`}
              data-testid="brand-all-btn"
            >
              Alle Merken ({motorcycles.length})
            </button>
            {brandsWithCount.map(({ brand, count }) => {
              // Brand logo mapping - using manufacturer logo URLs
              const brandLogos = {
                'Yamaha': 'https://www.yamaha-motor.eu/content/dam/regional/shared/logo/yamaha-logo-black.svg',
                'Honda': 'https://upload.wikimedia.org/wikipedia/commons/7/7b/Honda_Logo.svg',
                'BMW': 'https://upload.wikimedia.org/wikipedia/commons/4/44/BMW.svg',
                'Ducati': 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Ducati_red_logo.svg',
                'Kawasaki': 'https://upload.wikimedia.org/wikipedia/commons/5/54/Kawasaki_logo_vert.svg',
                'Suzuki': 'https://upload.wikimedia.org/wikipedia/commons/1/12/Suzuki_logo_2.svg',
                'KTM': 'https://upload.wikimedia.org/wikipedia/commons/b/b1/KTM-Logo.svg',
                'Triumph': 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Triumph_Motorcycles_logo.svg',
                'Harley-Davidson': 'https://upload.wikimedia.org/wikipedia/commons/d/de/Harley-Davidson_logo.svg',
                'Aprilia': 'https://upload.wikimedia.org/wikipedia/commons/4/46/Aprilia-logo.svg',
                'Moto Guzzi': 'https://upload.wikimedia.org/wikipedia/commons/9/9e/Moto_Guzzi_logo.svg',
                'MV Agusta': 'https://upload.wikimedia.org/wikipedia/commons/c/c6/MV-Agusta-Logo.svg',
                'Indian': 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Indian_Motorcycle_logo.svg',
                'Husqvarna': 'https://upload.wikimedia.org/wikipedia/commons/5/58/Husqvarna_logo.svg',
                'Royal Enfield': 'https://upload.wikimedia.org/wikipedia/commons/4/41/Royal-enfield-logo-vector.svg',
                'Benelli': 'https://upload.wikimedia.org/wikipedia/commons/5/5f/Benelli_logo.svg',
              };
              const logoUrl = brandLogos[brand];
              
              return (
                <button
                  key={brand}
                  onClick={() => setSelectedBrand(brand)}
                  className={`px-4 py-2 rounded-lg border-2 transition-all flex items-center gap-2 ${
                    selectedBrand === brand 
                      ? 'border-red-600 bg-red-50 text-red-700 font-semibold' 
                      : 'border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50'
                  }`}
                  data-testid={`brand-${brand.toLowerCase().replace(/\s+/g, '-')}-btn`}
                >
                  {/* Brand Logo or First Letter */}
                  {logoUrl ? (
                    <img 
                      src={logoUrl}
                      alt={brand}
                      className="w-6 h-6 object-contain"
                      onError={(e) => {
                        e.target.parentElement.querySelector('.brand-fallback').style.display = 'flex';
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <span 
                    className={`brand-fallback w-6 h-6 rounded-full bg-zinc-800 text-white text-xs font-bold items-center justify-center ${logoUrl ? 'hidden' : 'flex'}`}
                  >
                    {brand.charAt(0)}
                  </span>
                  <span>{brand}</span>
                  <span className="text-xs text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">{count}</span>
                </button>
              );
            })}
          </div>
          
          {/* Model/Type Filter Dropdown - Only show when brand is selected */}
          <div className="flex flex-wrap gap-3 items-center">
            {selectedBrand !== 'all' && modelsWithCount.length > 1 && (
              <>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm text-zinc-500">Model:</span>
                </div>
                
                {/* Model/Type Filter */}
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-[200px]" data-testid="model-filter">
                    <SelectValue placeholder="Alle types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle types ({motorcycles.filter(m => m.brand === selectedBrand).length})</SelectItem>
                    {modelsWithCount.map(({ model, count }) => (
                      <SelectItem key={model} value={model}>{model} ({count})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            
            {/* Clear Filters */}
            {(selectedBrand !== 'all' || selectedModel !== 'all') && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => { setSelectedBrand('all'); setSelectedModel('all'); }}
                className="text-zinc-500 hover:text-zinc-700"
              >
                <X className="w-4 h-4 mr-1" />
                Wis filters
              </Button>
            )}
            
            {/* Results Count */}
            <span className="text-sm text-zinc-500 ml-auto">
              {filteredMotorcycles.length} {filteredMotorcycles.length === 1 ? 'motor' : 'motoren'} gevonden
            </span>
          </div>
        </div>
      </div>

      <div className="content-body" data-testid="dealer-dashboard">
        {/* Email Notification Banner */}
        <EmailNotificationBanner userEmail={user?.email} />
        
        {filteredMotorcycles.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="empty-state">
                <Bike className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
                <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                  {(selectedBrand !== 'all' || selectedModel !== 'all') ? 'Geen resultaten' : t('motorcycle.noAvailable')}
                </h3>
                <p className="text-zinc-500">
                  {(selectedBrand !== 'all' || selectedModel !== 'all') 
                    ? 'Geen motoren gevonden met deze filters' 
                    : t('motorcycle.noAvailableDesc')}
                </p>
                {(selectedBrand !== 'all' || selectedModel !== 'all') && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => { setSelectedBrand('all'); setSelectedModel('all'); }}
                  >
                    Wis filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredMotorcycles.map((motorcycle) => (
              <Card key={motorcycle.id} className="motorcycle-card overflow-hidden" data-testid={`motorcycle-card-${motorcycle.id}`}>
                <div className="aspect-[4/3] relative bg-zinc-100">
                  {motorcycle.images?.[0] ? (
                    <img 
                      src={`${motorcycle.images[0]}?thumb=true`} 
                      alt={`${motorcycle.brand} ${motorcycle.model}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Bike className="w-16 h-16 text-zinc-300" />
                    </div>
                  )}
                  {/* Dealer listing badge */}
                  {motorcycle.is_dealer_listing && motorcycle.seller_company && (
                    <div className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-md font-medium">
                      {motorcycle.seller_company}
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-barlow text-lg font-bold uppercase tracking-tight text-zinc-900">
                        {motorcycle.brand}
                      </h3>
                      <p className="text-zinc-600">{motorcycle.model}</p>
                    </div>
                    {getConditionBadge(motorcycle.condition)}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-zinc-500 mb-3">
                    <span>{motorcycle.year}</span>
                    <span>•</span>
                    <span>{motorcycle.mileage.toLocaleString('nl-NL')} km</span>
                    <span>•</span>
                    <span>{motorcycle.color}</span>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-500">{t('motorcycle.price')}</span>
                      <div className="text-right">
                        <span className="font-barlow text-xl font-bold text-red-600">
                          {formatPrice(motorcycle.price)}
                        </span>
                        {motorcycle.original_currency === 'CHF' && (
                          <p className="text-xs text-green-600 flex items-center justify-end gap-1">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                            Live CHF koers
                          </p>
                        )}
                        {motorcycle.supplier_price_reduced && motorcycle.supplier_price_reduction > 0 && (
                          <p className="text-xs text-green-600 font-semibold mt-0.5" data-testid={`supplier-reduction-${motorcycle.id}`}>
                            Prijsverlaging door leverancier
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Link to={`/motorcycle/${motorcycle.id}`}>
                    <Button className="w-full bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide" data-testid={`view-btn-${motorcycle.id}`}>
                      <Eye className="w-4 h-4 mr-2" />
                      {t('motorcycle.viewAndBid')}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Reviews sectie */}
      <div className="mt-8">
        <ReviewSection lang="nl" variant="light" />
      </div>
      </>
      )}
    </Layout>
  );
};

export default DealerDashboard;
