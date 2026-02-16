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
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { 
  Bike, 
  Plus, 
  CheckCircle, 
  Clock, 
  Pencil, 
  Trash2, 
  Pause, 
  Play,
  X,
  Save,
  AlertTriangle
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

const DealerMyListings = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    price: '',
    description: '',
    condition: '',
    mileage: ''
  });

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const response = await axios.get(`${API}/motorcycles/my-listings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setListings(response.data);
    } catch (error) {
      console.error('Error fetching listings:', error);
      toast.error(t('messages.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (listing) => {
    setSelectedListing(listing);
    setEditForm({
      price: listing.price?.toString() || '',
      description: listing.description || '',
      condition: listing.condition || 'good',
      mileage: listing.mileage?.toString() || ''
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (listing) => {
    setSelectedListing(listing);
    setDeleteDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedListing) return;
    
    setSubmitting(true);
    try {
      await axios.put(
        `${API}/motorcycles/my-listings/${selectedListing.id}`,
        {
          price: parseFloat(editForm.price),
          description: editForm.description,
          condition: editForm.condition,
          mileage: parseInt(editForm.mileage)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t('myListings.updated'));
      setEditDialogOpen(false);
      fetchListings();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('messages.errorOccurred'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedListing) return;
    
    setSubmitting(true);
    try {
      await axios.delete(
        `${API}/motorcycles/my-listings/${selectedListing.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t('myListings.deleted'));
      setDeleteDialogOpen(false);
      fetchListings();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('messages.errorOccurred'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePause = async (listing) => {
    try {
      const response = await axios.put(
        `${API}/motorcycles/my-listings/${listing.id}/pause`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.message);
      fetchListings();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('messages.errorOccurred'));
    }
  };

  const getStatusBadge = (motorcycle) => {
    if (motorcycle.is_paused) {
      return (
        <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1">
          <Pause className="w-3 h-3" />
          {t('myListings.paused')}
        </Badge>
      );
    }
    if (!motorcycle.is_available) {
      return (
        <Badge className="bg-blue-100 text-blue-800 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          {t('motorcycle.sold')}
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {t('myListings.forSale')}
      </Badge>
    );
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
      <div className="content-header">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              {t('nav.myMotorcycles')}
            </h1>
            <p className="text-zinc-500 mt-1">
              {listings.length} {t('myListings.listed')}
            </p>
          </div>
          <Link to="/dealer/sell">
            <Button className="bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide">
              <Plus className="w-5 h-5 mr-2" />
              {t('nav.sellMotorcycle')}
            </Button>
          </Link>
        </div>
      </div>

      <div className="content-body">
        {listings.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="text-center">
                <Bike className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
                <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                  {t('myListings.noListings')}
                </h3>
                <p className="text-zinc-500 mb-6">
                  {t('myListings.firstListing')}
                </p>
                <Link to="/dealer/sell">
                  <Button className="bg-red-600 hover:bg-red-700">
                    <Plus className="w-4 h-4 mr-2" />
                    {t('nav.sellMotorcycle')}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((motorcycle) => (
              <Card key={motorcycle.id} className={`overflow-hidden ${motorcycle.is_paused ? 'opacity-60' : ''}`}>
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
                    <span>•</span>
                    <span>{getConditionLabel(motorcycle.condition)}</span>
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm text-zinc-500">{t('motorcycle.askingPrice')}</span>
                    <span className="font-barlow text-xl font-bold text-red-600">
                      {formatPrice(motorcycle.price)}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEditDialog(motorcycle)}
                      data-testid={`edit-listing-${motorcycle.id}`}
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePause(motorcycle)}
                      title={motorcycle.is_paused ? t('myListings.resume') : t('myListings.pause')}
                      data-testid={`pause-listing-${motorcycle.id}`}
                    >
                      {motorcycle.is_paused ? (
                        <Play className="w-4 h-4 text-green-600" />
                      ) : (
                        <Pause className="w-4 h-4 text-amber-600" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteDialog(motorcycle)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      data-testid={`delete-listing-${motorcycle.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="text-xs text-zinc-400 mt-3">
                    {t('myListings.listedOn')} {new Date(motorcycle.created_at).toLocaleDateString('nl-NL')}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info about fees */}
        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800 text-sm">
            <strong>{t('myListings.feeNotice')}:</strong> {t('myListings.feeInfo')}
          </p>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-barlow text-xl font-bold uppercase tracking-tight">
              {t('myListings.editListing')}
            </DialogTitle>
            <DialogDescription>
              {selectedListing?.brand} {selectedListing?.model}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>{t('motorcycle.askingPrice')} (€)</Label>
              <Input
                type="number"
                value={editForm.price}
                onChange={(e) => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                data-testid="edit-price-input"
              />
            </div>

            <div>
              <Label>{t('motorcycle.mileage')} (km)</Label>
              <Input
                type="number"
                value={editForm.mileage}
                onChange={(e) => setEditForm(prev => ({ ...prev, mileage: e.target.value }))}
                data-testid="edit-mileage-input"
              />
            </div>

            <div>
              <Label>{t('motorcycle.condition')}</Label>
              <Select 
                value={editForm.condition} 
                onValueChange={(value) => setEditForm(prev => ({ ...prev, condition: value }))}
              >
                <SelectTrigger data-testid="edit-condition-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">{t('motorcycle.new')}</SelectItem>
                  <SelectItem value="excellent">{t('motorcycle.excellent')}</SelectItem>
                  <SelectItem value="good">{t('motorcycle.good')}</SelectItem>
                  <SelectItem value="fair">{t('motorcycle.fair')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t('motorcycle.description')}</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                data-testid="edit-description-input"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={handleEdit}
              disabled={submitting}
              data-testid="save-edit-btn"
            >
              <Save className="w-4 h-4 mr-2" />
              {submitting ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-barlow text-xl font-bold uppercase tracking-tight flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              {t('myListings.confirmDelete')}
            </DialogTitle>
            <DialogDescription>
              {t('myListings.deleteWarning')}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 bg-zinc-100 rounded-lg">
              <p className="font-semibold">{selectedListing?.brand} {selectedListing?.model}</p>
              <p className="text-sm text-zinc-500">{selectedListing?.year} • {formatPrice(selectedListing?.price || 0)}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              disabled={submitting}
              data-testid="confirm-delete-btn"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {submitting ? t('common.loading') : t('myListings.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default DealerMyListings;
