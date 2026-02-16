import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import PushNotificationToggle from '../../components/PushNotificationToggle';
import TermsModal from '../../components/TermsModal';
import { 
  Bike, 
  Search,
  Eye,
  ShoppingCart,
  Clock,
  CheckCircle,
  Plus
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DealerDashboard = () => {
  const { t } = useTranslation();
  const { user, token, refreshUser } = useAuth();
  const [motorcycles, setMotorcycles] = useState([]);
  const [filteredMotorcycles, setFilteredMotorcycles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

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

  useEffect(() => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase().trim();
      const filtered = motorcycles.filter(m => 
        m.brand.toLowerCase().includes(search) ||
        m.model.toLowerCase().includes(search) ||
        m.color.toLowerCase().includes(search) ||
        m.year.toString().includes(search) ||
        `${m.brand} ${m.model}`.toLowerCase().includes(search)
      );
      setFilteredMotorcycles(filtered);
    } else {
      setFilteredMotorcycles(motorcycles);
    }
  }, [searchTerm, motorcycles]);

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
          </div>
          
          {/* Prominent Search Bar */}
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <Input
              type="text"
              placeholder={t('search.placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-4 py-3 text-base border-2 border-zinc-200 focus:border-red-500 rounded-lg shadow-sm"
              data-testid="search-input"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                data-testid="clear-search-btn"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="content-body" data-testid="dealer-dashboard">
        {/* Push Notification Toggle */}
        <div className="mb-6">
          <PushNotificationToggle token={token} />
        </div>
        
        {filteredMotorcycles.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="empty-state">
                <Bike className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
                <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                  {searchTerm ? t('search.noResults') : t('motorcycle.noAvailable')}
                </h3>
                <p className="text-zinc-500">
                  {searchTerm ? t('search.tryAnother') : t('motorcycle.noAvailableDesc')}
                </p>
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

                  <div className="space-y-1 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-500">{t('motorcycle.startingPrice')}</span>
                      <span className="font-barlow font-bold text-zinc-700">
                        {formatPrice(motorcycle.starting_price || motorcycle.price * 0.8)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-500">{t('motorcycle.buyNow')}</span>
                      <span className="font-barlow text-xl font-bold text-red-600">
                        {formatPrice(motorcycle.price)}
                      </span>
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
