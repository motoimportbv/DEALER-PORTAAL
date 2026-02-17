import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '../../components/ui/dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DealerOrders = () => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

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
        <div>
          <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
            {t('nav.myOrders')}
          </h1>
          <p className="text-zinc-500 mt-1">{orders.length} {t('orders.totalOrders')}</p>
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

                      {order.motorcycle && (
                        <div className="mt-4">
                          <Link to={`/motorcycle/${order.motorcycle.id}`}>
                            <Button variant="outline" data-testid={`view-motorcycle-btn-${order.id}`}>
                              <Eye className="w-4 h-4 mr-2" />
                              {t('orders.viewMotorcycleBtn')}
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
      </div>
    </Layout>
  );
};

export default DealerOrders;
