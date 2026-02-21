import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { 
  Search, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Send,
  Bike,
  Calendar,
  Gauge,
  Euro
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

const WantedRequestPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    year_min: '',
    year_max: '',
    max_mileage: '',
    max_budget: '',
    notes: ''
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/wanted-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(response.data);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Fout bij ophalen zoekertjes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.brand || !formData.max_budget) {
      toast.error('Vul minimaal het merk en budget in');
      return;
    }
    
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        brand: formData.brand,
        model: formData.model || '',
        year_min: formData.year_min ? parseInt(formData.year_min) : null,
        year_max: formData.year_max ? parseInt(formData.year_max) : null,
        max_mileage: formData.max_mileage ? parseInt(formData.max_mileage) : null,
        max_budget: parseFloat(formData.max_budget),
        notes: formData.notes || ''
      };
      
      await axios.post(`${API}/wanted-requests`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Zoekertje ingediend! We nemen zo snel mogelijk contact op.');
      setDialogOpen(false);
      setFormData({
        brand: '',
        model: '',
        year_min: '',
        year_max: '',
        max_mileage: '',
        max_budget: '',
        notes: ''
      });
      fetchRequests();
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error(error.response?.data?.detail || 'Fout bij indienen zoekertje');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (requestId) => {
    if (!window.confirm('Weet u zeker dat u dit zoekertje wilt annuleren?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/wanted-requests/${requestId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Zoekertje geannuleerd');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fout bij annuleren');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Wacht op goedkeuring</Badge>;
      case 'active':
        return <Badge className="bg-blue-100 text-blue-800"><Send className="w-3 h-3 mr-1" />Actief - Verstuurd</Badge>;
      case 'fulfilled':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Gevonden</Badge>;
      case 'expired':
        return <Badge className="bg-gray-100 text-gray-800"><AlertCircle className="w-3 h-3 mr-1" />Verlopen</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Geannuleerd</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              Motor Zoekertjes
            </h1>
            <p className="text-zinc-500 mt-1">
              Zoekt uw klant een specifieke motor? Wij zoeken het voor u!
            </p>
          </div>
          <Button 
            onClick={() => setDialogOpen(true)}
            className="bg-red-600 hover:bg-red-700"
            data-testid="new-wanted-request-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nieuw Zoekertje
          </Button>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Search className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900">Hoe werkt het?</h3>
                <ol className="text-sm text-blue-800 mt-1 space-y-1">
                  <li>1. Dien een zoekertje in met de gewenste motor specificaties</li>
                  <li>2. Wij keuren uw verzoek goed en sturen het naar al onze leveranciers</li>
                  <li>3. Zodra we een match hebben, nemen we contact met u op</li>
                  <li>4. Zoekertjes verlopen automatisch na 7 dagen</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Requests List */}
        <Card>
          <CardHeader>
            <CardTitle className="font-barlow uppercase tracking-tight">
              Mijn Zoekertjes ({requests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-zinc-500">Laden...</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                <p className="text-zinc-500">U heeft nog geen zoekertjes ingediend</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setDialogOpen(true)}
                >
                  Eerste zoekertje indienen
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <div 
                    key={request.id}
                    className="border rounded-lg p-4 hover:bg-zinc-50 transition-colors"
                    data-testid={`wanted-request-${request.id}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-lg">
                            {request.brand} {request.model}
                          </h3>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-zinc-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {request.year_min && request.year_max 
                                ? `${request.year_min} - ${request.year_max}`
                                : request.year_min 
                                  ? `Vanaf ${request.year_min}`
                                  : request.year_max 
                                    ? `T/m ${request.year_max}`
                                    : 'Elk bouwjaar'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Gauge className="w-4 h-4" />
                            <span>
                              {request.max_mileage 
                                ? `Max ${request.max_mileage.toLocaleString('nl-NL')} km`
                                : 'Geen max km'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Euro className="w-4 h-4" />
                            <span className="font-semibold text-green-600">
                              Budget: € {request.max_budget?.toLocaleString('nl-NL')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>Ingediend: {formatDate(request.created_at)}</span>
                          </div>
                        </div>
                        {request.notes && (
                          <p className="mt-2 text-sm text-zinc-500 bg-zinc-100 p-2 rounded">
                            {request.notes}
                          </p>
                        )}
                        {request.expires_at && request.status === 'active' && (
                          <p className="mt-2 text-sm text-amber-600">
                            ⏰ Verloopt op: {formatDate(request.expires_at)}
                          </p>
                        )}
                      </div>
                      {request.status === 'pending' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleCancel(request.id)}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Annuleren
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Nieuw Motor Zoekertje
            </DialogTitle>
            <DialogDescription>
              Vul de gewenste specificaties in. Wij zoeken de motor voor u bij al onze leveranciers.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="brand">Merk *</Label>
                <Input
                  id="brand"
                  placeholder="bijv. BMW, Ducati"
                  value={formData.brand}
                  onChange={(e) => setFormData({...formData, brand: e.target.value})}
                  required
                  data-testid="wanted-brand-input"
                />
              </div>
              <div>
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder="bijv. R1250GS, Monster"
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                  data-testid="wanted-model-input"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="year_min">Bouwjaar vanaf</Label>
                <Input
                  id="year_min"
                  type="number"
                  placeholder="bijv. 2018"
                  min="1970"
                  max="2026"
                  value={formData.year_min}
                  onChange={(e) => setFormData({...formData, year_min: e.target.value})}
                  data-testid="wanted-year-min-input"
                />
              </div>
              <div>
                <Label htmlFor="year_max">Bouwjaar t/m</Label>
                <Input
                  id="year_max"
                  type="number"
                  placeholder="bijv. 2023"
                  min="1970"
                  max="2026"
                  value={formData.year_max}
                  onChange={(e) => setFormData({...formData, year_max: e.target.value})}
                  data-testid="wanted-year-max-input"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="max_mileage">Max. kilometerstand</Label>
                <Input
                  id="max_mileage"
                  type="number"
                  placeholder="bijv. 30000"
                  min="0"
                  value={formData.max_mileage}
                  onChange={(e) => setFormData({...formData, max_mileage: e.target.value})}
                  data-testid="wanted-mileage-input"
                />
              </div>
              <div>
                <Label htmlFor="max_budget">Uw budget (€) *</Label>
                <Input
                  id="max_budget"
                  type="number"
                  placeholder="bijv. 15000"
                  min="0"
                  step="100"
                  value={formData.max_budget}
                  onChange={(e) => setFormData({...formData, max_budget: e.target.value})}
                  required
                  data-testid="wanted-budget-input"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="notes">Opmerkingen</Label>
              <Textarea
                id="notes"
                placeholder="Extra wensen of opmerkingen (optioneel)"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                data-testid="wanted-notes-input"
              />
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setDialogOpen(false)}
              >
                Annuleren
              </Button>
              <Button 
                type="submit" 
                className="bg-red-600 hover:bg-red-700"
                disabled={submitting}
                data-testid="submit-wanted-request-btn"
              >
                {submitting ? 'Bezig...' : 'Zoekertje Indienen'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default WantedRequestPage;
