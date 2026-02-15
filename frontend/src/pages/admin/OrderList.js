import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  ShoppingCart,
  Check,
  X,
  Clock,
  CheckCircle,
  Printer
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const OrderList = () => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders`);
      setOrders(response.data);
    } catch (error) {
      toast.error(t('adminOrders.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId, status) => {
    try {
      await axios.put(`${API}/orders/${orderId}/status?status=${status}`);
      toast.success(t('adminOrders.statusUpdated', { status: getStatusLabel(status) }));
      fetchOrders();
    } catch (error) {
      toast.error(t('adminOrders.statusUpdateFailed'));
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800'
    };
    return <Badge className={styles[status]}>{getStatusLabel(status)}</Badge>;
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: t('order.pending'),
      approved: t('order.approved'),
      rejected: t('order.rejected'),
      completed: t('order.completed')
    };
    return labels[status];
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0
    }).format(price);
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
            {t('nav.orders')}
          </h1>
          <p className="text-zinc-500 mt-1">{orders.length} {t('orders.totalOrders')}</p>
        </div>
      </div>

      <div className="content-body" data-testid="order-list">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="empty-state">
                <ShoppingCart className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
                <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                  {t('order.noOrders')}
                </h3>
                <p className="text-zinc-500">{t('adminOrders.ordersAppearHere')}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {orders.map((order) => (
                <Card key={order.id} data-testid={`order-card-${order.id}`}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-zinc-900">{order.dealer_company}</p>
                        <p className="text-sm text-zinc-500">{order.dealer_email}</p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>
                    
                    <div className="bg-zinc-50 rounded-lg p-3 mb-3">
                      {order.motorcycle ? (
                        <>
                          <p className="font-medium text-zinc-900">
                            {order.motorcycle.brand} {order.motorcycle.model}
                          </p>
                          <p className="text-sm text-zinc-500">
                            {order.motorcycle.year} • {order.motorcycle.color}
                          </p>
                          <p className="font-barlow font-bold text-red-600 text-lg mt-1">
                            {formatPrice(order.motorcycle.price)}
                          </p>
                        </>
                      ) : (
                        <span className="text-zinc-400">{t('motorcycle.deleted')}</span>
                      )}
                    </div>
                    
                    {order.notes && (
                      <p className="text-sm text-zinc-600 mb-3 line-clamp-2">{order.notes}</p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-400">
                        {new Date(order.created_at).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                      <div className="flex gap-2">
                        {order.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => updateStatus(order.id, 'approved')}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200"
                              onClick={() => updateStatus(order.id, 'rejected')}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {order.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(order.id, 'completed')}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            {t('adminOrders.complete')}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/pakbon/${order.id}`)}
                          title={t('adminOrders.printPakbon')}
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop Table View */}
            <Card className="hidden md:block">
              <CardContent className="p-0">
                <table className="w-full data-table">
                  <thead>
                    <tr>
                      <th>{t('order.date')}</th>
                      <th>{t('nav.dealers')}</th>
                      <th>{t('motorcycle.singular')}</th>
                      <th>{t('motorcycle.price')}</th>
                      <th>{t('adminOrders.notes')}</th>
                      <th>{t('order.status')}</th>
                      <th>{t('adminOrders.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} data-testid={`order-row-${order.id}`}>
                        <td className="text-zinc-500">
                          {new Date(order.created_at).toLocaleDateString('nl-NL', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td>
                          <div>
                            <p className="font-semibold text-zinc-900">{order.dealer_company}</p>
                            <p className="text-sm text-zinc-500">{order.dealer_email}</p>
                          </div>
                        </td>
                        <td>
                          {order.motorcycle ? (
                            <div>
                              <p className="font-medium text-zinc-900">
                                {order.motorcycle.brand} {order.motorcycle.model}
                              </p>
                              <p className="text-sm text-zinc-500">
                                {order.motorcycle.year} • {order.motorcycle.color}
                              </p>
                            </div>
                          ) : (
                            <span className="text-zinc-400">{t('motorcycle.deleted')}</span>
                          )}
                        </td>
                        <td>
                          {order.motorcycle ? (
                            <span className="font-barlow font-bold text-red-600">
                              {formatPrice(order.motorcycle.price)}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="max-w-xs">
                          <p className="text-sm text-zinc-600 truncate">
                            {order.notes || '-'}
                          </p>
                        </td>
                        <td>{getStatusBadge(order.status)}</td>
                        <td>
                          <div className="flex gap-2">
                            {order.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => updateStatus(order.id, 'approved')}
                                  data-testid={`approve-btn-${order.id}`}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => updateStatus(order.id, 'rejected')}
                                  data-testid={`reject-btn-${order.id}`}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {order.status === 'approved' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatus(order.id, 'completed')}
                                data-testid={`complete-btn-${order.id}`}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                {t('adminOrders.complete')}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/pakbon/${order.id}`)}
                              data-testid={`pakbon-btn-${order.id}`}
                              title={t('adminOrders.printPakbon')}
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
};

export default OrderList;
