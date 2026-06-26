import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { 
  Globe, 
  Bike, 
  Check, 
  Clock,
  DollarSign,
  MapPin,
  MessageCircle,
  X,
  Eraser
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PendingForeignListings = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [selectedMotorcycle, setSelectedMotorcycle] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [activating, setActivating] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [activatedMotorcycleId, setActivatedMotorcycleId] = useState(null);
  const [blurringId, setBlurringId] = useState(null);
  const [imageCacheBust, setImageCacheBust] = useState({}); // motorcycle_id -> timestamp

  const handleBlurLogos = async (motorcycle) => {
    const isMundi = /mundi/i.test(motorcycle.foreign_dealer_company || '');
    const defaultCorner = isMundi ? 'top-left' : 'top-left';
    const corner = window.prompt(
      'Welke hoek bevat het dealer-logo dat geblurd moet worden?\n\nGeef in: top-left, top-right, bottom-left, of bottom-right',
      defaultCorner
    );
    if (!corner) return;
    if (!['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(corner)) {
      toast.error('Ongeldige hoek');
      return;
    }
    setBlurringId(motorcycle.id);
    try {
      const res = await axios.post(
        `${API}/motorcycles/${motorcycle.id}/blur-images?corner=${corner}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const d = res.data || {};
      toast.success(`${d.processed || 0} foto('s) geblurd (${d.errors || 0} fouten)`);
      // Force browser cache-refresh by adding ?v=
      setImageCacheBust(prev => ({ ...prev, [motorcycle.id]: Date.now() }));
      await fetchPendingListings();
    } catch (err) {
      console.error('Blur error:', err);
      toast.error(err.response?.data?.detail || 'Blur mislukt');
    } finally {
      setBlurringId(null);
    }
  };

  useEffect(() => {
    fetchPendingListings();
  }, []);

  const fetchPendingListings = async () => {
    try {
      const response = await axios.get(`${API}/motorcycles/pending-foreign`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setListings(response.data);
    } catch (error) {
      console.error('Error fetching pending listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const openActivateDialog = (motorcycle) => {
    setSelectedMotorcycle(motorcycle);
    setNewPrice(motorcycle.price?.toString() || '');
    setActivateDialogOpen(true);
  };

  const activateMotorcycle = async () => {
    if (!newPrice || parseFloat(newPrice) <= 0) {
      toast.error(t('adminPending.enterValidPrice'));
      return;
    }

    setActivating(true);
    try {
      const params = new URLSearchParams();
      params.append('price', newPrice);

      await axios.post(`${API}/motorcycles/${selectedMotorcycle.id}/activate?${params.toString()}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(t('adminPending.activated', { brand: selectedMotorcycle.brand, model: selectedMotorcycle.model }));
      
      // Store the activated motorcycle ID and show WhatsApp modal
      setActivatedMotorcycleId(selectedMotorcycle.id);
      setActivateDialogOpen(false);
      setSelectedMotorcycle(null);
      setNewPrice('');
      setShowWhatsAppModal(true);
      
      fetchPendingListings();
    } catch (error) {
      console.error('Error activating:', error);
      toast.error(error.response?.data?.detail || t('adminPending.activateFailed'));
    } finally {
      setActivating(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0
    }).format(price);
  };

  const getConditionLabel = (condition) => {
    const labels = {
      new: t('motorcycle.new'),
      excellent: t('motorcycle.excellent'),
      good: t('motorcycle.good'),
      fair: t('motorcycle.fair')
    };
    return labels[condition] || condition;
  };

  if (loading) {
    return (
      <Layout requiredRole="admin">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requiredRole="admin">
      <div className="content-header">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <Globe className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              {t('adminPending.title')}
            </h1>
            <p className="text-zinc-500 mt-1">
              {listings.length} {t('adminPending.waitingReview')}
            </p>
          </div>
        </div>
      </div>

      <div className="content-body">
        {listings.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="text-center">
                <Check className="w-20 h-20 mx-auto mb-4 text-green-500" />
                <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                  {t('adminPending.noPending')}
                </h3>
                <p className="text-zinc-500">
                  {t('adminPending.allReviewed')}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {listings.map((motorcycle) => (
              <Card key={motorcycle.id} className="overflow-hidden border-purple-200">
                <div className="flex">
                  {/* Image */}
                  <div className="w-48 h-48 flex-shrink-0 bg-zinc-100">
                    {motorcycle.images?.[0] ? (
                      <img
                        src={imageCacheBust[motorcycle.id] ? `${motorcycle.images[0]}?v=${imageCacheBust[motorcycle.id]}` : motorcycle.images[0]}
                        alt={`${motorcycle.brand} ${motorcycle.model}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Bike className="w-12 h-12 text-zinc-300" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <CardContent className="flex-1 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-barlow text-lg font-bold uppercase tracking-tight text-zinc-900">
                          {motorcycle.brand} {motorcycle.model}
                        </h3>
                        <p className="text-zinc-500 text-sm">
                          {motorcycle.year} • {motorcycle.mileage?.toLocaleString('nl-NL')} km • {getConditionLabel(motorcycle.condition)}
                        </p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {t('order.pending')}
                      </Badge>
                    </div>

                    {/* Foreign Dealer Info */}
                    <div className="flex items-center gap-2 mb-3 p-2 bg-purple-50 rounded-lg">
                      <Globe className="w-4 h-4 text-purple-600" />
                      <span className="text-purple-800 text-sm font-medium">
                        {motorcycle.foreign_dealer_company}
                      </span>
                    </div>
                    
                    {/* Maintenance History Badge */}
                    <div className={`flex items-center gap-2 mb-3 p-2 rounded-lg ${motorcycle.has_maintenance_history ? 'bg-green-50' : 'bg-red-50'}`}>
                      {motorcycle.has_maintenance_history ? (
                        <>
                          <Check className="w-4 h-4 text-green-600" />
                          <span className="text-green-800 text-sm font-medium">
                            ✓ Onderhoudshistorie aanwezig
                          </span>
                        </>
                      ) : motorcycle.has_maintenance_history === false ? (
                        <>
                          <X className="w-4 h-4 text-red-600" />
                          <span className="text-red-800 text-sm font-medium">
                            ✗ Geen onderhoudshistorie
                          </span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 text-zinc-400" />
                          <span className="text-zinc-500 text-sm">
                            Onderhoudshistorie onbekend
                          </span>
                        </>
                      )}
                    </div>
                    {motorcycle.maintenance_history_details && (
                      <p className="text-xs text-zinc-500 mb-3 italic">
                        "{motorcycle.maintenance_history_details}"
                      </p>
                    )}

                    {/* Suggested Price */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-zinc-500">{t('adminPending.suggestedPrice')}:</span>
                      <span className="font-barlow text-xl font-bold text-amber-600">
                        {formatPrice(motorcycle.original_price || motorcycle.price)}
                      </span>
                    </div>

                    {/* Activate Button */}
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-amber-300 text-amber-800 hover:bg-amber-50"
                        onClick={() => handleBlurLogos(motorcycle)}
                        disabled={blurringId === motorcycle.id || !(motorcycle.images && motorcycle.images.length)}
                        data-testid={`blur-logos-btn-${motorcycle.id}`}
                      >
                        <Eraser className="w-4 h-4 mr-2" />
                        {blurringId === motorcycle.id ? 'Bezig met blurren...' : `Blur dealer-logo's op ${motorcycle.images?.length || 0} foto's`}
                      </Button>
                      <Button
                        className="w-full bg-purple-600 hover:bg-purple-700"
                        onClick={() => openActivateDialog(motorcycle)}
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        {t('adminPending.setPriceActivate')}
                      </Button>
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Activate Dialog */}
        <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-purple-600" />
                {t('adminPending.activateMotorcycle')}
              </DialogTitle>
              <DialogDescription>
                {t('adminPending.setPrice')}{' '}
                <strong>{selectedMotorcycle?.brand} {selectedMotorcycle?.model}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Original price info */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>{t('adminPending.dealerSuggestedPrice')}:</strong>{' '}
                  {formatPrice(selectedMotorcycle?.original_price || selectedMotorcycle?.price || 0)}
                </p>
              </div>

              {/* New Price Input */}
              <div className="space-y-2">
                <Label htmlFor="newPrice">{t('adminPending.salePrice')} (€) *</Label>
                <Input
                  id="newPrice"
                  type="number"
                  min="0"
                  step="100"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder={t('adminPending.pricePlaceholder')}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setActivateDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={activateMotorcycle}
                disabled={activating || !newPrice}
              >
                {activating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                {t('admin.activateListing')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* WhatsApp Share Modal */}
        <Dialog open={showWhatsAppModal} onOpenChange={setShowWhatsAppModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                Motor Geactiveerd!
              </DialogTitle>
              <DialogDescription>
                Wilt u alle 🇳🇱 Nederlandse dealers direct informeren via WhatsApp?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-sm text-green-800">
                  📱 Met één klik opent WhatsApp voor elke Nederlandse dealer met een vooraf ingevuld bericht over deze motor.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowWhatsAppModal(false)}
                >
                  Later
                </Button>
                <Button
                  className="flex-1 bg-green-500 hover:bg-green-600"
                  onClick={() => {
                    setShowWhatsAppModal(false);
                    navigate(`/admin/whatsapp?motorcycle=${activatedMotorcycleId}`);
                  }}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Deel via WhatsApp
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default PendingForeignListings;
