import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import axios from 'axios';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Printer, Search, Package, Bike, Calendar, Building, CheckCircle, FolderOpen, FolderCheck } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PakbonDashboard = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState('open');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const sorted = response.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setOrders(sorted);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredOrders = orders.filter(order => {
    const isCompleted = !!order.pakbon_completed;
    if (tab === 'open' && isCompleted) return false;
    if (tab === 'done' && !isCompleted) return false;

    const search = searchTerm.toLowerCase();
    const moto = order.motorcycle || {};
    return (
      (moto.brand || '').toLowerCase().includes(search) ||
      (moto.model || '').toLowerCase().includes(search) ||
      (order.dealer_company || '').toLowerCase().includes(search) ||
      (order.id || '').toLowerCase().includes(search) ||
      (moto.chassis_number || '').toLowerCase().includes(search)
    );
  });

  const openCount = orders.filter(o => !o.pakbon_completed).length;
  const doneCount = orders.filter(o => !!o.pakbon_completed).length;

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
        <div>
          <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900" data-testid="pakbon-dashboard-title">
            Pakbonnen
          </h1>
          <p className="text-zinc-500 mt-1">{orders.length} bestellingen</p>
        </div>
      </div>

      <div className="content-body" data-testid="pakbon-dashboard">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={tab === 'open' ? 'default' : 'outline'}
            onClick={() => setTab('open')}
            className={tab === 'open' ? 'bg-red-600 hover:bg-red-700 gap-2' : 'gap-2'}
            data-testid="tab-open"
          >
            <FolderOpen className="w-4 h-4" />
            Openstaand ({openCount})
          </Button>
          <Button
            variant={tab === 'done' ? 'default' : 'outline'}
            onClick={() => setTab('done')}
            className={tab === 'done' ? 'bg-green-600 hover:bg-green-700 gap-2' : 'gap-2'}
            data-testid="tab-done"
          >
            <FolderCheck className="w-4 h-4" />
            Afgehandeld ({doneCount})
          </Button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              placeholder="Zoek op merk, model, dealer, chassisnummer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="pakbon-search"
            />
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                {searchTerm ? 'Geen resultaten' : tab === 'done' ? 'Nog geen afgehandelde pakbonnen' : 'Geen openstaande pakbonnen'}
              </h3>
              <p className="text-zinc-500">
                {searchTerm ? 'Probeer een andere zoekterm' : tab === 'done' ? 'Voltooide pakbonnen verschijnen hier.' : 'Er zijn geen openstaande bestellingen.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredOrders.map((order) => {
              const moto = order.motorcycle || {};
              return (
                <Card key={order.id} className="hover:shadow-md transition-shadow" data-testid={`pakbon-order-${order.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        {/* Order ID */}
                        <div className="text-center min-w-[80px]">
                          <p className="font-mono font-bold text-lg text-zinc-900">
                            {order.id.slice(0, 8).toUpperCase()}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-zinc-400 mt-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(order.created_at)}
                          </div>
                        </div>

                        <div className="h-12 w-px bg-zinc-200"></div>

                        {/* Motor info */}
                        <div>
                          <div className="flex items-center gap-2">
                            <Bike className="w-4 h-4 text-zinc-400" />
                            <span className="font-semibold text-zinc-900">
                              {moto.brand} {moto.model}
                            </span>
                            {moto.year && (
                              <Badge variant="outline" className="text-xs">{moto.year}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-zinc-500">
                            <div className="flex items-center gap-1">
                              <Building className="w-3.5 h-3.5" />
                              {order.dealer_company || 'Onbekend'}
                            </div>
                            {(order.motorcycle_license_plate || moto.license_plate) && (
                              <Badge className="bg-amber-100 text-amber-800 text-xs font-mono font-bold">
                                {order.motorcycle_license_plate || moto.license_plate}
                              </Badge>
                            )}
                            {moto.chassis_number && (
                              <span className="font-mono text-xs">VIN: {moto.chassis_number}</span>
                            )}
                            {order.needs_delivery && (
                              <Badge className="bg-blue-100 text-blue-700 text-xs">Bezorging</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status + Print button */}
                      <div className="flex items-center gap-3">
                        {order.pakbon_completed && (
                          <Badge className="bg-green-100 text-green-700 gap-1" data-testid={`pakbon-done-${order.id}`}>
                            <CheckCircle className="w-3.5 h-3.5" />
                            Voltooid
                          </Badge>
                        )}
                        <Button
                          onClick={() => window.open(`/pakbon/${order.id}`, '_blank')}
                          className={order.pakbon_completed ? "bg-zinc-500 hover:bg-zinc-600 gap-2" : "bg-red-600 hover:bg-red-700 gap-2"}
                          data-testid={`print-pakbon-${order.id}`}
                        >
                          <Printer className="w-4 h-4" />
                          {order.pakbon_completed ? 'Bekijken' : 'Print Pakbon'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PakbonDashboard;
