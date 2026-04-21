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
  Printer,
  Truck,
  Package,
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const OrderList = () => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastOrderCount, setLastOrderCount] = useState(0);
  const [autoOpenPakbon, setAutoOpenPakbon] = useState(true);
  const navigate = useNavigate();
  
  // Transport dialog state
  const [transportDialogOpen, setTransportDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [transportData, setTransportData] = useState({
    transport_status: 'pending',
    transport_carrier: '',
    transport_tracking_number: '',
    transport_estimated_delivery: '',
    transport_notes: ''
  });
  const [savingTransport, setSavingTransport] = useState(false);

  useEffect(() => {
    fetchOrders();
    
    // Poll for new orders every 30 seconds
    const interval = setInterval(() => {
      checkForNewOrders();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  const checkForNewOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders`);
      const newOrders = response.data;
      
      // Check if there are new orders
      if (lastOrderCount > 0 && newOrders.length > lastOrderCount && autoOpenPakbon) {
        // Find the newest order
        const newestOrder = newOrders[0]; // Orders are sorted by date desc
        
        // Show notification
        toast.success(`🆕 Nieuwe order: ${newestOrder.motorcycle_brand} ${newestOrder.motorcycle_model}`, {
          duration: 10000,
          action: {
            label: 'Print Pakbon',
            onClick: () => window.open(`/pakbon/${newestOrder.id}?print=true`, '_blank')
          }
        });
        
        // Auto-open pakbon in new tab
        window.open(`/pakbon/${newestOrder.id}?print=true`, '_blank');
      }
      
      setLastOrderCount(newOrders.length);
      setOrders(newOrders);
    } catch (error) {
      console.error('Error checking for new orders:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders`);
      setOrders(response.data);
      setLastOrderCount(response.data.length);
    } catch (error) {
      // Only show error if it's not a cancelled request
      if (!axios.isCancel(error)) {
        console.error('Failed to load orders:', error);
        toast.error(t('adminOrders.loadFailed'));
      }
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

  const openTransportDialog = (order) => {
    setSelectedOrder(order);
    setTransportData({
      transport_status: order.transport_status || 'pending',
      transport_carrier: order.transport_carrier || '',
      transport_tracking_number: order.transport_tracking_number || '',
      transport_estimated_delivery: order.transport_estimated_delivery || '',
      transport_notes: order.transport_notes || ''
    });
    setTransportDialogOpen(true);
  };

  const saveTransportStatus = async () => {
    if (!selectedOrder) return;
    
    setSavingTransport(true);
    try {
      await axios.put(`${API}/orders/${selectedOrder.id}/transport`, transportData);
      toast.success('Transport status bijgewerkt');
      setTransportDialogOpen(false);
      fetchOrders();
    } catch (error) {
      toast.error('Kon transport status niet bijwerken');
    } finally {
      setSavingTransport(false);
    }
  };

  const getTransportStatusLabel = (status) => {
    const labels = {
      pending: 'Wachtend',
      picked_up: 'Opgehaald',
      in_transit: 'Onderweg',
      delivered: 'Afgeleverd'
    };
    return labels[status] || status;
  };

  const getTransportBadge = (status) => {
    const styles = {
      pending: 'bg-zinc-100 text-zinc-700',
      picked_up: 'bg-amber-100 text-amber-700',
      in_transit: 'bg-blue-100 text-blue-700',
      delivered: 'bg-green-100 text-green-700'
    };
    return <Badge className={styles[status] || 'bg-zinc-100'}>{getTransportStatusLabel(status)}</Badge>;
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
        
        {/* Auto-print toggle */}
        <div className="flex items-center gap-3">
          <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all ${autoOpenPakbon ? 'border-green-500 bg-green-50' : 'border-zinc-200'}`}>
            <input
              type="checkbox"
              checked={autoOpenPakbon}
              onChange={(e) => {
                setAutoOpenPakbon(e.target.checked);
                toast.success(e.target.checked ? '🖨️ Auto-print AAN' : '🖨️ Auto-print UIT');
              }}
              className="w-4 h-4 rounded"
            />
            <Printer className={`w-4 h-4 ${autoOpenPakbon ? 'text-green-600' : 'text-zinc-400'}`} />
            <span className={`text-sm font-medium ${autoOpenPakbon ? 'text-green-700' : 'text-zinc-500'}`}>
              Auto-print pakbon
            </span>
          </label>
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
                          {order.motorcycle.original_price && (
                            <p className="text-xs text-zinc-500 mt-0.5">
                              Lev: {order.motorcycle.original_currency === 'CHF' 
                                ? `CHF ${order.motorcycle.original_price.toLocaleString('nl-NL')}` 
                                : formatPrice(order.motorcycle.original_price)}
                            </p>
                          )}
                          {/* Order options badges */}
                          <div className="flex flex-wrap gap-1 mt-2" data-testid={`order-options-${order.id}`}>
                            {order.needs_coc && (
                              <Badge className="bg-purple-100 text-purple-800 text-xs">
                                COC/CVO €{order.coc_cost || 0}
                              </Badge>
                            )}
                            {order.needs_inspection && (
                              <Badge className="bg-blue-100 text-blue-800 text-xs">Keuring €{order.inspection_cost || 125}</Badge>
                            )}
                            {order.needs_valuation && (
                              <Badge className="bg-amber-100 text-amber-800 text-xs">Taxatie €{order.valuation_cost || 160}</Badge>
                            )}
                            {order.needs_delivery && (
                              <Badge className="bg-zinc-100 text-zinc-800 text-xs">Bezorging €{order.delivery_cost || 50}</Badge>
                            )}
                          </div>
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
                        {order.needs_delivery && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-600 border-blue-200"
                            onClick={() => openTransportDialog(order)}
                            title="Transport status"
                          >
                            <Truck className="w-4 h-4" />
                          </Button>
                        )}
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
                              <div className="flex flex-wrap gap-1 mt-1">
                                {order.needs_coc && (
                                  <Badge className="bg-purple-100 text-purple-800 text-xs" data-testid={`coc-badge-${order.id}`}>
                                    COC €{order.coc_cost || 0}
                                  </Badge>
                                )}
                                {order.needs_inspection && (
                                  <Badge className="bg-blue-100 text-blue-800 text-xs">Keur</Badge>
                                )}
                                {order.needs_valuation && (
                                  <Badge className="bg-amber-100 text-amber-800 text-xs">Tax</Badge>
                                )}
                                {order.needs_delivery && (
                                  <Badge className="bg-zinc-100 text-zinc-800 text-xs">Bezorg</Badge>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-zinc-400">{t('motorcycle.deleted')}</span>
                          )}
                        </td>
                        <td>
                          {order.motorcycle ? (
                            <div>
                              <span className="font-barlow font-bold text-red-600">
                                {formatPrice(order.motorcycle.price)}
                              </span>
                              {order.motorcycle.original_price && (
                                <p className="text-xs text-zinc-500 mt-0.5">
                                  Lev: {order.motorcycle.original_currency === 'CHF' 
                                    ? `CHF ${order.motorcycle.original_price.toLocaleString('nl-NL')}` 
                                    : formatPrice(order.motorcycle.original_price)}
                                </p>
                              )}
                            </div>
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
                            {order.needs_delivery && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600 border-blue-200"
                                onClick={() => openTransportDialog(order)}
                                title="Transport status"
                              >
                                <Truck className="w-4 h-4" />
                              </Button>
                            )}
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

      {/* Transport Status Dialog */}
      <Dialog open={transportDialogOpen} onOpenChange={setTransportDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-600" />
              Transport Status Bijwerken
            </DialogTitle>
            <DialogDescription>
              {selectedOrder?.motorcycle_brand} {selectedOrder?.motorcycle_model} - {selectedOrder?.dealer_company}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Status Select */}
            <div className="space-y-2">
              <Label>Transport Status</Label>
              <Select
                value={transportData.transport_status}
                onValueChange={(value) => setTransportData({...transportData, transport_status: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Wachtend op transport
                    </span>
                  </SelectItem>
                  <SelectItem value="picked_up">
                    <span className="flex items-center gap-2">
                      <Package className="w-4 h-4" /> Opgehaald door transporteur
                    </span>
                  </SelectItem>
                  <SelectItem value="in_transit">
                    <span className="flex items-center gap-2">
                      <Truck className="w-4 h-4" /> Onderweg
                    </span>
                  </SelectItem>
                  <SelectItem value="delivered">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Afgeleverd
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Carrier */}
            <div className="space-y-2">
              <Label>Transporteur</Label>
              <Input
                placeholder="Bijv. DHL, PostNL, eigen transport..."
                value={transportData.transport_carrier}
                onChange={(e) => setTransportData({...transportData, transport_carrier: e.target.value})}
              />
            </div>

            {/* Tracking Number */}
            <div className="space-y-2">
              <Label>Trackingnummer (optioneel)</Label>
              <Input
                placeholder="Track & trace code"
                value={transportData.transport_tracking_number}
                onChange={(e) => setTransportData({...transportData, transport_tracking_number: e.target.value})}
              />
            </div>

            {/* Estimated Delivery */}
            <div className="space-y-2">
              <Label>Verwachte leverdatum</Label>
              <Input
                type="date"
                value={transportData.transport_estimated_delivery}
                onChange={(e) => setTransportData({...transportData, transport_estimated_delivery: e.target.value})}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Opmerkingen</Label>
              <Textarea
                placeholder="Extra informatie over het transport..."
                value={transportData.transport_notes}
                onChange={(e) => setTransportData({...transportData, transport_notes: e.target.value})}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTransportDialogOpen(false)}>
              Annuleren
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={saveTransportStatus}
              disabled={savingTransport}
            >
              {savingTransport ? 'Opslaan...' : 'Opslaan & Email Versturen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default OrderList;
