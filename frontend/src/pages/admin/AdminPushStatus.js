import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  Bell,
  BellOff,
  CheckCircle,
  XCircle,
  PauseCircle,
  RefreshCw,
  Search,
  Smartphone,
  Monitor,
  Send,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminPushStatus = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    fetchPushStatus();
  }, []);

  const fetchPushStatus = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API}/admin/push-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (error) {
      toast.error('Fout bij ophalen push status');
    } finally {
      setLoading(false);
    }
  };

  const sendTestPush = async () => {
    setSendingTest(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API}/admin/test-push`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Test push verzonden naar ${res.data.sent_count} dealers`);
      fetchPushStatus(); // Refresh data
    } catch (error) {
      toast.error('Fout bij verzenden test push');
    } finally {
      setSendingTest(false);
    }
  };

  const filteredDealers = data?.dealers?.filter(dealer => {
    const search = searchTerm.toLowerCase();
    return (
      dealer.company_name.toLowerCase().includes(search) ||
      dealer.email.toLowerCase().includes(search)
    );
  }) || [];

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'no_subscription':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'offline':
        return <PauseCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status, statusText) => {
    const variants = {
      active: 'bg-green-100 text-green-800 border-green-200',
      no_subscription: 'bg-red-100 text-red-800 border-red-200',
      offline: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };
    return (
      <Badge variant="outline" className={variants[status] || ''}>
        {statusText}
      </Badge>
    );
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
              Push Notificatie Status
            </h1>
            <p className="text-zinc-500 mt-1">Overzicht van alle dealers en hun push status</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={fetchPushStatus}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Vernieuwen
            </Button>
            <Button 
              onClick={sendTestPush}
              disabled={sendingTest}
              className="bg-red-600 hover:bg-red-700"
            >
              <Send className={`w-4 h-4 mr-2 ${sendingTest ? 'animate-pulse' : ''}`} />
              {sendingTest ? 'Verzenden...' : 'Test Push Sturen'}
            </Button>
          </div>
        </div>
      </div>

      <div className="content-body" data-testid="admin-push-status">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-100 rounded-lg">
                  <Bell className="w-5 h-5 text-zinc-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-zinc-900">{data?.total_dealers || 0}</p>
                  <p className="text-sm text-zinc-500">Totaal Dealers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{data?.active_push || 0}</p>
                  <p className="text-sm text-zinc-500">Push Actief</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <BellOff className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{data?.no_subscription || 0}</p>
                  <p className="text-sm text-zinc-500">Geen Push</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <PauseCircle className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{data?.offline || 0}</p>
                  <p className="text-sm text-zinc-500">Offline</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              placeholder="Zoek op bedrijfsnaam of email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Dealers List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dealers ({filteredDealers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {filteredDealers.map((dealer) => (
                <div key={dealer.id} className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getStatusIcon(dealer.status)}
                    <div>
                      <p className="font-semibold text-zinc-900">{dealer.company_name}</p>
                      <p className="text-sm text-zinc-500">{dealer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {dealer.valid_subscriptions > 0 && (
                      <div className="flex items-center gap-1 text-sm text-zinc-500">
                        <Smartphone className="w-4 h-4" />
                        <span>{dealer.valid_subscriptions}</span>
                      </div>
                    )}
                    {getStatusBadge(dealer.status, dealer.status_text)}
                  </div>
                </div>
              ))}

              {filteredDealers.length === 0 && (
                <div className="py-8 text-center text-zinc-500">
                  Geen dealers gevonden
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="mt-6 p-4 bg-zinc-50 rounded-lg">
          <p className="font-semibold text-sm text-zinc-700 mb-2">Legenda:</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Push actief - ontvangt meldingen</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span>Geen push - moet inschakelen in app</span>
            </div>
            <div className="flex items-center gap-2">
              <PauseCircle className="w-4 h-4 text-yellow-500" />
              <span>Offline - ontvangt geen meldingen</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminPushStatus;
