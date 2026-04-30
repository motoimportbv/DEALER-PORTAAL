import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Check, Loader2, Calendar } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Link } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmtEur = (v) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v || 0);

export default function MaandfactuurOverzicht() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState([]);
  const [expanded, setExpanded] = useState({});
  const isAllowed = user?.email?.toLowerCase() === 'motoimportbv@gmail.com' || user?.role === 'admin' || user?.role === 'taxateur';

  const fetchData = useCallback(async () => {
    if (!isAllowed) { setLoading(false); return; }
    try {
      const res = await axios.get(`${API}/taxatie-programma-maandfactuur`, { headers: { Authorization: `Bearer ${token}` } });
      setMonths(res.data?.months || []);
      // Expand the first (most recent) month by default
      if (res.data?.months?.[0]) {
        setExpanded({ [res.data.months[0].month]: true });
      }
    } catch (e) {
      toast.error('Laden mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setLoading(false);
  }, [token, isAllowed]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const markInvoiced = async (taxatie_id) => {
    try {
      await axios.post(`${API}/taxatie-programma/${taxatie_id}/mark-invoiced`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Gemarkeerd als gefactureerd');
      fetchData();
    } catch (e) {
      toast.error('Mislukt: ' + (e.response?.data?.detail || e.message));
    }
  };

  if (!isAllowed) {
    return <Layout><div className="flex items-center justify-center h-64 text-zinc-500">Geen toegang tot deze pagina.</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="maandfactuur-overzicht">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <Calendar className="w-7 h-7 text-emerald-600" /> Maandfactuur Overzicht
            </h1>
            <p className="text-zinc-500 mt-1">Klantfacturatie per maand op basis van ontvangen BPM</p>
          </div>
          <Link to="/admin/taxatie-programma">
            <Button variant="outline" data-testid="back-to-bpm-btn">
              <ArrowLeft className="w-4 h-4 mr-2" />Terug naar BPM Vermindering
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
        ) : months.length === 0 ? (
          <div className="bg-white rounded-2xl border p-10 text-center text-zinc-400" data-testid="maandfactuur-empty">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-bold mb-1">Nog geen ontvangen BPM</p>
            <p className="text-sm">Zodra je in BPM Vermindering taxaties markeert als &quot;BPM ontvangen&quot;, verschijnen ze hier per maand gegroepeerd.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {months.map(m => {
              const isOpen = !!expanded[m.month];
              return (
                <div key={m.month} className="bg-white rounded-2xl border overflow-hidden" data-testid={`maand-${m.month}`}>
                  <button
                    type="button"
                    onClick={() => setExpanded(s => ({ ...s, [m.month]: !s[m.month] }))}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-zinc-50 transition-colors"
                  >
                    <div className="text-left">
                      <h2 className="font-bold text-lg capitalize">{m.label}</h2>
                      <p className="text-xs text-zinc-500">{m.aantal} taxatie{m.aantal === 1 ? '' : 's'} \u2014 {m.te_factureren} nog te factureren</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-500 font-bold uppercase">Totaal BPM ontvangen</p>
                      <p className="text-xl font-black text-emerald-700" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{fmtEur(m.totaal_bpm)}</p>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-zinc-200 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-50">
                          <tr>
                            <th className="text-left px-4 py-2 text-xs font-bold uppercase text-zinc-500">Meldcode</th>
                            <th className="text-left px-4 py-2 text-xs font-bold uppercase text-zinc-500">Klant</th>
                            <th className="text-left px-4 py-2 text-xs font-bold uppercase text-zinc-500">Voertuig</th>
                            <th className="text-left px-4 py-2 text-xs font-bold uppercase text-zinc-500">Ontvangen op</th>
                            <th className="text-right px-4 py-2 text-xs font-bold uppercase text-zinc-500">BPM bedrag</th>
                            <th className="text-center px-4 py-2 text-xs font-bold uppercase text-zinc-500">Status</th>
                            <th className="text-right px-4 py-2 text-xs font-bold uppercase text-zinc-500">Actie</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.items.map(it => (
                            <tr key={it.id} className="border-t border-zinc-100 hover:bg-zinc-50" data-testid={`maand-row-${it.id}`}>
                              <td className="px-4 py-3 font-mono text-xs">{it.bpm_meldcode || '\u2014'}</td>
                              <td className="px-4 py-3">
                                <div className="font-bold">{it.customer_name || '\u2014'}</div>
                                {it.customer_phone && <div className="text-xs text-zinc-500">{it.customer_phone}</div>}
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm">{it.brand} {it.model}</div>
                                <div className="text-xs font-mono text-zinc-500">{it.taxatie_nummer}</div>
                              </td>
                              <td className="px-4 py-3 text-xs">{it.bpm_received_at ? new Date(it.bpm_received_at).toLocaleDateString('nl-NL') : '\u2014'}</td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmtEur(it.bpm_amount_received)}</td>
                              <td className="px-4 py-3 text-center">
                                {it.invoiced
                                  ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Gefactureerd</span>
                                  : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Open</span>}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {!it.invoiced && (
                                  <button
                                    type="button"
                                    onClick={() => markInvoiced(it.id)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                    data-testid={`mark-invoiced-${it.id}`}
                                  >
                                    <Check className="w-3 h-3" /> Gefactureerd
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
