import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Bike, Clock, CheckCircle2, FileText, XCircle, Package } from 'lucide-react';
import { toast } from 'sonner';
import MotoDirectLayout from './MotoDirectLayout';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MotoDirectAccount() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [orders, setOrders] = useState([]);
  const [cancellingId, setCancellingId] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null); // order to confirm

  const reload = async () => {
    const token = localStorage.getItem('motodirect_token');
    if (!token) return;
    const ordersRes = await axios.get(`${API}/motodirect/my-orders`, { headers: { Authorization: `Bearer ${token}` } });
    setOrders(ordersRes.data.orders || []);
  };

  useEffect(() => {
    const token = localStorage.getItem('motodirect_token');
    if (!token) {
      navigate('/motodirect/login');
      return;
    }
    (async () => {
      try {
        const [meRes, ordersRes] = await Promise.all([
          axios.get(`${API}/motodirect/me`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API}/motodirect/my-orders`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setMe(meRes.data);
        setOrders(ordersRes.data.orders || []);
      } catch (e) {
        localStorage.removeItem('motodirect_token');
        localStorage.removeItem('motodirect_user');
        navigate('/motodirect/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const formatPrice = (v) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);

  const downloadPDF = async (orderId, kind) => {
    const token = localStorage.getItem('motodirect_token');
    const endpoint = kind === 'invoice' ? 'invoice-deposit' : 'pakbon';
    try {
      const res = await axios.get(`${API}/motodirect/orders/${orderId}/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = kind === 'invoice' ? `factuur-${orderId.slice(0, 8)}.pdf` : `pakbon-${orderId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Download mislukt');
    }
  };

  const doCancel = async (order) => {
    setCancellingId(order.id);
    const token = localStorage.getItem('motodirect_token');
    try {
      const res = await axios.post(`${API}/motodirect/orders/${order.id}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const msg = res.data.refund_status === 'processed'
        ? `Bestelling geannuleerd. Refund van ${formatPrice(res.data.refund_amount)} onderweg (5-10 dagen).`
        : `Bestelling geannuleerd. Refund van ${formatPrice(res.data.refund_amount)} wordt handmatig verwerkt.`;
      toast.success(msg);
      setConfirmCancel(null);
      await reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Annuleren mislukt');
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return (
      <MotoDirectLayout>
        <div className="flex items-center justify-center py-40">
          <Loader2 className="w-10 h-10 text-[#0047FF] animate-spin" />
        </div>
      </MotoDirectLayout>
    );
  }

  return (
    <MotoDirectLayout>
      <div className="max-w-6xl mx-auto px-6 lg:px-10 pt-12 pb-24" data-testid="account-page">
        <div className="mb-12">
          <div className="text-xs uppercase tracking-widest text-[#0047FF] mb-2">Mijn account</div>
          <h1 className="heading text-4xl md:text-5xl font-bold text-white leading-tight">
            Hallo, {me?.name?.split(' ')[0] || 'daar'}.
          </h1>
        </div>

        {/* Profile */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8 mb-12">
          <div className="border border-[#1c1c1c] p-6">
            <div className="text-xs uppercase tracking-widest text-neutral-500 mb-4">Contactgegevens</div>
            <dl className="space-y-3 text-sm">
              <Row label="Naam" value={me?.name} />
              <Row label="Email" value={me?.email} />
              <Row label="Telefoon" value={me?.phone} />
              <Row label="Adres" value={me?.address} />
              <Row label="Postcode / plaats" value={`${me?.postal_code || ''} ${me?.city || ''}`.trim() || '—'} />
            </dl>
          </div>

          {/* Orders */}
          <div className="border border-[#1c1c1c] p-6">
            <div className="text-xs uppercase tracking-widest text-neutral-500 mb-4">Mijn bestellingen</div>
            {orders.length === 0 ? (
              <div className="py-12 text-center">
                <Bike className="w-10 h-10 text-neutral-700 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-neutral-400 text-sm">Nog geen bestellingen.</p>
                <button
                  onClick={() => navigate('/motodirect/catalog')}
                  className="mt-4 text-[#0047FF] hover:text-white font-semibold text-sm"
                >
                  Bekijk catalogus →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map(o => (
                  <div key={o.id} className="border border-[#1c1c1c] p-5" data-testid={`order-${o.id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="heading text-lg font-bold text-white">
                          {o.motorcycle_snapshot?.brand} {o.motorcycle_snapshot?.model}
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {o.motorcycle_snapshot?.year} · Besteld op {new Date(o.created_at).toLocaleDateString('nl-NL')}
                        </div>
                      </div>
                      <StatusBadge status={o.status === 'cancelled' ? 'cancelled' : o.payment_status} />
                    </div>
                    <div className="mt-4 pt-4 border-t border-[#1c1c1c] grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <div className="text-neutral-500">Aanbetaling</div>
                        <div className="text-white font-semibold mt-0.5">{formatPrice(o.deposit_amount)}</div>
                      </div>
                      <div>
                        <div className="text-neutral-500">Totaal</div>
                        <div className="text-white font-semibold mt-0.5">{formatPrice(o.total_price)}</div>
                      </div>
                      <div>
                        <div className="text-neutral-500">Restant</div>
                        <div className="text-white font-semibold mt-0.5">{formatPrice(o.remaining_amount)}</div>
                      </div>
                    </div>

                    {/* Cancellation info */}
                    {o.status === 'cancelled' && (
                      <div className="mt-4 pt-4 border-t border-[#1c1c1c] text-xs text-orange-400 space-y-1" data-testid={`cancel-info-${o.id}`}>
                        <div>Geannuleerd op {new Date(o.cancelled_at).toLocaleDateString('nl-NL')}</div>
                        <div>Annuleringskosten (10%): {formatPrice(o.cancellation_fee)}</div>
                        <div>Refund: {formatPrice(o.refund_amount)} ({o.refund_status === 'processed' ? 'onderweg via Stripe' : 'wordt handmatig verwerkt'})</div>
                      </div>
                    )}

                    {/* Action buttons (only for paid, non-cancelled orders) */}
                    {o.payment_status === 'paid' && o.status !== 'cancelled' && (
                      <div className="mt-4 pt-4 border-t border-[#1c1c1c] flex flex-wrap gap-2">
                        <button
                          onClick={() => downloadPDF(o.id, 'invoice')}
                          data-testid={`download-invoice-${o.id}`}
                          className="flex items-center gap-1.5 text-xs bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-600 text-white px-3 py-2 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" /> Factuur
                        </button>
                        <button
                          onClick={() => downloadPDF(o.id, 'pakbon')}
                          data-testid={`download-pakbon-${o.id}`}
                          className="flex items-center gap-1.5 text-xs bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-600 text-white px-3 py-2 transition-colors"
                        >
                          <Package className="w-3.5 h-3.5" /> Pakbon
                        </button>
                        <button
                          onClick={() => setConfirmCancel(o)}
                          data-testid={`cancel-order-${o.id}`}
                          className="ml-auto flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-900/50 hover:border-red-500 px-3 py-2 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Annuleren
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel confirmation modal */}
      {confirmCancel && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-6" data-testid="cancel-modal">
          <div className="bg-[#0a0a0a] border border-[#1c1c1c] max-w-md w-full p-8">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-6 h-6 text-red-500" strokeWidth={1.5} />
            </div>
            <h2 className="heading text-2xl font-bold text-white text-center mb-2">Bestelling annuleren?</h2>
            <p className="text-neutral-400 text-sm text-center mb-6">
              Je gaat annuleren: <b className="text-white">{confirmCancel.motorcycle_snapshot?.brand} {confirmCancel.motorcycle_snapshot?.model}</b>
            </p>
            <div className="bg-red-500/5 border border-red-900/40 p-4 space-y-2 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-neutral-400">Aanbetaling</span>
                <span className="text-white">{formatPrice(confirmCancel.deposit_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Annuleringskosten (10%)</span>
                <span className="text-red-400">- {formatPrice(confirmCancel.total_price * 0.10)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-red-900/40">
                <span className="text-white">Terug te ontvangen</span>
                <span className="text-[#00FF66]">{formatPrice(Math.max(confirmCancel.deposit_amount - confirmCancel.total_price * 0.10, 0))}</span>
              </div>
            </div>
            <p className="text-xs text-neutral-500 text-center mb-6">
              Het refund wordt automatisch via Stripe teruggestort naar jouw iDEAL/creditcard binnen 5-10 werkdagen.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmCancel(null)}
                data-testid="cancel-cancel-btn"
                className="flex-1 border border-neutral-700 text-white py-3 font-semibold hover:border-white transition-colors"
              >
                Nee, behouden
              </button>
              <button
                onClick={() => doCancel(confirmCancel)}
                disabled={cancellingId === confirmCancel.id}
                data-testid="confirm-cancel-btn"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancellingId === confirmCancel.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ja, annuleer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MotoDirectLayout>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#1c1c1c] pb-2 last:border-none last:pb-0">
      <dt className="text-neutral-500 text-xs uppercase tracking-widest">{label}</dt>
      <dd className="text-white text-right truncate">{value || '—'}</dd>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    paid: { label: 'Betaald', color: 'bg-[#00FF66]/10 text-[#00FF66] border-[#00FF66]/40', icon: CheckCircle2 },
    pending: { label: 'In afwachting', color: 'bg-neutral-800 text-neutral-400 border-neutral-700', icon: Clock },
    cancelled: { label: 'Geannuleerd', color: 'bg-red-900/20 text-red-400 border-red-800', icon: XCircle },
  };
  const meta = map[status] || map.pending;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] uppercase tracking-widest ${meta.color}`}>
      <Icon className="w-3 h-3" /> {meta.label}
    </span>
  );
}
