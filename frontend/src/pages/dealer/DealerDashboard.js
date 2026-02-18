import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import PushNotificationToggle from '../../components/PushNotificationToggle';
import PushNotificationReminder from '../../components/PushNotificationReminder';
import TermsModal from '../../components/TermsModal';
import { toast } from 'sonner';
import { 
  Bike, 
  Filter,
  Eye,
  ShoppingCart,
  Clock,
  CheckCircle,
  Plus,
  X
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DealerDashboard = () => {
  const { t } = useTranslation();
  const { user, token, refreshUser } = useAuth();
  const [motorcycles, setMotorcycles] = useState([]);
  const [filteredMotorcycles, setFilteredMotorcycles] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedModel, setSelectedModel] = useState('all');
  const [loading, setLoading] = useState(true);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const pushToggleRef = useRef(null);

  // Get unique brands with count
  const brandsWithCount = useMemo(() => {
    const brandCounts = {};
    motorcycles.forEach(m => {
      brandCounts[m.brand] = (brandCounts[m.brand] || 0) + 1;
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
      modelCounts[m.model] = (modelCounts[m.model] || 0) + 1;
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

  // Check push subscription status
  useEffect(() => {
    const checkPushStatus = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          setIsPushSubscribed(!!subscription);
        } catch (error) {
          console.error('Error checking push status:', error);
        }
      }
    };
    checkPushStatus();
    
    // Also check periodically in case subscription changes
    const interval = setInterval(checkPushStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleEnablePush = async () => {
    // Directly request notification permission and subscribe
    if ('Notification' in window && 'serviceWorker' in navigator) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Scroll to push toggle to show success state
          const pushToggle = document.querySelector('[data-testid="push-notification-enable-btn"]');
          if (pushToggle) {
            pushToggle.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => pushToggle.click(), 300);
          }
          // Check subscription status again after enabling
          setTimeout(async () => {
            try {
              const registration = await navigator.serviceWorker.ready;
              const subscription = await registration.pushManager.getSubscription();
              if (subscription) {
                setIsPushSubscribed(true);
                localStorage.setItem('pushNotificationsEnabled', 'true'); // Store flag
                // Show success message
                toast.success('Push meldingen ingeschakeld! U ontvangt nu meldingen voor nieuwe motoren en updates.', {
                  duration: 5000,
                  icon: '🔔'
                });
              }
            } catch (e) {
              console.error('Error rechecking push status:', e);
            }
          }, 2000);
        } else if (permission === 'denied') {
          toast.error('Push meldingen zijn geblokkeerd. Ga naar uw browser instellingen om dit te wijzigen.', {
            duration: 5000
          });
        }
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        // Fallback: scroll to the toggle
        const pushToggle = document.querySelector('[data-testid="push-notification-enable-btn"]');
        if (pushToggle) {
          pushToggle.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => pushToggle.click(), 500);
        }
      }
    }
  };

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

  // Auto-refresh elke 10 minuten voor dealers
  useEffect(() => {
    if (user && user.role === 'dealer' && !pendingApproval) {
      const refreshInterval = setInterval(() => {
        console.log('Auto-refresh: nieuwe motoren ophalen...');
        fetchMotorcycles();
      }, 10 * 60 * 1000); // 10 minuten in milliseconden

      return () => clearInterval(refreshInterval);
    }
  }, [user, pendingApproval]);

  const fetchMotorcycles = async () => {
    try {
      const response = await axios.get(`${API}/motorcycles/available`);
      setMotorcycles(response.data);
      setFilteredMotorcycles(response.data);
    } catch (error) {
      // Check if it's a 403 (not approved)
      if (error.response?.status === 403) {
        setPendingApproval(true);
      }
      console.error('Failed to fetch motorcycles:', error);
    } finally {
      setLoading(false);
    }
  };

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
      {/* Terms and Conditions Modal */}
      <TermsModal 
        isOpen={showTermsModal} 
        onAccept={handleTermsAccepted} 
        token={token} 
      />
      
      <div className="content-header">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
                {t('nav.motorcycles')}
              </h1>
              <p className="text-zinc-500 mt-1">{filteredMotorcycles.length} {t('motorcycle.available')}</p>
            </div>
            {/* Prominent Sell Motorcycle Button */}
            <Link to="/dealer/sell">
              <Button className="bg-green-600 hover:bg-green-700 text-white font-semibold" data-testid="sell-motorcycle-btn">
                <Plus className="w-5 h-5 mr-2" />
                {t('nav.sellMotorcycle')}
              </Button>
            </Link>
          </div>
          
          {/* Filter Dropdowns */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-500" />
              <span className="text-sm text-zinc-500 hidden sm:inline">Filter:</span>
            </div>
            
            {/* Brand Filter */}
            <Select value={selectedBrand} onValueChange={setSelectedBrand}>
              <SelectTrigger className="w-[180px]" data-testid="brand-filter">
                <SelectValue placeholder="Alle merken" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle merken ({motorcycles.length})</SelectItem>
                {brandsWithCount.map(({ brand, count }) => (
                  <SelectItem key={brand} value={brand}>{brand} ({count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Model/Type Filter */}
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[200px]" data-testid="model-filter">
                <SelectValue placeholder="Alle types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle types ({selectedBrand === 'all' ? motorcycles.length : motorcycles.filter(m => m.brand === selectedBrand).length})</SelectItem>
                {modelsWithCount.map(({ model, count }) => (
                  <SelectItem key={model} value={model}>{model} ({count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
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
        {/* Push Notification Toggle */}
        <div className="mb-6">
          <PushNotificationToggle token={token} />
        </div>

        {/* Push Notification Reminder Popup */}
        <PushNotificationReminder 
          isSubscribed={isPushSubscribed} 
          onEnableClick={handleEnablePush} 
        />
        
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
                      src={motorcycle.images[0]} 
                      alt={`${motorcycle.brand} ${motorcycle.model}`}
                      className="w-full h-full object-cover"
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
                        {motorcycle.original_currency === 'CHF' && motorcycle.original_price && (
                          <>
                            <p className="text-xs text-zinc-400">
                              (CHF {motorcycle.original_price.toLocaleString('de-CH')})
                            </p>
                            {motorcycle.price_updated_live && (
                              <p className="text-xs text-green-600 flex items-center justify-end gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                Live koers
                              </p>
                            )}
                          </>
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
    </Layout>
  );
};

export default DealerDashboard;
