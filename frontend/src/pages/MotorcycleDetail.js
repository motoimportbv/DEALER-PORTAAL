import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { 
  ArrowLeft, 
  Bike, 
  Calendar,
  Gauge,
  Palette,
  CheckCircle,
  ShoppingCart
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
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [ordering, setOrdering] = useState(false);

  useEffect(() => {
    fetchMotorcycle();
  }, [id]);

  const fetchMotorcycle = async () => {
    try {
      const response = await axios.get(`${API}/motorcycles/${id}`);
      setMotorcycle(response.data);
    } catch (error) {
      toast.error('Kon motor niet laden');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleOrder = async () => {
    setOrdering(true);
    try {
      await axios.post(`${API}/orders`, {
        motorcycle_id: id,
        notes: orderNotes
      });
      toast.success('Bestelling geplaatst!');
      setOrderDialogOpen(false);
      setOrderNotes('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Kon bestelling niet plaatsen');
    } finally {
      setOrdering(false);
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
                    <Badge className="bg-red-600 text-white text-lg px-4 py-2">Niet Beschikbaar</Badge>
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
            {/* Price Card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  {getConditionBadge(motorcycle.condition)}
                  {motorcycle.is_available ? (
                    <Badge className="bg-green-100 text-green-800">Beschikbaar</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800">Verkocht</Badge>
                  )}
                </div>
                <p className="font-barlow text-4xl font-bold text-red-600 mb-6">
                  {formatPrice(motorcycle.price)}
                </p>
                {user?.role === 'dealer' && motorcycle.is_available && (
                  <Button 
                    className="w-full h-12 bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide"
                    onClick={() => setOrderDialogOpen(true)}
                    data-testid="order-btn"
                  >
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    Bestellen
                  </Button>
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

      {/* Order Dialog */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-barlow text-xl font-bold uppercase tracking-tight">
              Bestelling Plaatsen
            </DialogTitle>
            <DialogDescription>
              U staat op het punt om de {motorcycle.brand} {motorcycle.model} te bestellen voor {formatPrice(motorcycle.price)}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
              Notities (optioneel)
            </Label>
            <Textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Eventuele opmerkingen of vragen..."
              className="mt-2"
              rows={3}
              data-testid="order-notes-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderDialogOpen(false)} data-testid="cancel-order-btn">
              Annuleren
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={handleOrder}
              disabled={ordering}
              data-testid="confirm-order-btn"
            >
              {ordering ? 'Bezig...' : 'Bevestig Bestelling'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default MotorcycleDetail;
