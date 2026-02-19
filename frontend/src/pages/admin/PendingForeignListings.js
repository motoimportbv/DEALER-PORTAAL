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
  MessageCircle
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
                        src={motorcycle.images[0]}
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

                    {/* Suggested Price */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-zinc-500">{t('adminPending.suggestedPrice')}:</span>
                      <span className="font-barlow text-xl font-bold text-amber-600">
                        {formatPrice(motorcycle.original_price || motorcycle.price)}
                      </span>
                    </div>

                    {/* Activate Button */}
                    <Button
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      onClick={() => openActivateDialog(motorcycle)}
                    >
                      <DollarSign className="w-4 h-4 mr-2" />
                      {t('adminPending.setPriceActivate')}
                    </Button>
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
      </div>
    </Layout>
  );
};

export default PendingForeignListings;
