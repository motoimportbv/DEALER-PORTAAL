import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Save, Users, ShoppingBag, Settings as SettingsIcon, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MotoDirectAdmin() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [markup, setMarkup] = useState(500);
  const [savingMarkup, setSavingMarkup] = useState(false);

  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const load = async () => {
    setLoading(true);
    try {
      const [oRes, cRes, sRes] = await Promise.all([
        axios.get(`${API}/motodirect/admin/orders`, auth),
        axios.get(`${API}/motodirect/admin/customers`, auth),
        axios.get(`${API}/motodirect/admin/settings`, auth),
      ]);
      setOrders(oRes.data.orders || []);
      setCustomers(cRes.data.customers || []);
      setMarkup(sRes.data.markup ?? 500);
    } catch (e) {
      toast.error('Kon MotoDirect data niet laden');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const saveMarkup = async () => {
    setSavingMarkup(true);
    try {
      const res = await axios.put(`${API}/motodirect/admin/settings`, { markup: Number(markup) }, auth);
      setMarkup(res.data.markup);
      toast.success(`Marge bijgewerkt naar €${res.data.markup}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Opslaan mislukt');
    } finally {
      setSavingMarkup(false);
    }
  };

  const formatPrice = (v) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
  const formatDate = (iso) => iso ? new Date(iso).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/admin/dashboard" className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-2" data-testid="admin-back">
              <ArrowLeft className="w-3 h-3" /> Admin dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">MotoDirect Beheer</h1>
            <p className="text-gray-600 text-sm">Bestellingen, klanten en marge-instellingen voor moto-direct.nl</p>
          </div>
          <div className="flex gap-3">
            <StatCard label="Bestellingen" value={orders.length} icon={ShoppingBag} />
            <StatCard label="Klanten" value={customers.length} icon={Users} />
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6 flex gap-1">
          {[
            { id: 'orders', label: 'Bestellingen', icon: ShoppingBag },
            { id: 'customers', label: 'Klanten', icon: Users },
            { id: 'settings', label: 'Instellingen', icon: SettingsIcon },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`tab-${t.id}`}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : tab === 'orders' ? (
          <div className="bg-white border border-gray-200 overflow-x-auto" data-testid="orders-table">
            {orders.length === 0 ? (
              <div className="py-20 text-center text-gray-400 text-sm">Nog geen bestellingen.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3">Datum</th>
                    <th className="text-left px-4 py-3">Klant</th>
                    <th className="text-left px-4 py-3">Motor</th>
                    <th className="text-left px-4 py-3">Keuring</th>
                    <th className="text-right px-4 py-3">Aanbetaling</th>
                    <th className="text-right px-4 py-3">Totaal</th>
                    <th className="text-left px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(o.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{o.buyer_name}</div>
                        <div className="text-xs text-gray-500">{o.buyer_email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{o.motorcycle_snapshot?.brand} {o.motorcycle_snapshot?.model}</div>
                        <div className="text-xs text-gray-500">{o.motorcycle_snapshot?.year}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {o.inspection_choice === 'motodirect' ? 'Moto-direct' : 'MotoImport'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatPrice(o.deposit_amount)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatPrice(o.total_price)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${o.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {o.payment_status === 'paid' ? 'Betaald' : 'In afwachting'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : tab === 'customers' ? (
          <div className="bg-white border border-gray-200 overflow-x-auto" data-testid="customers-table">
            {customers.length === 0 ? (
              <div className="py-20 text-center text-gray-400 text-sm">Nog geen klanten.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3">Registratie</th>
                    <th className="text-left px-4 py-3">Naam</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Telefoon</th>
                    <th className="text-left px-4 py-3">Woonplaats</th>
                    <th className="text-left px-4 py-3">BSN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customers.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3 font-medium">{c.contact_person || c.company_name}</td>
                      <td className="px-4 py-3 text-gray-600">{c.email}</td>
                      <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.postal_code} {c.city}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono">{c.bsn || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 p-8 max-w-2xl" data-testid="settings-panel">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Marge (mark-up) op dealerprijs</h2>
            <p className="text-sm text-gray-600 mb-6">
              Deze bedrag wordt automatisch bovenop de dealerprijs opgeteld voor <b>alle</b> motoren op moto-direct.nl. Klanten zien alleen de eindprijs (verstopte marge). Wijzigingen zijn direct actief.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-gray-300 focus-within:border-blue-600 bg-white">
                <span className="px-3 text-gray-500 border-r border-gray-300">€</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={markup}
                  onChange={(e) => setMarkup(e.target.value)}
                  data-testid="markup-input"
                  className="px-3 py-3 outline-none w-40 text-right font-semibold"
                />
              </div>
              <button
                onClick={saveMarkup}
                disabled={savingMarkup}
                data-testid="save-markup-btn"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-3 flex items-center gap-2 disabled:opacity-70"
              >
                {savingMarkup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Opslaan
              </button>
            </div>
            <div className="mt-6 text-xs text-gray-500 border-t border-gray-100 pt-4">
              Voorbeeld: dealerprijs €10.000 + marge €{markup || 0} = <b>€{new Intl.NumberFormat('nl-NL').format(10000 + Number(markup || 0))}</b> zichtbaar voor particulier
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="bg-white border border-gray-200 px-5 py-3 flex items-center gap-3">
      <Icon className="w-5 h-5 text-blue-600" strokeWidth={1.5} />
      <div>
        <div className="text-xs uppercase tracking-widest text-gray-500">{label}</div>
        <div className="text-xl font-bold text-gray-900">{value}</div>
      </div>
    </div>
  );
}
