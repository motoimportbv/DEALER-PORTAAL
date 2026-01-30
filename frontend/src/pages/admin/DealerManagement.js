import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  Users,
  Check,
  X,
  Building,
  Phone,
  Mail,
  MapPin,
  FileText,
  Clock
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/ui/tabs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DealerManagement = () => {
  const [dealers, setDealers] = useState([]);
  const [pendingDealers, setPendingDealers] = useState([]);
  const [loading, setLoading] = useState(true);

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
      toast.error('Kon dealers niet laden');
    } finally {
      setLoading(false);
    }
  };

  const approveDealer = async (dealerId) => {
    try {
      await axios.put(`${API}/dealers/${dealerId}/approve`);
      toast.success('Dealer goedgekeurd! Een email is verstuurd.');
      fetchDealers();
    } catch (error) {
      toast.error('Kon dealer niet goedkeuren');
    }
  };

  const rejectDealer = async (dealerId) => {
    try {
      await axios.put(`${API}/dealers/${dealerId}/reject`);
      toast.success('Dealer afgewezen en verwijderd');
      fetchDealers();
    } catch (error) {
      toast.error('Kon dealer niet afwijzen');
    }
  };

  const DealerCard = ({ dealer, showActions = false }) => (
    <Card className="overflow-hidden" data-testid={`dealer-card-${dealer.id}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-zinc-100 rounded-lg flex items-center justify-center">
              <Building className="w-6 h-6 text-zinc-600" />
            </div>
            <div>
              <h3 className="font-barlow text-lg font-bold uppercase tracking-tight text-zinc-900">
                {dealer.company_name}
              </h3>
              <p className="text-sm text-zinc-500">{dealer.contact_person}</p>
            </div>
          </div>
          {dealer.is_approved ? (
            <Badge className="bg-green-100 text-green-800">Goedgekeurd</Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800">Wacht op goedkeuring</Badge>
          )}
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-3 text-sm">
            <FileText className="w-4 h-4 text-zinc-400" />
            <span className="text-zinc-600">KVK: {dealer.kvk_number || '-'}</span>
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
              Geregistreerd: {new Date(dealer.created_at).toLocaleDateString('nl-NL')}
            </span>
          </div>
        </div>

        {showActions && !dealer.is_approved && (
          <div className="flex gap-2 pt-4 border-t border-zinc-100">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => approveDealer(dealer.id)}
              data-testid={`approve-btn-${dealer.id}`}
            >
              <Check className="w-4 h-4 mr-2" />
              Goedkeuren
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                  data-testid={`reject-btn-${dealer.id}`}
                >
                  <X className="w-4 h-4 mr-2" />
                  Afwijzen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Dealer Afwijzen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Weet u zeker dat u {dealer.company_name} wilt afwijzen? 
                    Het account wordt permanent verwijderd.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => rejectDealer(dealer.id)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Afwijzen
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
                  <DealerCard key={dealer.id} dealer={dealer} />
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
                  <DealerCard key={dealer.id} dealer={dealer} showActions={!dealer.is_approved} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default DealerManagement;
