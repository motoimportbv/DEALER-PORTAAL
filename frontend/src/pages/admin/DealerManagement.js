import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { 
  Users,
  Check,
  X,
  Building,
  Phone,
  Mail,
  MapPin,
  FileText,
  Clock,
  Trash2,
  Globe
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/ui/tabs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DealerManagement = () => {
  const { t } = useTranslation();
  const [dealers, setDealers] = useState([]);
  const [pendingDealers, setPendingDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [foreignDialogOpen, setForeignDialogOpen] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [countryInput, setCountryInput] = useState('');

  useEffect(() => {
    fetchDealers();
  }, []);

  const fetchDealers = async () => {
    try {
      const [allRes, pendingRes] = await Promise.all([
        axios.get(`${API}/dealers`),
        axios.get(`${API}/dealers/pending`)
      ]);
      setDealers(allRes.data);
      setPendingDealers(pendingRes.data);
    } catch (error) {
      toast.error(t('adminDealers.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const approveDealer = async (dealerId) => {
    try {
      await axios.put(`${API}/dealers/${dealerId}/approve`);
      toast.success(t('adminDealers.approved'));
      fetchDealers();
    } catch (error) {
      toast.error(t('adminDealers.approveFailed'));
    }
  };

  const rejectDealer = async (dealerId) => {
    try {
      await axios.put(`${API}/dealers/${dealerId}/reject`);
      toast.success(t('adminDealers.rejected'));
      fetchDealers();
    } catch (error) {
      toast.error(t('adminDealers.rejectFailed'));
    }
  };

  const deleteDealer = async (dealerId, companyName) => {
    try {
      await axios.delete(`${API}/dealers/${dealerId}`);
      toast.success(t('adminDealers.deleted', { company: companyName }));
      fetchDealers();
    } catch (error) {
      toast.error(t('adminDealers.deleteFailed'));
    }
  };

  const setForeignDealer = async () => {
    if (!selectedDealer || !countryInput.trim()) {
      toast.error(t('adminDealers.selectCountry'));
      return;
    }
    try {
      await axios.post(`${API}/dealers/${selectedDealer.id}/set-foreign?country=${encodeURIComponent(countryInput)}`);
      toast.success(t('adminDealers.foreignSet', { company: selectedDealer.company_name, country: countryInput }));
      setForeignDialogOpen(false);
      setCountryInput('');
      setSelectedDealer(null);
      fetchDealers();
    } catch (error) {
      toast.error(t('adminDealers.foreignSetFailed'));
    }
  };

  const removeForeignDealer = async (dealerId) => {
    try {
      await axios.post(`${API}/dealers/${dealerId}/unset-foreign`);
      toast.success(t('adminDealers.foreignRemoved'));
      fetchDealers();
    } catch (error) {
      toast.error(t('adminDealers.foreignRemoveFailed'));
    }
  };

  const DealerCard = ({ dealer, showActions = false, showDelete = false }) => (
    <Card className="overflow-hidden" data-testid={`dealer-card-${dealer.id}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 ${dealer.is_foreign_dealer ? 'bg-purple-100' : 'bg-zinc-100'} rounded-lg flex items-center justify-center`}>
              {dealer.is_foreign_dealer ? (
                <Globe className="w-6 h-6 text-purple-600" />
              ) : (
                <Building className="w-6 h-6 text-zinc-600" />
              )}
            </div>
            <div>
              <h3 className="font-barlow text-lg font-bold uppercase tracking-tight text-zinc-900">
                {dealer.company_name}
              </h3>
              <p className="text-sm text-zinc-500">{dealer.contact_person}</p>
            </div>
          </div>
          <div className="flex flex-col gap-1 items-end">
            {dealer.is_approved ? (
              <Badge className="bg-green-100 text-green-800">{t('dealer.approved')}</Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800">{t('adminDealers.waitingApproval')}</Badge>
            )}
            {dealer.is_foreign_dealer && (
              <Badge className="bg-purple-100 text-purple-800 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {dealer.country || t('adminDealers.foreign')}
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-3 text-sm">
            <FileText className="w-4 h-4 text-zinc-400" />
            <span className="text-zinc-600">{t('auth.kvkNumber')}: {dealer.kvk_number || '-'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-zinc-400" />
            <span className="text-zinc-600">{dealer.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Phone className="w-4 h-4 text-zinc-400" />
            <span className="text-zinc-600">{dealer.phone || '-'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="w-4 h-4 text-zinc-400" />
            <span className="text-zinc-600">
              {dealer.address ? `${dealer.address}, ${dealer.postal_code} ${dealer.city}` : '-'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Clock className="w-4 h-4 text-zinc-400" />
            <span className="text-zinc-600">
              {t('adminDealers.registered')}: {new Date(dealer.created_at).toLocaleDateString('nl-NL')}
            </span>
          </div>
        </div>

        {/* Actions for pending dealers */}
        {showActions && !dealer.is_approved && (
          <div className="flex gap-2 pt-4 border-t border-zinc-100">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => approveDealer(dealer.id)}
              data-testid={`approve-btn-${dealer.id}`}
            >
              <Check className="w-4 h-4 mr-2" />
              {t('dealer.approve')}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                  data-testid={`reject-btn-${dealer.id}`}
                >
                  <X className="w-4 h-4 mr-2" />
                  {t('dealer.reject')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('adminDealers.rejectTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('adminDealers.rejectConfirm', { company: dealer.company_name })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => rejectDealer(dealer.id)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {t('dealer.reject')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Delete button for approved dealers */}
        {showDelete && dealer.is_approved && (
          <div className="pt-4 border-t border-zinc-100 space-y-2">
            {/* Foreign dealer toggle */}
            {!dealer.is_foreign_dealer ? (
              <Button
                variant="outline"
                className="w-full text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                onClick={() => {
                  setSelectedDealer(dealer);
                  setForeignDialogOpen(true);
                }}
                data-testid={`set-foreign-btn-${dealer.id}`}
              >
                <Globe className="w-4 h-4 mr-2" />
                {t('adminDealers.markForeign')}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full text-zinc-600 hover:text-zinc-700 hover:bg-zinc-50"
                onClick={() => removeForeignDealer(dealer.id)}
                data-testid={`unset-foreign-btn-${dealer.id}`}
              >
                <X className="w-4 h-4 mr-2" />
                {t('adminDealers.removeForeignStatus')}
              </Button>
            )}
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                  data-testid={`delete-btn-${dealer.id}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('dealer.deleteDealer')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('adminDealers.deleteTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('adminDealers.deleteConfirm', { company: dealer.company_name })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deleteDealer(dealer.id, dealer.company_name)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {t('common.delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Layout requiredRole="admin">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  const approvedDealers = dealers.filter(d => d.is_approved);

  return (
    <Layout requiredRole="admin">
      <div className="content-header">
        <div>
          <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
            Dealer Beheer
          </h1>
          <p className="text-zinc-500 mt-1">
            {pendingDealers.length} wachtend op goedkeuring • {approvedDealers.length} actieve dealers
          </p>
        </div>
      </div>

      <div className="content-body" data-testid="dealer-management">
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="pending" className="relative">
              Wachtend op Goedkeuring
              {pendingDealers.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-600 text-white text-xs rounded-full">
                  {pendingDealers.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">
              Goedgekeurde Dealers ({approvedDealers.length})
            </TabsTrigger>
            <TabsTrigger value="all">
              Alle Dealers ({dealers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {pendingDealers.length === 0 ? (
              <Card>
                <CardContent className="py-16">
                  <div className="text-center">
                    <Check className="w-16 h-16 mx-auto mb-4 text-green-500" />
                    <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                      Geen openstaande aanvragen
                    </h3>
                    <p className="text-zinc-500">Alle dealers zijn beoordeeld</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {pendingDealers.map(dealer => (
                  <DealerCard key={dealer.id} dealer={dealer} showActions={true} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved">
            {approvedDealers.length === 0 ? (
              <Card>
                <CardContent className="py-16">
                  <div className="text-center">
                    <Users className="w-16 h-16 mx-auto mb-4 text-zinc-300" />
                    <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                      Nog geen goedgekeurde dealers
                    </h3>
                    <p className="text-zinc-500">Goedgekeurde dealers verschijnen hier</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {approvedDealers.map(dealer => (
                  <DealerCard key={dealer.id} dealer={dealer} showDelete={true} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="all">
            {dealers.length === 0 ? (
              <Card>
                <CardContent className="py-16">
                  <div className="text-center">
                    <Users className="w-16 h-16 mx-auto mb-4 text-zinc-300" />
                    <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                      Nog geen dealers
                    </h3>
                    <p className="text-zinc-500">Geregistreerde dealers verschijnen hier</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dealers.map(dealer => (
                  <DealerCard 
                    key={dealer.id} 
                    dealer={dealer} 
                    showActions={!dealer.is_approved} 
                    showDelete={dealer.is_approved}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Foreign Dealer Dialog */}
        <Dialog open={foreignDialogOpen} onOpenChange={setForeignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-600" />
                Buitenlandse Dealer Instellen
              </DialogTitle>
              <DialogDescription>
                Markeer {selectedDealer?.company_name} als buitenlandse dealer (leverancier).
                Deze dealer kan dan motors indienen die u eerst beoordeelt voordat ze zichtbaar worden.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium text-zinc-700 block mb-2">
                Land
              </label>
              <select
                value={countryInput}
                onChange={(e) => setCountryInput(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
              >
                <option value="">Selecteer land...</option>
                <option value="Duitsland">🇩🇪 Duitsland</option>
                <option value="Italië">🇮🇹 Italië</option>
                <option value="Frankrijk">🇫🇷 Frankrijk</option>
                <option value="België">🇧🇪 België</option>
                <option value="Oostenrijk">🇦🇹 Oostenrijk</option>
                <option value="Spanje">🇪🇸 Spanje</option>
                <option value="Polen">🇵🇱 Polen</option>
                <option value="Anders">🌍 Anders</option>
              </select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setForeignDialogOpen(false)}>
                Annuleren
              </Button>
              <Button 
                className="bg-purple-600 hover:bg-purple-700"
                onClick={setForeignDealer}
                disabled={!countryInput}
              >
                Bevestigen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default DealerManagement;
