import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  ShoppingCart,
  Eye,
  Bike,
  CreditCard,
  Truck,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DealerOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders`);
      setOrders(response.data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status, paymentStatus) => {
    if (paymentStatus === 'paid') {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Betaald
        </Badge>
      );
    }
    
    const styles = {
      pending: 'bg-amber-100 text-amber-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800'
    };
    const labels = {
      pending: 'In afwachting',
      approved: 'Goedgekeurd',
      rejected: 'Afgewezen',
      completed: 'Voltooid',
      paid: 'Betaald'
    };
    return <Badge className={styles[status] || 'bg-zinc-100 text-zinc-800'}>{labels[status] || status}</Badge>;
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0
    }).format(price || 0);
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
        <div>
          <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
            Mijn Bestellingen
          </h1>
          <p className="text-zinc-500 mt-1">{orders.length} bestellingen totaal</p>
        </div>
      </div>

      <div className="content-body" data-testid="dealer-orders">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="empty-state">
                <ShoppingCart className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
                <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                  Nog geen bestellingen
                </h3>
                <p className="text-zinc-500 mb-6">Bekijk beschikbare motoren en plaats uw eerste bestelling</p>
                <Link to="/dealer">
                  <Button className="bg-red-600 hover:bg-red-700">
                    <Bike className="w-5 h-5 mr-2" />
                    Bekijk Motoren
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} className="overflow-hidden" data-testid={`order-card-${order.id}`}>
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    {/* Image */}
                    <div className="w-full md:w-48 h-48 md:h-auto bg-zinc-100 flex-shrink-0">
                      {order.motorcycle?.images?.[0] ? (
                        <img 
                          src={order.motorcycle.images[0]} 
                          alt={`${order.motorcycle?.brand} ${order.motorcycle?.model}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Bike className="w-12 h-12 text-zinc-300" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-6">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div>
                          {order.motorcycle ? (
                            <>
                              <h3 className="font-barlow text-xl font-bold uppercase tracking-tight text-zinc-900">
                                {order.motorcycle.brand} {order.motorcycle.model}
                              </h3>
                              <p className="text-zinc-500 mb-2">
                                {order.motorcycle.year} • {order.motorcycle.mileage?.toLocaleString('nl-NL')} km • {order.motorcycle.color}
                              </p>
                            </>
                          ) : (
                            <p className="text-zinc-400">Motor niet meer beschikbaar</p>
                          )}
                        </div>
                        
                        <div className="flex flex-col items-start md:items-end gap-2">
                          {getStatusBadge(order.status, order.payment_status)}
                          <p className="text-sm text-zinc-500">
                            Besteld op {new Date(order.created_at).toLocaleDateString('nl-NL', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Payment Details */}
                      <div className="mt-4 p-4 bg-zinc-50 rounded-lg">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-zinc-500 uppercase">Totaalprijs</p>
                            <p className="font-barlow text-lg font-bold text-zinc-900">
                              {formatPrice(order.total_price || order.motorcycle?.price)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 uppercase flex items-center gap-1">
                              <CreditCard className="w-3 h-3" />
                              Aanbetaling
                            </p>
                            <p className="font-barlow text-lg font-bold text-green-600">
                              {formatPrice(order.deposit_amount)}
                              {order.payment_status === 'paid' && <CheckCircle className="w-4 h-4 inline ml-1" />}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 uppercase flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Restbedrag
                            </p>
                            <p className="font-barlow text-lg font-bold text-red-600">
                              {formatPrice((order.total_price || order.motorcycle?.price || 0) - (order.deposit_amount || 0))}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 uppercase flex items-center gap-1">
                              <Truck className="w-3 h-3" />
                              Bezorging
                            </p>
                            <p className="font-semibold text-zinc-700">
                              {order.needs_delivery ? '€50 (bezorgen)' : 'Gratis (ophalen)'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Bank info reminder for paid orders */}
                      {order.payment_status === 'paid' && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm text-amber-800 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>
                              <strong>Restbedrag:</strong> Maak {formatPrice((order.total_price || 0) - (order.deposit_amount || 0))} binnen 5 werkdagen over naar <strong>NL23 INGB 0107 0760 63</strong> t.n.v. Moto Import B.V. met kenmerk <strong>{order.id?.slice(0, 8).toUpperCase()}</strong>
                            </span>
                          </p>
                        </div>
                      )}

                      {order.notes && (
                        <div className="mt-4 p-3 bg-zinc-50 rounded-lg">
                          <p className="text-sm text-zinc-600">
                            <span className="font-semibold">Uw notitie:</span> {order.notes}
                          </p>
                        </div>
                      )}

                      {order.motorcycle && (
                        <div className="mt-4">
                          <Link to={`/motorcycle/${order.motorcycle.id}`}>
                            <Button variant="outline" data-testid={`view-motorcycle-btn-${order.id}`}>
                              <Eye className="w-4 h-4 mr-2" />
                              Bekijk Motor
                            </Button>
                          </Link>
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
    </Layout>
  );
};

export default DealerOrders;
