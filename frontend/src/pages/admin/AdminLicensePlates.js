import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { 
  CreditCard, 
  Plus, 
  Search, 
  Trash2, 
  Edit,
  Building,
  Hash,
  Calendar,
  FileText,
  Upload,
  Download,
  File,
  X,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminLicensePlates = () => {
  const { t } = useTranslation();
  const [licensePlates, setLicensePlates] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlate, setEditingPlate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(null); // plate id being uploaded
  const [formData, setFormData] = useState({
    dealer_id: '',
    license_plate: '',
    chassis_number: '',
    brand: '',
    model: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [platesRes, dealersRes] = await Promise.all([
        axios.get(`${API}/license-plates`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/dealers`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setLicensePlates(platesRes.data);
      setDealers(dealersRes.data.filter(d => d.is_approved));
    } catch (error) {
      toast.error('Fout bij ophalen gegevens');
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingPlate(null);
    setFormData({
      dealer_id: '',
      license_plate: '',
      chassis_number: '',
      brand: '',
      model: '',
      notes: ''
    });
    setDialogOpen(true);
  };

  const openEditDialog = (plate) => {
    setEditingPlate(plate);
    setFormData({
      dealer_id: plate.dealer_id,
      license_plate: plate.license_plate,
      chassis_number: plate.chassis_number || '',
      brand: plate.brand || '',
      model: plate.model || '',
      notes: plate.notes || ''
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.dealer_id || !formData.license_plate) {
      toast.error('Selecteer een dealer en vul een kenteken in');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      if (editingPlate) {
        await axios.put(`${API}/license-plates/${editingPlate.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Kenteken bijgewerkt');
      } else {
        await axios.post(`${API}/license-plates`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Kenteken toegevoegd');
      }
      
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fout bij opslaan');
    }
  };

  const handleDelete = async (plate) => {
    if (!window.confirm(`Weet u zeker dat u kenteken ${plate.license_plate} wilt verwijderen?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/license-plates/${plate.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Kenteken verwijderd');
      fetchData();
    } catch (error) {
      toast.error('Fout bij verwijderen');
    }
  };

  const filteredPlates = licensePlates.filter(plate => {
    const search = searchTerm.toLowerCase();
    return (
      plate.license_plate.toLowerCase().includes(search) ||
      plate.dealer_company?.toLowerCase().includes(search) ||
      plate.chassis_number?.toLowerCase().includes(search) ||
      plate.brand?.toLowerCase().includes(search) ||
      plate.model?.toLowerCase().includes(search)
    );
  });

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              Kentekens Beheren
            </h1>
            <p className="text-zinc-500 mt-1">{licensePlates.length} kentekens</p>
          </div>
          <Button onClick={openAddDialog} className="bg-red-600 hover:bg-red-700">
            <Plus className="w-4 h-4 mr-2" />
            Kenteken Toevoegen
          </Button>
        </div>
      </div>

      <div className="content-body" data-testid="admin-license-plates">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              placeholder="Zoek op kenteken, dealer, chassisnummer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {filteredPlates.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CreditCard className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                {searchTerm ? 'Geen resultaten' : 'Geen kentekens'}
              </h3>
              <p className="text-zinc-500 mb-4">
                {searchTerm ? 'Probeer een andere zoekterm' : 'Voeg een kenteken toe voor een dealer'}
              </p>
              {!searchTerm && (
                <Button onClick={openAddDialog} className="bg-red-600 hover:bg-red-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Eerste Kenteken Toevoegen
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredPlates.map((plate) => (
              <Card key={plate.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-6">
                      {/* License Plate Display */}
                      <div className="bg-yellow-400 border-2 border-black rounded-lg px-4 py-2 font-mono font-bold text-xl text-black tracking-wider">
                        {plate.license_plate}
                      </div>
                      
                      {/* Details */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-zinc-400" />
                          <span className="font-semibold text-zinc-900">{plate.dealer_company}</span>
                          <span className="text-zinc-400">({plate.dealer_email})</span>
                        </div>
                        
                        {plate.chassis_number && (
                          <div className="flex items-center gap-2 text-sm text-zinc-600">
                            <Hash className="w-4 h-4 text-zinc-400" />
                            <span>Chassis: {plate.chassis_number}</span>
                          </div>
                        )}
                        
                        {(plate.brand || plate.model) && (
                          <div className="flex items-center gap-2 text-sm text-zinc-600">
                            <span>{plate.brand} {plate.model}</span>
                          </div>
                        )}
                        
                        {plate.notes && (
                          <div className="flex items-start gap-2 text-sm text-zinc-500">
                            <FileText className="w-4 h-4 text-zinc-400 mt-0.5" />
                            <span>{plate.notes}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <Calendar className="w-3 h-3" />
                          <span>Toegevoegd: {formatDate(plate.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(plate)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(plate)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPlate ? 'Kenteken Bewerken' : 'Kenteken Toevoegen'}
            </DialogTitle>
            <DialogDescription>
              {editingPlate ? 'Wijzig de gegevens van dit kenteken' : 'Voeg een nieuw kenteken toe voor een dealer'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Dealer *</Label>
              <Select 
                value={formData.dealer_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, dealer_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer een dealer" />
                </SelectTrigger>
                <SelectContent>
                  {dealers.map((dealer) => (
                    <SelectItem key={dealer.id} value={dealer.id}>
                      {dealer.company_name} ({dealer.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Kenteken *</Label>
              <Input
                value={formData.license_plate}
                onChange={(e) => setFormData(prev => ({ ...prev, license_plate: e.target.value.toUpperCase() }))}
                placeholder="bijv. AB-123-CD"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Chassisnummer (VIN)</Label>
              <Input
                value={formData.chassis_number}
                onChange={(e) => setFormData(prev => ({ ...prev, chassis_number: e.target.value.toUpperCase() }))}
                placeholder="bijv. WB10408J09ZT12345"
                maxLength={17}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Merk</Label>
                <Input
                  value={formData.brand}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                  placeholder="bijv. BMW"
                />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="bijv. R 1250 GS"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notities</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optionele notities"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700">
                {editingPlate ? 'Bijwerken' : 'Toevoegen'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminLicensePlates;
