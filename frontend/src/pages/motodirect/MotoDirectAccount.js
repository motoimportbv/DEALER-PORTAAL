import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Bike, Clock, CheckCircle2 } from 'lucide-react';
import MotoDirectLayout from './MotoDirectLayout';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MotoDirectAccount() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [orders, setOrders] = useState([]);

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
                      <StatusBadge status={o.payment_status} />
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
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
  };
  const meta = map[status] || map.pending;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] uppercase tracking-widest ${meta.color}`}>
      <Icon className="w-3 h-3" /> {meta.label}
    </span>
  );
}
