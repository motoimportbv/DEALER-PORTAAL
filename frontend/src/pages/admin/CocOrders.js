import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import axios from 'axios';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { FileText, CheckCircle, Clock, Package, Send, ExternalLink, Bike, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_STEPS = [
  { key: 'requested', label: 'Aangevraagd', icon: Clock, color: 'bg-amber-100 text-amber-800' },
  { key: 'ordered_from_supplier', label: 'Besteld bij leverancier', icon: Package, color: 'bg-blue-100 text-blue-800' },
  { key: 'coc_received', label: 'COC ontvangen', icon: FileText, color: 'bg-purple-100 text-purple-800' },
  { key: 'sent_to_dealer', label: 'Verstuurd naar dealer', icon: Send, color: 'bg-green-100 text-green-800' },
];

const getStatusIndex = (status) => {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx === -1 ? 0 : idx;
};

const CocOrders = () => {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API}/admin/coc-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Kon COC-bestellingen niet laden');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId, newStatus) => {
    setUpdating(orderId);
    try {
      await axios.put(`${API}/orders/${orderId}/coc-status`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Status bijgewerkt naar "${STATUS_STEPS.find(s => s.key === newStatus)?.label}"`);
      await fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fout bij bijwerken status');
    } finally {
      setUpdating(null);
    }
  };

  const uploadCocPdf = async (orderId, file) => {
    if (!file) return;
    setUpdating(orderId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(`${API}/orders/${orderId}/coc-pdf`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      toast.success('COC PDF geüpload');
      await fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload mislukt');
    } finally {
      setUpdating(null);
    }
  };

  const downloadCocPdf = async (orderId, filename) => {
    try {
      const response = await axios.get(`${API}/orders/${orderId}/coc-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename || `coc_${orderId.slice(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Download mislukt');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
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

  const openCount = orders.filter(o => o.coc_status !== 'sent_to_dealer').length;
  const doneCount = orders.filter(o => o.coc_status === 'sent_to_dealer').length;

  return (
    <Layout>
      <div className="content-header">
        <div>
          <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900" data-testid="coc-orders-title">
            COC / CVO Bestellingen
          </h1>
          <p className="text-zinc-500 mt-1">
            <span className="font-semibold text-amber-700">{openCount} openstaand</span> • {doneCount} verzonden
          </p>
        </div>
      </div>

      <div className="content-body" data-testid="coc-orders-dashboard">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">Geen COC-bestellingen</h3>
              <p className="text-zinc-500">Zodra dealers COC/CVO bestellen verschijnen ze hier.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const moto = order.motorcycle || {};
              const currentIdx = getStatusIndex(order.coc_status);
              const currentStep = STATUS_STEPS[currentIdx];
              const StatusIcon = currentStep.icon;

              return (
                <Card key={order.id} className="hover:shadow-md transition-shadow" data-testid={`coc-order-${order.id}`}>
                  <CardContent className="p-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-mono font-bold text-lg text-zinc-900">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="text-xs text-zinc-400">{formatDate(order.created_at)}</p>
                        </div>
                        <div className="h-12 w-px bg-zinc-200"></div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Bike className="w-4 h-4 text-zinc-400" />
                            <span className="font-semibold text-zinc-900">
                              {moto.brand} {moto.model}
                            </span>
                            {moto.year && <Badge variant="outline" className="text-xs">{moto.year}</Badge>}
                          </div>
                          <p className="text-sm text-zinc-500 mt-0.5">
                            Dealer: <strong>{order.dealer_company || '-'}</strong>
                            {moto.chassis_number && <span className="ml-2 font-mono text-xs">VIN: {moto.chassis_number}</span>}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-zinc-400">Dealer betaalt</p>
                          <p className="font-bold text-red-600">€{order.coc_cost || 0}</p>
                        </div>
                        {order.coc_admin_cost_chf > 0 && (
                          <div className="text-right border-l border-zinc-200 pl-3">
                            <p className="text-xs text-zinc-400">Jouw inkoop</p>
                            <p className="font-bold text-zinc-700">CHF {order.coc_admin_cost_chf}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Supplier info */}
                    {order.coc_supplier_name && (
                      <div className="bg-zinc-50 rounded-lg p-3 mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-zinc-500">Leverancier</p>
                          <p className="font-semibold text-zinc-900">{order.coc_supplier_name}</p>
                          {order.coc_supplier_email && (
                            <a href={`mailto:${order.coc_supplier_email}`} className="text-xs text-blue-600 hover:underline">
                              {order.coc_supplier_email}
                            </a>
                          )}
                        </div>
                        <Badge className={currentStep.color}>
                          <StatusIcon className="w-3.5 h-3.5 mr-1" />
                          {currentStep.label}
                        </Badge>
                      </div>
                    )}

                    {/* Dealer-provided COC details */}
                    {(order.coc_brand || order.coc_type || order.coc_chassis_number || order.coc_document_url) && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4" data-testid={`coc-details-${order.id}`}>
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-800 mb-2">Dealer Gegevens</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                          {order.coc_brand && (
                            <div>
                              <span className="text-xs text-blue-600 block">Merk</span>
                              <span className="font-semibold">{order.coc_brand}</span>
                            </div>
                          )}
                          {order.coc_type && (
                            <div>
                              <span className="text-xs text-blue-600 block">Type</span>
                              <span className="font-semibold">{order.coc_type}</span>
                            </div>
                          )}
                          {order.coc_chassis_number && (
                            <div>
                              <span className="text-xs text-blue-600 block">Chassisnummer</span>
                              <span className="font-mono font-semibold">{order.coc_chassis_number}</span>
                            </div>
                          )}
                        </div>
                        {order.coc_document_url && (
                          <div className="mt-2">
                            <span className="text-xs text-blue-600 block mb-1">Foto kenteken</span>
                            <a href={order.coc_document_url} target="_blank" rel="noopener noreferrer" data-testid={`coc-document-link-${order.id}`}>
                              <img src={order.coc_document_url} alt="Kenteken" className="h-24 rounded border border-blue-200 hover:opacity-90 cursor-pointer" />
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* PDF upload / download */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4" data-testid={`coc-pdf-section-${order.id}`}>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-1">COC PDF</p>
                          {order.coc_pdf_filename ? (
                            <p className="text-sm text-amber-900 truncate">
                              📎 <span className="font-mono">{order.coc_pdf_filename}</span>
                            </p>
                          ) : (
                            <p className="text-sm text-amber-700 italic">Nog geen PDF geüpload — upload voor automatische bijlage aan dealer-mail bij "Verstuurd naar dealer"</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {order.coc_pdf_filename && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadCocPdf(order.id, order.coc_pdf_filename)}
                              className="gap-1"
                              data-testid={`coc-pdf-download-${order.id}`}
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </Button>
                          )}
                          <label className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md cursor-pointer transition-colors" data-testid={`coc-pdf-upload-label-${order.id}`}>
                            <Upload className="w-3.5 h-3.5" />
                            {order.coc_pdf_filename ? 'Vervangen' : 'Upload PDF'}
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={(e) => uploadCocPdf(order.id, e.target.files?.[0])}
                              data-testid={`coc-pdf-upload-${order.id}`}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Status progression */}
                    <div className="border-t border-zinc-100 pt-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Status bijwerken</p>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_STEPS.map((step, idx) => {
                          const isActive = order.coc_status === step.key;
                          const isPast = idx < currentIdx;
                          const StepIcon = step.icon;
                          return (
                            <Button
                              key={step.key}
                              size="sm"
                              variant={isActive ? 'default' : 'outline'}
                              className={`gap-1 ${isActive ? 'bg-red-600 hover:bg-red-700' : ''} ${isPast ? 'border-green-300 text-green-700' : ''}`}
                              onClick={() => updateStatus(order.id, step.key)}
                              disabled={updating === order.id || isActive}
                              data-testid={`coc-status-btn-${order.id}-${step.key}`}
                            >
                              {isPast && <CheckCircle className="w-3.5 h-3.5" />}
                              {!isPast && <StepIcon className="w-3.5 h-3.5" />}
                              {step.label}
                            </Button>
                          );
                        })}
                      </div>
                      {order.coc_updated_at && (
                        <p className="text-xs text-zinc-400 mt-2">Laatste update: {formatDate(order.coc_updated_at)}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Honda info card */}
        <Card className="mt-6 border-blue-200 bg-blue-50">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <ExternalLink className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Honda COC</h3>
                <p className="text-sm text-blue-800 mb-2">
                  Dealers bestellen Honda COC zelf direct bij Honda. Je ziet ze niet in deze lijst.
                </p>
                <a
                  href="https://coc-registration.honda.eu/cocobo/termsAndConditions;jsessionid=e001532b5e9a5dcd9ef8ade61897:grxQ?locale=de_CH"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900 underline"
                  data-testid="honda-portal-link"
                >
                  Honda COC Portal openen →
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CocOrders;
