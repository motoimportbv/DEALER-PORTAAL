import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { 
  Package,
  Truck,
  MapPin,
  CheckCircle,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminPartOrders = () => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/parts/orders`);
      setOrders(response.data);
    } catch (error) {
      toast.error(t('messages.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId, status) => {
    try {
      await axios.put(`${API}/parts/orders/${orderId}/status?status=${status}`);
      toast.success('Status bijgewerkt');
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('messages.errorOccurred'));
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(price);
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

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-800',
      paid: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    const labels = {
      pending: t('parts.statusPending'),
      paid: t('parts.statusPaid'),
      shipped: t('parts.statusShipped'),
      completed: t('parts.statusCompleted'),
      cancelled: t('parts.statusCancelled')
    };
    return <Badge className={styles[status]}>{labels[status] || status}</Badge>;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5 text-amber-600" />;
      case 'paid': return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case 'shipped': return <Truck className="w-5 h-5 text-purple-600" />;
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'cancelled': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Clock className="w-5 h-5 text-zinc-400" />;
    }
  };

  if (loading) {
    return (
      <Layout requiredRole="admin">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requiredRole="admin">
      <div className="content-header">
        <div>
          <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
            {t('admin.partOrders')}
          </h1>
          <p className="text-zinc-500 mt-1">{orders.length} {t('parts.orders')}</p>
        </div>
      </div>

      <div className="content-body" data-testid="admin-part-orders">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Package className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
              <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                {t('parts.noOrders')}
              </h3>
              <p className="text-zinc-500">{t('parts.noOrdersYet')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} data-testid={`order-${order.id}`}>
                <CardContent className="p-0">
                  {/* Order header */}
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-50"
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  >
                    <div className="flex items-center gap-4">
                      {getStatusIcon(order.status)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-barlow font-bold text-lg">{order.order_number}</span>
                          {getStatusBadge(order.status)}
                        </div>
                        <p className="text-sm text-zinc-500">
                          {order.dealer_company} • {formatDate(order.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-barlow text-xl font-bold text-red-600">{formatPrice(order.total)}</p>
                        <p className="text-xs text-zinc-500">
                          {order.shipping_cost > 0 ? (
                            <span className="flex items-center gap-1">
                              <Truck className="w-3 h-3" /> {t('parts.shipping')}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {t('parts.pickup')}
                            </span>
                          )}
                        </p>
                      </div>
                      {expandedOrder === order.id ? (
                        <ChevronUp className="w-5 h-5 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-zinc-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedOrder === order.id && (
                    <div className="border-t p-4 bg-zinc-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Order items */}
                        <div>
                          <h4 className="font-semibold text-zinc-900 mb-3">{t('parts.orderItems')}</h4>
                          <div className="space-y-2">
                            {order.items.map((item, index) => (
                              <div key={index} className="flex justify-between text-sm">
                                <span>
                                  {item.part_name} 
                                  {item.sku && <span className="text-zinc-400 ml-1">({item.sku})</span>}
                                  <span className="text-zinc-500 ml-2">x{item.quantity}</span>
                                </span>
                                <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
                              </div>
                            ))}
                            <div className="border-t pt-2 mt-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-zinc-500">{t('parts.subtotal')}</span>
                                <span>{formatPrice(order.subtotal)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-zinc-500">{t('parts.shipping')}</span>
                                <span>{order.shipping_cost > 0 ? formatPrice(order.shipping_cost) : t('parts.free')}</span>
                              </div>
                              <div className="flex justify-between font-bold mt-1">
                                <span>{t('parts.total')}</span>
                                <span className="text-red-600">{formatPrice(order.total)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Customer info & status */}
                        <div>
                          <h4 className="font-semibold text-zinc-900 mb-3">{t('parts.customerInfo')}</h4>
                          <div className="text-sm space-y-1 mb-4">
                            <p className="font-medium">{order.dealer_company}</p>
                            <p className="text-zinc-500">{order.dealer_email}</p>
                            {order.dealer_address && (
                              <p className="text-zinc-500">
                                {order.dealer_address}<br />
                                {order.dealer_postal_code} {order.dealer_city}
                              </p>
                            )}
                            {order.dealer_phone && (
                              <p className="text-zinc-500">{order.dealer_phone}</p>
                            )}
                          </div>

                          <h4 className="font-semibold text-zinc-900 mb-2">{t('parts.updateStatus')}</h4>
                          <Select 
                            value={order.status} 
                            onValueChange={(value) => updateStatus(order.id, value)}
                          >
                            <SelectTrigger className="w-full" data-testid={`status-select-${order.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">{t('parts.statusPending')}</SelectItem>
                              <SelectItem value="paid">{t('parts.statusPaid')}</SelectItem>
                              <SelectItem value="shipped">{t('parts.statusShipped')}</SelectItem>
                              <SelectItem value="completed">{t('parts.statusCompleted')}</SelectItem>
                              <SelectItem value="cancelled">{t('parts.statusCancelled')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminPartOrders;
