import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { Input } from '../../components/ui/input';
import { Checkbox } from '../../components/ui/checkbox';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  Check, 
  X, 
  ArrowRightLeft, 
  Clock, 
  Building2,
  Mail,
  Calendar,
  Bike,
  Euro,
  Loader2,
  CheckCircle,
  XCircle,
  MessageCircle,
  ClipboardCheck,
  Calculator,
  Truck
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminPriceProposals = () => {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState(null);
  const [responseType, setResponseType] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [counterPrice, setCounterPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('pending');
  
  // Extra options for accepted proposals
  const [includeInspection, setIncludeInspection] = useState(false);
  const [includeAppraisal, setIncludeAppraisal] = useState(false);
  const [includeDelivery, setIncludeDelivery] = useState(false);

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    try {
      const response = await axios.get(`${API}/price-proposals`);
      setProposals(response.data);
    } catch (error) {
      toast.error('Fout bij laden voorstellen');
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async () => {
    if (!respondingTo || !responseType) return;
    
    if (responseType === 'counter' && (!counterPrice || Number(counterPrice) <= 0)) {
      toast.error('Vul een geldig tegenbod in');
      return;
    }

    setSubmitting(true);
    try {
      await axios.put(`${API}/price-proposals/${respondingTo.id}/respond`, null, {
        params: {
          response: responseType,
          admin_message: adminMessage,
          counter_price: responseType === 'counter' ? Number(counterPrice) : null
        }
      });
      toast.success(
        responseType === 'accepted' ? 'Voorstel geaccepteerd!' :
        responseType === 'rejected' ? 'Voorstel afgewezen' :
        'Tegenbod verstuurd!'
      );
      setRespondingTo(null);
      setResponseType('');
      setAdminMessage('');
      setCounterPrice('');
      fetchProposals();
    } catch (error) {
      toast.error('Fout bij versturen reactie');
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(price);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800"><Clock className="w-3 h-3 mr-1" />In afwachting</Badge>;
      case 'accepted':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Geaccepteerd</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Afgewezen</Badge>;
      case 'counter':
        return <Badge className="bg-blue-100 text-blue-800"><MessageCircle className="w-3 h-3 mr-1" />Tegenbod</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const filteredProposals = proposals.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  const pendingCount = proposals.filter(p => p.status === 'pending').length;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              💰 Prijsvoorstellen
            </h1>
            <p className="text-zinc-500 mt-1">Beheer inkomende prijsvoorstellen van dealers</p>
          </div>
          {pendingCount > 0 && (
            <Badge className="bg-amber-500 text-white text-lg px-4 py-2">
              {pendingCount} nieuw
            </Badge>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilter('pending')}
            className={filter === 'pending' ? 'bg-amber-500 hover:bg-amber-600' : ''}
          >
            <Clock className="w-4 h-4 mr-2" />
            In afwachting ({proposals.filter(p => p.status === 'pending').length})
          </Button>
          <Button
            variant={filter === 'accepted' ? 'default' : 'outline'}
            onClick={() => setFilter('accepted')}
            className={filter === 'accepted' ? 'bg-green-500 hover:bg-green-600' : ''}
          >
            <Check className="w-4 h-4 mr-2" />
            Geaccepteerd
          </Button>
          <Button
            variant={filter === 'rejected' ? 'default' : 'outline'}
            onClick={() => setFilter('rejected')}
            className={filter === 'rejected' ? 'bg-red-500 hover:bg-red-600' : ''}
          >
            <X className="w-4 h-4 mr-2" />
            Afgewezen
          </Button>
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            Alles ({proposals.length})
          </Button>
        </div>

        {/* Proposals List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          </div>
        ) : filteredProposals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-zinc-300" />
              <p className="text-zinc-500">
                {filter === 'pending' ? 'Geen openstaande voorstellen' : 'Geen voorstellen gevonden'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredProposals.map((proposal) => (
              <Card key={proposal.id} className={`${proposal.status === 'pending' ? 'border-amber-300 bg-amber-50/50' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Motorcycle Image */}
                    <div className="w-full lg:w-48 h-32 bg-zinc-100 rounded-lg overflow-hidden flex-shrink-0">
                      {proposal.motorcycle?.images?.[0] ? (
                        <img 
                          src={proposal.motorcycle.images[0]} 
                          alt="Motor" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Bike className="w-12 h-12 text-zinc-300" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-barlow text-xl font-bold uppercase tracking-tight">
                            {proposal.motorcycle?.brand} {proposal.motorcycle?.model}
                          </h3>
                          <p className="text-zinc-500">{proposal.motorcycle?.year}</p>
                        </div>
                        {getStatusBadge(proposal.status)}
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-zinc-500 uppercase tracking-wide">Dealer</p>
                          <p className="font-semibold flex items-center gap-1">
                            <Building2 className="w-4 h-4 text-zinc-400" />
                            {proposal.dealer_company}
                          </p>
                          <p className="text-sm text-zinc-500 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {proposal.dealer_email}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 uppercase tracking-wide">Vraagprijs</p>
                          <p className="font-semibold text-zinc-900">{formatPrice(proposal.original_price)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 uppercase tracking-wide">Voorstel</p>
                          <p className="font-bold text-xl text-amber-600">{formatPrice(proposal.proposed_price)}</p>
                          <p className={`text-sm ${proposal.proposed_price < proposal.original_price ? 'text-red-500' : 'text-green-500'}`}>
                            {proposal.proposed_price < proposal.original_price 
                              ? `-${formatPrice(proposal.original_price - proposal.proposed_price)}`
                              : `+${formatPrice(proposal.proposed_price - proposal.original_price)}`
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 uppercase tracking-wide">Datum</p>
                          <p className="text-sm flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-zinc-400" />
                            {formatDate(proposal.created_at)}
                          </p>
                        </div>
                      </div>

                      {proposal.reason && (
                        <div className="p-3 bg-white rounded-lg border">
                          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Toelichting dealer</p>
                          <p className="text-zinc-700 italic">"{proposal.reason}"</p>
                        </div>
                      )}

                      {proposal.status === 'counter' && proposal.counter_price && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-xs text-blue-600 uppercase tracking-wide mb-1">Uw tegenbod</p>
                          <p className="text-blue-800 font-bold text-lg">{formatPrice(proposal.counter_price)}</p>
                        </div>
                      )}

                      {proposal.admin_response && (
                        <div className="p-3 bg-zinc-100 rounded-lg">
                          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Uw reactie</p>
                          <p className="text-zinc-700">"{proposal.admin_response}"</p>
                        </div>
                      )}

                      {/* Actions for pending proposals */}
                      {proposal.status === 'pending' && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            className="bg-green-500 hover:bg-green-600"
                            onClick={() => {
                              setRespondingTo(proposal);
                              setResponseType('accepted');
                              setAdminMessage('');
                            }}
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Accepteren
                          </Button>
                          <Button
                            variant="outline"
                            className="border-amber-500 text-amber-700 hover:bg-amber-50"
                            onClick={() => {
                              setRespondingTo(proposal);
                              setResponseType('counter');
                              setAdminMessage('');
                              setCounterPrice('');
                            }}
                          >
                            <ArrowRightLeft className="w-4 h-4 mr-2" />
                            Tegenbod
                          </Button>
                          <Button
                            variant="outline"
                            className="border-red-500 text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setRespondingTo(proposal);
                              setResponseType('rejected');
                              setAdminMessage('');
                            }}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Afwijzen
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Response Dialog */}
      <Dialog open={!!respondingTo} onOpenChange={() => setRespondingTo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-barlow text-xl font-bold uppercase tracking-tight">
              {responseType === 'accepted' && '✅ Voorstel Accepteren'}
              {responseType === 'rejected' && '❌ Voorstel Afwijzen'}
              {responseType === 'counter' && '💬 Tegenbod Doen'}
            </DialogTitle>
            <DialogDescription>
              {respondingTo?.dealer_company} - {respondingTo?.motorcycle?.brand} {respondingTo?.motorcycle?.model}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {/* Show current proposal */}
            <div className="p-3 bg-zinc-100 rounded-lg">
              <div className="flex justify-between">
                <span className="text-zinc-600">Vraagprijs:</span>
                <span className="font-semibold">{formatPrice(respondingTo?.original_price || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Dealer voorstel:</span>
                <span className="font-bold text-amber-600">{formatPrice(respondingTo?.proposed_price || 0)}</span>
              </div>
            </div>

            {/* Counter price input */}
            {responseType === 'counter' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Uw tegenbod (€)</label>
                <div className="relative">
                  <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    type="number"
                    placeholder="Bijv. 18000"
                    value={counterPrice}
                    onChange={(e) => setCounterPrice(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            )}

            {/* Message input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Bericht aan dealer (optioneel)</label>
              <Textarea
                placeholder={
                  responseType === 'accepted' ? 'Bijv. Akkoord! Neem contact op om de koop af te ronden.' :
                  responseType === 'rejected' ? 'Bijv. Helaas kunnen wij niet onder de vraagprijs gaan.' :
                  'Bijv. Wij kunnen tot dit bedrag gaan. Laat weten of dit akkoord is.'
                }
                value={adminMessage}
                onChange={(e) => setAdminMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondingTo(null)}>
              Annuleren
            </Button>
            <Button
              onClick={handleRespond}
              disabled={submitting}
              className={
                responseType === 'accepted' ? 'bg-green-500 hover:bg-green-600' :
                responseType === 'rejected' ? 'bg-red-500 hover:bg-red-600' :
                'bg-amber-500 hover:bg-amber-600'
              }
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : responseType === 'accepted' ? (
                <Check className="w-4 h-4 mr-2" />
              ) : responseType === 'rejected' ? (
                <X className="w-4 h-4 mr-2" />
              ) : (
                <ArrowRightLeft className="w-4 h-4 mr-2" />
              )}
              {responseType === 'accepted' ? 'Accepteren' :
               responseType === 'rejected' ? 'Afwijzen' :
               'Verstuur Tegenbod'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AdminPriceProposals;
