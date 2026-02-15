import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
      toast.error('Kon bestellingen niet laden');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId, status) => {
    try {
      await axios.put(`${API}/orders/${orderId}/status?status=${status}`);
      toast.success(`Status bijgewerkt naar ${getStatusLabel(status)}`);
      fetchOrders();
    } catch (error) {
      toast.error('Kon status niet bijwerken');
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
      pending: 'In afwachting',
      approved: 'Goedgekeurd',
      rejected: 'Afgewezen',
      completed: 'Voltooid'
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
            Bestellingen
          </h1>
          <p className="text-zinc-500 mt-1">{orders.length} bestellingen totaal</p>
        </div>
      </div>

      <div className="content-body" data-testid="order-list">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="empty-state">
                <ShoppingCart className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
                <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                  Nog geen bestellingen
                </h3>
                <p className="text-zinc-500">Bestellingen van dealers verschijnen hier</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Dealer</th>
                    <th>Motor</th>
                    <th>Prijs</th>
                    <th>Notities</th>
                    <th>Status</th>
                    <th>Acties</th>
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
                          <span className="text-zinc-400">Motor verwijderd</span>
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
                        {order.status === 'pending' && (
                          <div className="flex gap-2">
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
                          </div>
                        )}
                        {order.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(order.id, 'completed')}
                            data-testid={`complete-btn-${order.id}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Voltooien
                          </Button>
                        )}
                        {(order.status === 'rejected' || order.status === 'completed') && (
                          <span className="text-sm text-zinc-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default OrderList;
