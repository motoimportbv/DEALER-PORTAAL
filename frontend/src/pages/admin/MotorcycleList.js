import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Bike,
  Eye,
  MessageCircle,
  Share2,
  Search,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MotorcycleList = () => {
  const { t } = useTranslation();
  const [motorcycles, setMotorcycles] = useState([]);
  const [filteredMotorcycles, setFilteredMotorcycles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappData, setWhatsappData] = useState(null);

  useEffect(() => {
    fetchMotorcycles();
  }, []);

  // Filter motorcycles when search term changes
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredMotorcycles(motorcycles);
    } else {
      const search = searchTerm.toLowerCase();
      const filtered = motorcycles.filter(m => 
        m.brand?.toLowerCase().includes(search) ||
        m.model?.toLowerCase().includes(search) ||
        m.year?.toString().includes(search) ||
        m.color?.toLowerCase().includes(search)
      );
      setFilteredMotorcycles(filtered);
    }
  }, [searchTerm, motorcycles]);

  const fetchMotorcycles = async () => {
    try {
      const response = await axios.get(`${API}/motorcycles`);
      setMotorcycles(response.data);
      setFilteredMotorcycles(response.data);
    } catch (error) {
      toast.error(t('adminMotorcycles.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppShare = async (motorcycleId) => {
    try {
      const response = await axios.get(`${API}/motorcycles/${motorcycleId}/whatsapp-share`);
      setWhatsappData(response.data);
      setShowWhatsAppModal(true);
    } catch (error) {
      toast.error('Kon WhatsApp link niet genereren');
    }
  };

  const openWhatsApp = () => {
    if (whatsappData?.whatsapp_url) {
      window.open(whatsappData.whatsapp_url, '_blank');
      setShowWhatsAppModal(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/motorcycles/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(t('adminMotorcycles.deleted'));
      fetchMotorcycles();
    } catch (error) {
      toast.error(t('adminMotorcycles.deleteFailed'));
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
      <Layout requiredRole="admin">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requiredRole="admin">
      <div className="content-header">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              {t('nav.motorcycles')}
            </h1>
            <p className="text-zinc-500 mt-1">{filteredMotorcycles.length} van {motorcycles.length} {t('adminMotorcycles.inStock')}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/motorcycles/bulk">
              <Button variant="outline" className="font-barlow uppercase tracking-wide" data-testid="bulk-add-btn">
                <Plus className="w-5 h-5 mr-2" />
                Bulk Toevoegen
              </Button>
            </Link>
            <Link to="/admin/motorcycles/new">
              <Button className="bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide" data-testid="add-motorcycle-btn">
                <Plus className="w-5 h-5 mr-2" />
                {t('admin.newMotorcycle')}
              </Button>
            </Link>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mt-4 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <Input
            type="text"
            placeholder="Zoek op merk, model, jaar of kleur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
            data-testid="motorcycle-search-input"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="content-body" data-testid="motorcycle-list">
        {filteredMotorcycles.length === 0 && searchTerm ? (
          <Card>
            <CardContent className="py-16">
              <div className="empty-state">
                <Search className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
                <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                  Geen resultaten
                </h3>
                <p className="text-zinc-500 mb-6">Geen motoren gevonden voor "{searchTerm}"</p>
                <Button variant="outline" onClick={() => setSearchTerm('')}>
                  Wis zoekopdracht
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : motorcycles.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="empty-state">
                <Bike className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
                <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                  {t('adminMotorcycles.noMotorcycles')}
                </h3>
                <p className="text-zinc-500 mb-6">{t('adminMotorcycles.addFirst')}</p>
                <Link to="/admin/motorcycles/new">
                  <Button className="bg-red-600 hover:bg-red-700">
                    <Plus className="w-5 h-5 mr-2" />
                    {t('adminMotorcycles.addFirstBtn')}
                  </Button>
                </Link>
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
                  {!motorcycle.is_available && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Badge className="bg-red-600 text-white text-sm">{t('adminMotorcycles.notAvailable')}</Badge>
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
                  </div>

                  <p className="font-barlow text-2xl font-bold text-red-600 mb-1">
                    {formatPrice(motorcycle.price)}
                  </p>
                  
                  {/* Always show original supplier price if available */}
                  {motorcycle.original_price && (
                    <p className="text-xs text-zinc-500 mb-1">
                      <span className={`px-2 py-0.5 rounded ${motorcycle.original_price !== motorcycle.price ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-600'}`}>
                        Leverancier: {motorcycle.original_currency === 'CHF' 
                          ? `CHF ${motorcycle.original_price.toLocaleString('nl-NL')}` 
                          : formatPrice(motorcycle.original_price)}
                      </span>
                    </p>
                  )}
                  
                  {/* Show if price was overridden by admin */}
                  {motorcycle.price_override_active && (
                    <p className="text-xs text-blue-600 mb-3">
                      ✏️ Prijs handmatig aangepast
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Link to={`/motorcycle/${motorcycle.id}`} className="flex-1">
                      <Button variant="outline" className="w-full" data-testid={`view-btn-${motorcycle.id}`}>
                        <Eye className="w-4 h-4 mr-2" />
                        {t('adminMotorcycles.view')}
                      </Button>
                    </Link>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => handleWhatsAppShare(motorcycle.id)}
                      data-testid={`whatsapp-btn-${motorcycle.id}`}
                      title="Deel via WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                    <Link to={`/admin/motorcycles/${motorcycle.id}/edit`}>
                      <Button variant="outline" size="icon" data-testid={`edit-btn-${motorcycle.id}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="icon" className="text-red-600 hover:text-red-700" data-testid={`delete-btn-${motorcycle.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('adminMotorcycles.deleteTitle')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('adminMotorcycles.deleteConfirm', { brand: motorcycle.brand, model: motorcycle.model })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDelete(motorcycle.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {t('common.delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* WhatsApp Share Modal */}
      <Dialog open={showWhatsAppModal} onOpenChange={setShowWhatsAppModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              Deel via WhatsApp
            </DialogTitle>
            <DialogDescription>
              Deel deze motor met alle dealers via WhatsApp
            </DialogDescription>
          </DialogHeader>

          {whatsappData && (
            <div className="space-y-4">
              <div className="bg-zinc-50 rounded-lg p-4">
                <p className="text-sm text-zinc-600 mb-2 font-medium">Voorbeeld bericht:</p>
                <pre className="text-xs bg-white p-3 rounded border whitespace-pre-wrap font-sans">
                  {whatsappData.message}
                </pre>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowWhatsAppModal(false)}
                >
                  Annuleren
                </Button>
                <Button
                  className="flex-1 bg-green-500 hover:bg-green-600"
                  onClick={openWhatsApp}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Open WhatsApp
                </Button>
              </div>

              <p className="text-xs text-zinc-500 text-center">
                Tip: Stuur dit naar uw WhatsApp groep met alle dealers
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default MotorcycleList;
