import React, { useState, useEffect } from 'react';
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
  MapPin
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
  const { token } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [selectedMotorcycle, setSelectedMotorcycle] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [newStartingPrice, setNewStartingPrice] = useState('');
  const [activating, setActivating] = useState(false);

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
    setNewStartingPrice(motorcycle.starting_price?.toString() || '');
    setActivateDialogOpen(true);
  };

  const activateMotorcycle = async () => {
    if (!newPrice || parseFloat(newPrice) <= 0) {
      toast.error('Voer een geldige prijs in');
      return;
    }

    setActivating(true);
    try {
      const params = new URLSearchParams();
      params.append('price', newPrice);
      if (newStartingPrice) {
        params.append('starting_price', newStartingPrice);
      }

      await axios.post(`${API}/motorcycles/${selectedMotorcycle.id}/activate?${params.toString()}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`${selectedMotorcycle.brand} ${selectedMotorcycle.model} is geactiveerd!`);
      setActivateDialogOpen(false);
      setSelectedMotorcycle(null);
      setNewPrice('');
      setNewStartingPrice('');
      fetchPendingListings();
    } catch (error) {
      console.error('Error activating:', error);
      toast.error('Kon motor niet activeren');
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
      new: 'Nieuw',
      excellent: 'Uitstekend',
      good: 'Goed',
      fair: 'Redelijk'
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
              Wachtende Buitenlandse Motors
            </h1>
            <p className="text-zinc-500 mt-1">
              {listings.length} motor{listings.length !== 1 ? 's' : ''} wacht{listings.length === 1 ? '' : 'en'} op beoordeling
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
                  Geen wachtende motors
                </h3>
                <p className="text-zinc-500">
                  Alle motors van buitenlandse dealers zijn beoordeeld
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
                        Wachtend
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
                      <span className="text-sm text-zinc-500">Voorgestelde prijs:</span>
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
                      Prijs Instellen & Activeren
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
                Motor Activeren
              </DialogTitle>
              <DialogDescription>
                Stel de verkoopprijs in voor{' '}
                <strong>{selectedMotorcycle?.brand} {selectedMotorcycle?.model}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Original price info */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Voorgestelde prijs door dealer:</strong>{' '}
                  {formatPrice(selectedMotorcycle?.original_price || selectedMotorcycle?.price || 0)}
                </p>
              </div>

              {/* New Price Input */}
              <div className="space-y-2">
                <Label htmlFor="newPrice">Verkoopprijs (€) *</Label>
                <Input
                  id="newPrice"
                  type="number"
                  min="0"
                  step="100"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="bijv. 12500"
                />
              </div>

              {/* Starting Price Input */}
              <div className="space-y-2">
                <Label htmlFor="newStartingPrice">Minimum biedprijs (€)</Label>
                <Input
                  id="newStartingPrice"
                  type="number"
                  min="0"
                  step="100"
                  value={newStartingPrice}
                  onChange={(e) => setNewStartingPrice(e.target.value)}
                  placeholder="Optioneel - standaard 80% van verkoopprijs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setActivateDialogOpen(false)}>
                Annuleren
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
                Activeren
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default PendingForeignListings;
