import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Layout from '../../components/Layout';
import { useDataRefresh } from '../../components/DataRefreshProvider';
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
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Trash2,
  Archive,
  FolderArchive,
  RefreshCw,
  Package,
  MapPin,
  FileText
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DealerOrders = () => {
  const { t } = useTranslation();
  const { refreshTrigger } = useDataRefresh();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [orderToArchive, setOrderToArchive] = useState(null);
  const [archiving, setArchiving] = useState(false);

  const openLightbox = (images, index = 0) => {
    if (images && images.length > 0) {
      setLightboxImages(images);
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
  };

  const nextImage = () => {
    setLightboxIndex((prev) => (prev + 1) % lightboxImages.length);
  };

  const prevImage = () => {
    setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length);
  };

  // Fetch orders functie - kan worden hergebruikt voor refresh
  const fetchOrders = useCallback(async (showToast = false) => {
    try {
      if (showToast) setIsRefreshing(true);
      const response = await axios.get(`${API}/orders`);
      setOrders(response.data);
      if (showToast) {
        toast.success('Bestellingen bijgewerkt');
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Auto-refresh wanneer er updates zijn via DataRefreshProvider
  useEffect(() => {
    if (refreshTrigger > 0 && !loading) {
      fetchOrders(false);
    }
  }, [refreshTrigger, loading, fetchOrders]);

  // Auto-refresh when tab/app becomes visible again
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchOrders(false); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); };
  }, [fetchOrders]);

  // Handmatige refresh functie
  const handleManualRefresh = () => {
    fetchOrders(true);
  };

  const handleDeleteClick = (order) => {
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    
    setDeleting(true);
    try {
      await axios.delete(`${API}/orders/${orderToDelete.id}`);
      setOrders(orders.filter(o => o.id !== orderToDelete.id));
      toast.success(t('messages.successDeleted'));
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
    } catch (error) {
      console.error('Failed to delete order:', error);
      toast.error(t('orders.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const handleArchiveClick = (order) => {
    setOrderToArchive(order);
    setArchiveDialogOpen(true);
  };

  const handleConfirmArchive = async () => {
    if (!orderToArchive) return;
    
    setArchiving(true);
    try {
      await axios.put(`${API}/orders/${orderToArchive.id}/archive`);
      setOrders(orders.filter(o => o.id !== orderToArchive.id));
      toast.success(t('orders.archiveSuccess'));
      setArchiveDialogOpen(false);
      setOrderToArchive(null);
    } catch (error) {
      console.error('Failed to archive order:', error);
      toast.error(t('orders.archiveFailed'));
    } finally {
      setArchiving(false);
    }
  };

  const getStatusBadge = (status, paymentStatus) => {
    if (paymentStatus === 'paid') {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          {t('order.paid')}
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
      pending: t('order.pending'),
      approved: t('order.approved'),
      rejected: t('order.rejected'),
      completed: t('order.completed'),
      paid: t('order.paid')
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
              {t('nav.myOrders')}
            </h1>
            <p className="text-zinc-500 mt-1">{orders.length} {t('orders.totalOrders')}</p>
          </div>
          <div className="flex gap-2">
            {/* Refresh Button */}
            <Button 
              variant="outline" 
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="text-zinc-600"
              data-testid="refresh-orders-btn"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Laden...' : 'Vernieuwen'}
            </Button>
            <Link to="/dealer/orders/archived">
              <Button variant="outline" data-testid="view-archived-orders-btn">
                <FolderArchive className="w-4 h-4 mr-2" />
                {t('orders.viewArchivedOrders')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="content-body" data-testid="dealer-orders">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="empty-state">
                <ShoppingCart className="w-20 h-20 mx-auto mb-4 text-zinc-300" />
                <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">
                  {t('order.noOrders')}
                </h3>
                <p className="text-zinc-500 mb-6">{t('orders.viewMotorcycles')}</p>
                <Link to="/dealer">
                  <Button className="bg-red-600 hover:bg-red-700">
                    <Bike className="w-5 h-5 mr-2" />
                    {t('orders.viewMotorcyclesBtn')}
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
                    {/* Image - Clickable */}
                    <div 
                      className="w-full md:w-48 h-48 md:h-auto bg-zinc-100 flex-shrink-0 relative group cursor-pointer"
                      onClick={() => openLightbox(order.motorcycle?.images, 0)}
                    >
                      {order.motorcycle?.images?.[0] ? (
                        <>
                          <img 
                            src={order.motorcycle.images[0]} 
                            alt={`${order.motorcycle?.brand} ${order.motorcycle?.model}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          {order.motorcycle?.images?.length > 1 && (
                            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                              +{order.motorcycle.images.length - 1} foto's
                            </div>
                          )}
                        </>
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
                              {/mundi/i.test(order.motorcycle?.foreign_dealer_company || order.motorcycle_snapshot?.foreign_dealer_company || '') && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded-md text-xs font-semibold mb-2" data-testid={`eu-badge-${order.id}`}>
                                  🇪🇺 EU-model — geen keuring
                                </span>
                              )}
                            </>
                          ) : (
                            <p className="text-zinc-400">{t('motorcycle.deleted')}</p>
                          )}
                        </div>
                        
                        <div className="flex flex-col items-start md:items-end gap-2">
                          {getStatusBadge(order.status, order.payment_status)}
                          <p className="text-sm text-zinc-500">
                            {t('orders.orderedOn')} {new Date(order.created_at).toLocaleDateString('nl-NL', {
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
                            <p className="text-xs text-zinc-500 uppercase">{t('order.totalPrice')}</p>
                            <p className="font-barlow text-lg font-bold text-zinc-900">
                              {formatPrice(order.total_price || order.motorcycle?.price)}
                            </p>
                            {/* Show discount if price proposal was accepted */}
                            {order.order_type === 'price_proposal' && order.discount_amount > 0 && (
                              <p className="text-xs text-green-600 font-medium">
                                💰 Korting: -{formatPrice(order.discount_amount)}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 uppercase flex items-center gap-1">
                              <CreditCard className="w-3 h-3" />
                              {t('orders.deposit')}
                            </p>
                            <p className="font-barlow text-lg font-bold text-green-600">
                              {formatPrice(order.deposit_amount)}
                              {order.payment_status === 'paid' && <CheckCircle className="w-4 h-4 inline ml-1" />}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 uppercase flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {t('orders.remainingAmount')}
                            </p>
                            <p className="font-barlow text-lg font-bold text-red-600">
                              {formatPrice((order.total_price || order.motorcycle?.price || 0) - (order.deposit_amount || 0))}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 uppercase flex items-center gap-1">
                              <Truck className="w-3 h-3" />
                              {t('order.delivery')}
                            </p>
                            <p className="font-semibold text-zinc-700">
                              {order.needs_delivery ? t('orders.deliveryPrice') : t('orders.pickupFree')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* COC / CVO Status Section */}
                      {order.needs_coc && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl" data-testid={`coc-status-${order.id}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <FileText className="w-5 h-5 text-purple-600" />
                              <h4 className="font-semibold text-purple-900">COC / CVO Status</h4>
                            </div>
                            <span className="text-sm font-bold text-purple-700">€{order.coc_cost || 0}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            {[
                              { key: 'requested', label: 'Aangevraagd' },
                              { key: 'ordered_from_supplier', label: 'Besteld' },
                              { key: 'coc_received', label: 'Ontvangen' },
                              { key: 'sent_to_dealer', label: 'Verzonden' }
                            ].map((step) => {
                              const order_idx = ['requested', 'ordered_from_supplier', 'coc_received', 'sent_to_dealer'].indexOf(order.coc_status || 'requested');
                              const step_idx = ['requested', 'ordered_from_supplier', 'coc_received', 'sent_to_dealer'].indexOf(step.key);
                              const isActive = step_idx <= order_idx;
                              const isCurrent = step_idx === order_idx;
                              return (
                                <div key={step.key} className="flex-1 text-center">
                                  <div className={`h-2 rounded-full mb-1 ${isActive ? 'bg-purple-600' : 'bg-zinc-200'} ${isCurrent ? 'ring-2 ring-purple-300' : ''}`}></div>
                                  <p className={`text-xs ${isActive ? 'font-semibold text-purple-900' : 'text-zinc-400'}`}>{step.label}</p>
                                </div>
                              );
                            })}
                          </div>
                          {/* Download button when PDF available */}
                          {order.coc_pdf_filename && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await axios.get(`${API}/orders/${order.id}/coc-pdf`, {
                                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                                    responseType: 'blob'
                                  });
                                  const url = window.URL.createObjectURL(new Blob([res.data]));
                                  const link = document.createElement('a');
                                  link.href = url;
                                  link.setAttribute('download', order.coc_pdf_filename || `coc_${order.id.slice(0,8)}.pdf`);
                                  document.body.appendChild(link);
                                  link.click();
                                  link.remove();
                                  window.URL.revokeObjectURL(url);
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
                              className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
                              data-testid={`coc-pdf-dealer-download-${order.id}`}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Download COC/CVO PDF
                            </button>
                          )}
                        </div>
                      )}

                      {/* Transport Tracking Section */}
                      {order.needs_delivery && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                          <div className="flex items-center gap-2 mb-3">
                            <Package className="w-5 h-5 text-blue-600" />
                            <h4 className="font-semibold text-blue-900">Transport Status</h4>
                          </div>
                          
                          {/* Status Progress Bar */}
                          <div className="flex items-center justify-between mb-4">
                            {[
                              { key: 'pending', label: 'Wachtend', icon: Clock },
                              { key: 'picked_up', label: 'Opgehaald', icon: Package },
                              { key: 'in_transit', label: 'Onderweg', icon: Truck },
                              { key: 'delivered', label: 'Afgeleverd', icon: CheckCircle }
                            ].map((step, index) => {
                              const currentIndex = ['pending', 'picked_up', 'in_transit', 'delivered'].indexOf(order.transport_status || 'pending');
                              const stepIndex = ['pending', 'picked_up', 'in_transit', 'delivered'].indexOf(step.key);
                              const isActive = stepIndex <= currentIndex;
                              const isCurrent = stepIndex === currentIndex;
                              const Icon = step.icon;
                              
                              return (
                                <div key={step.key} className="flex flex-col items-center flex-1">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-all ${
                                    isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-200' :
                                    isActive ? 'bg-blue-600 text-white' : 'bg-zinc-200 text-zinc-400'
                                  }`}>
                                    <Icon className="w-5 h-5" />
                                  </div>
                                  <span className={`text-xs font-medium ${isActive ? 'text-blue-700' : 'text-zinc-400'}`}>
                                    {step.label}
                                  </span>
                                  {index < 3 && (
                                    <div className={`absolute h-1 w-full -z-10 ${isActive && stepIndex < currentIndex ? 'bg-blue-600' : 'bg-zinc-200'}`} 
                                         style={{ left: `${(index + 0.5) * 25}%`, width: '25%', top: '20px' }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Transport Details */}
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {order.transport_carrier && (
                              <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-blue-500" />
                                <span className="text-zinc-600">Transporteur:</span>
                                <span className="font-medium">{order.transport_carrier}</span>
                              </div>
                            )}
                            {order.transport_tracking_number && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-500" />
                                <span className="text-zinc-600">Tracking:</span>
                                <span className="font-medium font-mono">{order.transport_tracking_number}</span>
                              </div>
                            )}
                            {order.transport_estimated_delivery && (
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-blue-500" />
                                <span className="text-zinc-600">Verwacht:</span>
                                <span className="font-medium">{order.transport_estimated_delivery}</span>
                              </div>
                            )}
                            {order.transport_notes && (
                              <div className="col-span-2 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                                <span className="text-zinc-600">{order.transport_notes}</span>
                              </div>
                            )}
                          </div>
                          
                          {order.transport_updated_at && (
                            <p className="text-xs text-zinc-400 mt-3">
                              Laatste update: {new Date(order.transport_updated_at).toLocaleString('nl-NL')}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Bank info reminder for paid orders */}
                      {order.payment_status === 'paid' && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm text-amber-800 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>
                              <strong>{t('orders.remainingAmount')}:</strong> {t('orders.transferInfo', { amount: formatPrice((order.total_price || 0) - (order.deposit_amount || 0)), reference: order.id?.slice(0, 8).toUpperCase() })}
                            </span>
                          </p>
                        </div>
                      )}

                      {order.notes && (
                        <div className="mt-4 p-3 bg-zinc-50 rounded-lg">
                          <p className="text-sm text-zinc-600">
                            <span className="font-semibold">{t('orders.yourNote')}:</span> {order.notes}
                          </p>
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {order.motorcycle && (
                          <Link to={`/motorcycle/${order.motorcycle.id}`}>
                            <Button variant="outline" data-testid={`view-motorcycle-btn-${order.id}`}>
                              <Eye className="w-4 h-4 mr-2" />
                              {t('orders.viewMotorcycleBtn')}
                            </Button>
                          </Link>
                        )}
                        <Button 
                          variant="outline" 
                          className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                          onClick={() => handleArchiveClick(order)}
                          data-testid={`archive-order-btn-${order.id}`}
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          {t('orders.archive')}
                        </Button>
                        <Button 
                          variant="outline" 
                          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleDeleteClick(order)}
                          data-testid={`delete-order-btn-${order.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t('common.delete')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Image Lightbox */}
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="max-w-4xl w-full p-0 bg-black/95 border-none">
            <div className="relative">
              {/* Close button */}
              <button 
                onClick={() => setLightboxOpen(false)}
                className="absolute top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>

              {/* Main image */}
              <div className="flex items-center justify-center min-h-[60vh]">
                {lightboxImages[lightboxIndex] && (
                  <img 
                    src={lightboxImages[lightboxIndex]} 
                    alt={`Foto ${lightboxIndex + 1}`}
                    className="max-w-full max-h-[80vh] object-contain"
                  />
                )}
              </div>

              {/* Navigation arrows */}
              {lightboxImages.length > 1 && (
                <>
                  <button 
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <ChevronLeft className="w-8 h-8 text-white" />
                  </button>
                  <button 
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <ChevronRight className="w-8 h-8 text-white" />
                  </button>

                  {/* Image counter */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm">
                    {lightboxIndex + 1} / {lightboxImages.length}
                  </div>
                </>
              )}

              {/* Thumbnail strip */}
              {lightboxImages.length > 1 && (
                <div className="flex justify-center gap-2 p-4 bg-black/80">
                  {lightboxImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setLightboxIndex(idx)}
                      className={`w-16 h-16 rounded overflow-hidden border-2 transition-colors ${
                        idx === lightboxIndex ? 'border-red-500' : 'border-transparent hover:border-white/50'
                      }`}
                    >
                      <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent data-testid="delete-order-dialog">
            <DialogHeader>
              <DialogTitle>{t('orders.deleteTitle')}</DialogTitle>
              <DialogDescription>
                {orderToDelete?.motorcycle ? (
                  t('orders.deleteConfirm', {
                    brand: orderToDelete.motorcycle.brand,
                    model: orderToDelete.motorcycle.model
                  })
                ) : (
                  t('orders.deleteConfirmGeneric')
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleting}
                data-testid="cancel-delete-btn"
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deleting}
                data-testid="confirm-delete-btn"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                {t('common.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Archive Confirmation Dialog */}
        <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
          <DialogContent data-testid="archive-order-dialog">
            <DialogHeader>
              <DialogTitle>{t('orders.archiveTitle')}</DialogTitle>
              <DialogDescription>
                {orderToArchive?.motorcycle ? (
                  t('orders.archiveConfirm', {
                    brand: orderToArchive.motorcycle.brand,
                    model: orderToArchive.motorcycle.model
                  })
                ) : (
                  t('orders.archiveConfirmGeneric')
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setArchiveDialogOpen(false)}
                disabled={archiving}
                data-testid="cancel-archive-btn"
              >
                {t('common.cancel')}
              </Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700"
                onClick={handleConfirmArchive}
                disabled={archiving}
                data-testid="confirm-archive-btn"
              >
                {archiving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Archive className="w-4 h-4 mr-2" />
                )}
                {t('orders.archive')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default DealerOrders;
