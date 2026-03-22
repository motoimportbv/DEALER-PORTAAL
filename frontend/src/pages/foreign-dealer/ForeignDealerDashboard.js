import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { useDataRefresh } from '../../components/DataRefreshProvider';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { toast } from 'sonner';
import { Bike, Plus, Clock, CheckCircle, Globe, RefreshCw, AlertTriangle, XCircle, Pencil } from 'lucide-react';
import { Input } from '../../components/ui/input';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ForeignDealerDashboard = () => {
  const { token, user } = useAuth();
  const { t } = useTranslation();
  const { refreshTrigger } = useDataRefresh();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [soldElsewhereDialog, setSoldElsewhereDialog] = useState(false);
  const [selectedMotorcycle, setSelectedMotorcycle] = useState(null);
  const [markingSold, setMarkingSold] = useState(false);
  const [editPriceDialog, setEditPriceDialog] = useState(false);
  const [editPriceMotorcycle, setEditPriceMotorcycle] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  // Fetch listings functie - kan worden hergebruikt voor refresh
  const fetchListings = useCallback(async (showToast = false) => {
    try {
      if (showToast) setIsRefreshing(true);
      const response = await axios.get(`${API}/motorcycles/foreign-listings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setListings(response.data);
      if (showToast) {
        toast.success('Gegevens bijgewerkt');
      }
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Auto-refresh wanneer er updates zijn via DataRefreshProvider
  useEffect(() => {
    if (refreshTrigger > 0 && !loading) {
      fetchListings(false);
    }
  }, [refreshTrigger, loading, fetchListings]);

  // Handmatige refresh functie
  const handleManualRefresh = () => {
    fetchListings(true);
  };

  // Handle marking motorcycle as sold elsewhere
  const handleMarkSoldElsewhere = (motorcycle) => {
    setSelectedMotorcycle(motorcycle);
    setSoldElsewhereDialog(true);
  };

  const confirmMarkSoldElsewhere = async () => {
    if (!selectedMotorcycle) return;
    
    setMarkingSold(true);
    try {
      const response = await axios.post(
        `${API}/motorcycles/foreign-listings/${selectedMotorcycle.id}/mark-sold-elsewhere`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Motor gemarkeerd als elders verkocht');
      
      if (response.data.orders_affected > 0) {
        toast.info(`${response.data.orders_affected} dealer(s) zijn per email geïnformeerd`);
      }
      
      // Refresh listings
      fetchListings(false);
      setSoldElsewhereDialog(false);
      setSelectedMotorcycle(null);
    } catch (error) {
      console.error('Error marking sold elsewhere:', error);
      toast.error(error.response?.data?.detail || 'Er ging iets mis');
    } finally {
      setMarkingSold(false);
    }
  };

  const handleEditPrice = (motorcycle) => {
    setEditPriceMotorcycle(motorcycle);
    setNewPrice(motorcycle.price?.toString() || '');
    setEditPriceDialog(true);
  };

  const confirmEditPrice = async () => {
    if (!editPriceMotorcycle || !newPrice) return;
    
    setSavingPrice(true);
    try {
      await axios.put(
        `${API}/motorcycles/foreign-listings/${editPriceMotorcycle.id}/price`,
        { price: parseFloat(newPrice) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Prijs bijgewerkt');
      fetchListings(false);
      setEditPriceDialog(false);
      setEditPriceMotorcycle(null);
    } catch (error) {
      console.error('Error updating price:', error);
      toast.error(error.response?.data?.detail || 'Er ging iets mis');
    } finally {
      setSavingPrice(false);
    }
  };

  const getStatusBadge = (motorcycle) => {
    if (motorcycle.sold_elsewhere) {
      return (
        <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          Elders verkocht
        </Badge>
      );
    } else if (motorcycle.is_pending_approval) {
      return (
        <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {t('foreignDealer.pendingReview')}
        </Badge>
      );
    } else if (motorcycle.is_available) {
      return (
        <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          {t('motorcycle.available')}
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-blue-100 text-blue-800">
          {t('motorcycle.sold')}
        </Badge>
      );
    }
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
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="content-header">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-6 h-6 text-purple-600" />
              <Badge className="bg-purple-100 text-purple-800">{t('foreignDealer.title')}</Badge>
            </div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              {t('foreignDealer.myListings')}
            </h1>
            <p className="text-zinc-500 mt-1">
              {listings.length} {listings.length !== 1 ? 'motors' : 'motor'}
            </p>
          </div>
          <div className="flex gap-2">
            {/* Refresh Button */}
            <Button 
              variant="outline" 
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="text-zinc-600"
              data-testid="refresh-listings-btn"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Laden...' : 'Vernieuwen'}
            </Button>
            <Link to="/foreign-dealer/add">
              <Button className="bg-purple-600 hover:bg-purple-700 font-barlow uppercase tracking-wide">
                <Plus className="w-5 h-5 mr-2" />
                {t('foreignDealer.addMotorcycle')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="content-body">
        {/* Info Banner */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <p className="text-purple-800 text-sm">
            {t('foreignDealer.infoMessage')}
          </p>
        </div>

        {listings.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="text-center">
                <Bike className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
                <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                  {t('motorcycle.addMotorcycle')}
                </h3>
                <p className="text-zinc-500 mb-6">
                  {t('foreignDealer.infoMessage')}
                </p>
                <Link to="/foreign-dealer/add">
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="w-4 h-4 mr-2" />
                    {t('foreignDealer.addMotorcycle')}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((motorcycle) => (
              <Card key={motorcycle.id} className="overflow-hidden border-purple-200">
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
                  <div className="absolute top-3 right-3">
                    {getStatusBadge(motorcycle)}
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="mb-2">
                    <h3 className="font-barlow text-lg font-bold uppercase tracking-tight text-zinc-900">
                      {motorcycle.brand}
                    </h3>
                    <p className="text-zinc-600">{motorcycle.model}</p>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-zinc-500 mb-3">
                    <span>{motorcycle.year}</span>
                    <span>•</span>
                    <span>{motorcycle.mileage?.toLocaleString('nl-NL')} km</span>
                  </div>

                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-zinc-500">
                      {motorcycle.is_pending_approval ? 'Voorgestelde prijs' : t('motorcycle.price')}
                    </span>
                    <span className={`font-barlow text-xl font-bold ${motorcycle.is_pending_approval ? 'text-amber-600' : 'text-green-600'}`}>
                      {formatPrice(motorcycle.price)}
                    </span>
                  </div>

                  {motorcycle.original_price && motorcycle.original_price !== motorcycle.price && (
                    <div className="text-xs text-zinc-400">
                      Origineel: {formatPrice(motorcycle.original_price)}
                    </div>
                  )}

                  {/* Prijs aanpassen knop */}
                  {!motorcycle.sold_elsewhere && motorcycle.is_available && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      onClick={() => handleEditPrice(motorcycle)}
                      data-testid={`edit-price-${motorcycle.id}`}
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Prijs aanpassen
                    </Button>
                  )}

                  {/* Elders verkocht knop - alleen tonen als nog niet verkocht */}
                  {!motorcycle.sold_elsewhere && motorcycle.is_available && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      onClick={() => handleMarkSoldElsewhere(motorcycle)}
                      data-testid={`mark-sold-elsewhere-${motorcycle.id}`}
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Elders verkocht
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Sold Elsewhere Confirmation Dialog */}
      <Dialog open={soldElsewhereDialog} onOpenChange={setSoldElsewhereDialog}>
        <DialogContent data-testid="sold-elsewhere-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Motor elders verkocht?
            </DialogTitle>
            <DialogDescription>
              {selectedMotorcycle && (
                <>
                  Weet u zeker dat u de <strong>{selectedMotorcycle.brand} {selectedMotorcycle.model}</strong> wilt 
                  markeren als elders verkocht?
                  <br /><br />
                  <span className="text-amber-600 font-medium">
                    ⚠️ Dealers die deze motor hebben besteld worden automatisch per email geïnformeerd.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSoldElsewhereDialog(false)}
              disabled={markingSold}
            >
              Annuleren
            </Button>
            <Button
              variant="destructive"
              onClick={confirmMarkSoldElsewhere}
              disabled={markingSold}
              data-testid="confirm-sold-elsewhere-btn"
            >
              {markingSold ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Ja, elders verkocht
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Price Dialog */}
      <Dialog open={editPriceDialog} onOpenChange={setEditPriceDialog}>
        <DialogContent data-testid="edit-price-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <Pencil className="w-5 h-5" />
              Prijs aanpassen
            </DialogTitle>
            <DialogDescription>
              {editPriceMotorcycle && (
                <>
                  Pas de prijs aan voor de <strong>{editPriceMotorcycle.brand} {editPriceMotorcycle.model}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-zinc-700 mb-2 block">Nieuwe prijs (CHF)</label>
            <Input
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="Bijv. 12500"
              min="0"
              step="100"
              data-testid="new-price-input"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditPriceDialog(false)} disabled={savingPrice}>
              Annuleren
            </Button>
            <Button
              onClick={confirmEditPrice}
              disabled={savingPrice || !newPrice || parseFloat(newPrice) <= 0}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="confirm-edit-price-btn"
            >
              {savingPrice ? 'Opslaan...' : 'Prijs opslaan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default ForeignDealerDashboard;
