import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  Search, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Send,
  Calendar,
  Gauge,
  Euro,
  User,
  Mail,
  Phone,
  Check,
  X
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

const AdminWantedRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [supplierPrice, setSupplierPrice] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const filteredRequests = requests.filter(r => {
    if (activeTab === 'pending') return r.status === 'pending';
    if (activeTab === 'active') return r.status === 'active';
    if (activeTab === 'completed') return ['fulfilled', 'expired', 'cancelled'].includes(r.status);
    return true;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const activeCount = requests.filter(r => r.status === 'active').length;

  const openApproveDialog = (request) => {
    setSelectedRequest(request);
    setSupplierPrice(request.max_budget?.toString() || '');
    setAdminNotes('');
    setApproveDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!supplierPrice || parseFloat(supplierPrice) <= 0) {
      toast.error('Vul een geldige prijs in voor leveranciers');
      return;
    }
    
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API}/wanted-requests/${selectedRequest.id}/approve`,
        {
          supplier_price: parseFloat(supplierPrice),
          admin_notes: adminNotes
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success(response.data.message || 'Zoekertje goedgekeurd en verstuurd!');
      setApproveDialogOpen(false);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fout bij goedkeuren');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (requestId, newStatus) => {
    const confirmMsg = newStatus === 'fulfilled' 
      ? 'Motor gevonden markeren? De dealer ontvangt een melding.'
      : newStatus === 'cancelled'
        ? 'Zoekertje annuleren?'
        : `Status wijzigen naar ${newStatus}?`;
    
    if (!window.confirm(confirmMsg)) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/wanted-requests/${requestId}/status?status=${newStatus}`,
        {},
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success('Status bijgewerkt');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fout bij wijzigen status');
    }
  };

  const handleDelete = async (requestId) => {
    if (!window.confirm('Zoekertje definitief verwijderen?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/wanted-requests/${requestId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Zoekertje verwijderd');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Fout bij verwijderen');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Wacht op goedkeuring</Badge>;
      case 'active':
        return <Badge className="bg-blue-100 text-blue-800"><Send className="w-3 h-3 mr-1" />Actief</Badge>;
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
            Motor Zoekertjes
          </h1>
          <p className="text-zinc-500 mt-1">
            Beheer zoekverzoeken van dealers
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-200 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-900">{pendingCount}</p>
                <p className="text-yellow-700 text-sm">Wachtend</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
                <Send className="w-6 h-6 text-blue-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-900">{activeCount}</p>
                <p className="text-blue-700 text-sm">Actief</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-50 border-zinc-200">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-200 rounded-full flex items-center justify-center">
                <Search className="w-6 h-6 text-zinc-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-900">{requests.length}</p>
                <p className="text-zinc-700 text-sm">Totaal</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending" className="relative">
              Wachtend
              {pendingCount > 0 && (
                <span className="ml-2 bg-yellow-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="active">Actief ({activeCount})</TabsTrigger>
            <TabsTrigger value="completed">Afgerond</TabsTrigger>
            <TabsTrigger value="all">Alle ({requests.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="text-center py-8 text-zinc-500">Laden...</div>
                ) : filteredRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <Search className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                    <p className="text-zinc-500">Geen zoekertjes in deze categorie</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredRequests.map((request) => (
                      <div 
                        key={request.id}
                        className="p-6 hover:bg-zinc-50 transition-colors"
                        data-testid={`admin-wanted-request-${request.id}`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            {/* Header */}
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="font-bold text-xl">
                                {request.brand} {request.model}
                              </h3>
                              {getStatusBadge(request.status)}
                            </div>
                            
                            {/* Specs */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                              <div className="flex items-center gap-2 text-zinc-600">
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
                              <div className="flex items-center gap-2 text-zinc-600">
                                <Gauge className="w-4 h-4" />
                                <span>
                                  {request.max_mileage 
                                    ? `Max ${request.max_mileage.toLocaleString('nl-NL')} km`
                                    : 'Geen max km'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Euro className="w-4 h-4 text-green-600" />
                                <span className="font-semibold text-green-600">
                                  Budget: € {request.max_budget?.toLocaleString('nl-NL')}
                                </span>
                              </div>
                              {request.supplier_price && (
                                <div className="flex items-center gap-2">
                                  <Euro className="w-4 h-4 text-blue-600" />
                                  <span className="font-semibold text-blue-600">
                                    Lev. prijs: € {request.supplier_price?.toLocaleString('nl-NL')}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {/* Dealer Info */}
                            <div className="flex flex-wrap gap-4 text-sm text-zinc-600 mb-3">
                              <div className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                {request.dealer_company}
                              </div>
                              <div className="flex items-center gap-1">
                                <Mail className="w-4 h-4" />
                                {request.dealer_email}
                              </div>
                              {request.dealer_phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="w-4 h-4" />
                                  {request.dealer_phone}
                                </div>
                              )}
                            </div>
                            
                            {/* Notes */}
                            {request.notes && (
                              <p className="text-sm text-zinc-600 bg-zinc-100 p-3 rounded mb-3">
                                <strong>Opmerkingen:</strong> {request.notes}
                              </p>
                            )}
                            
                            {/* Dates */}
                            <div className="flex gap-4 text-xs text-zinc-500">
                              <span>Ingediend: {formatDate(request.created_at)}</span>
                              {request.approved_at && <span>Goedgekeurd: {formatDate(request.approved_at)}</span>}
                              {request.expires_at && request.status === 'active' && (
                                <span className="text-amber-600">Verloopt: {formatDate(request.expires_at)}</span>
                              )}
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex flex-col gap-2">
                            {request.status === 'pending' && (
                              <>
                                <Button 
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => openApproveDialog(request)}
                                  data-testid={`approve-request-${request.id}`}
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Goedkeuren
                                </Button>
                                <Button 
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-300 hover:bg-red-50"
                                  onClick={() => handleDelete(request.id)}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Afwijzen
                                </Button>
                              </>
                            )}
                            {request.status === 'active' && (
                              <>
                                <Button 
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleStatusChange(request.id, 'fulfilled')}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Gevonden
                                </Button>
                                <Button 
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStatusChange(request.id, 'cancelled')}
                                >
                                  Annuleren
                                </Button>
                              </>
                            )}
                            {['fulfilled', 'expired', 'cancelled'].includes(request.status) && (
                              <Button 
                                size="sm"
                                variant="ghost"
                                className="text-red-600"
                                onClick={() => handleDelete(request.id)}
                              >
                                Verwijderen
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Zoekertje Goedkeuren</DialogTitle>
            <DialogDescription>
              Stel de prijs in die naar leveranciers wordt gestuurd. Dit kan afwijken van het budget van de dealer.
            </DialogDescription>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-zinc-100 p-4 rounded-lg">
                <h4 className="font-bold">{selectedRequest.brand} {selectedRequest.model}</h4>
                <p className="text-sm text-zinc-600">Budget dealer: € {selectedRequest.max_budget?.toLocaleString('nl-NL')}</p>
              </div>
              
              <div>
                <Label htmlFor="supplier_price">Prijs voor leveranciers (€) *</Label>
                <Input
                  id="supplier_price"
                  type="number"
                  placeholder="Voer prijs in"
                  value={supplierPrice}
                  onChange={(e) => setSupplierPrice(e.target.value)}
                  min="0"
                  step="100"
                  data-testid="supplier-price-input"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Dit is de prijs die leveranciers zien in de e-mail
                </p>
              </div>
              
              <div>
                <Label htmlFor="admin_notes">Interne notities (optioneel)</Label>
                <Textarea
                  id="admin_notes"
                  placeholder="Notities voor eigen administratie"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Annuleren
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={submitting}
              data-testid="confirm-approve-btn"
            >
              {submitting ? 'Versturen...' : 'Goedkeuren & Versturen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminWantedRequests;
