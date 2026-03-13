import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import axios from 'axios';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Printer, Search, Package, Bike, Calendar, Building } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PakbonDashboard = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data);
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
                {searchTerm ? 'Geen resultaten' : 'Geen bestellingen'}
              </h3>
              <p className="text-zinc-500">
                {searchTerm ? 'Probeer een andere zoekterm' : 'Er zijn nog geen bestellingen.'}
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
                            {moto.chassis_number && (
                              <span className="font-mono text-xs">VIN: {moto.chassis_number}</span>
                            )}
                            {order.needs_delivery && (
                              <Badge className="bg-blue-100 text-blue-700 text-xs">Bezorging</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Print button */}
                      <Button
                        onClick={() => window.open(`/pakbon/${order.id}?print=true`, '_blank')}
                        className="bg-red-600 hover:bg-red-700 gap-2"
                        data-testid={`print-pakbon-${order.id}`}
                      >
                        <Printer className="w-4 h-4" />
                        Print Pakbon
                      </Button>
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
