import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, FileText, Mail, Phone, MapPin, Building2, Hash,
  Calendar, X, Trash2, ExternalLink, Inbox, CheckCircle2, Clock, AlertCircle,
  Users, ChevronDown,
} from 'lucide-react';
import { Button } from '../../components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND = process.env.REACT_APP_BACKEND_URL;

const STATUS_LABELS = {
  nieuw: { label: 'Nieuw', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Inbox },
  in_behandeling: { label: 'In behandeling', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock },
  afgerond: { label: 'Afgerond', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle2 },
  afgewezen: { label: 'Afgewezen', color: 'bg-zinc-100 text-zinc-600 border-zinc-300', icon: AlertCircle },
};

const SLOT_LABELS = {
  voorwiel: 'Voorwiel', achterwiel: 'Achterwiel', km_stand: 'KM-stand',
  chassisnummer: 'Chassisnummer', motorfiets_links: 'Motor links',
  motorfiets_rechts: 'Motor rechts', inkoop_verklaring: 'Inkoopverklaring',
  kenteken_voor: 'Kenteken voor', kenteken_achter: 'Kenteken achter',
};

export default function AdminTaxatieAanvragen() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [aanvragen, setAanvragen] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('alle');
  const [views, setViews] = useState({ views: [], today: 0, week: 0, total: 0 });
  const [dealers, setDealers] = useState([]);
  const [dealerFilter, setDealerFilter] = useState(null);  // { email, company_name } | null
  const isAllowed = user?.role === 'admin' || user?.role === 'taxateur' || user?.email?.toLowerCase() === 'motoimportbv@gmail.com';

  const fetchData = useCallback(async () => {
    if (!isAllowed) { setLoading(false); return; }
    try {
      const [resA, resV, resD] = await Promise.all([
        axios.get(`${API}/admin/taxatie-aanvragen`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/taxatie-views`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/taxatie-dealers`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setAanvragen(resA.data?.aanvragen || []);
      setViews(resV.data || { views: [], today: 0, week: 0, total: 0 });
      setDealers(resD.data?.dealers || []);
    } catch (e) {
      toast.error('Laden mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setLoading(false);
  }, [token, isAllowed]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (id, status) => {
    try {
      await axios.post(`${API}/admin/taxatie-aanvragen/${id}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Status bijgewerkt');
      setAanvragen(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      setSelected(prev => prev && prev.id === id ? { ...prev, status } : prev);
    } catch (e) {
      toast.error('Mislukt: ' + (e.response?.data?.detail || e.message));
    }
  };

  const deleteAanvraag = async (id) => {
    if (!window.confirm('Weet je zeker dat je deze aanvraag wilt verwijderen? Foto\'s worden definitief verwijderd.')) return;
    try {
      await axios.delete(`${API}/admin/taxatie-aanvragen/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Aanvraag verwijderd');
      setAanvragen(prev => prev.filter(a => a.id !== id));
      setSelected(null);
    } catch (e) {
      toast.error('Verwijderen mislukt: ' + (e.response?.data?.detail || e.message));
    }
  };

  const startBpm = (a) => {
    if (a.customer_id) {
      navigate(`/admin/taxatie-programma?prefill_customer=${a.customer_id}`);
    } else {
      toast.error('Geen klant gekoppeld aan deze aanvraag');
    }
  };

  // Filter eerst op dealer-email, dan op status
  const byDealer = dealerFilter
    ? aanvragen.filter(a => (a.email || '').toLowerCase() === dealerFilter.email.toLowerCase())
    : aanvragen;
  const filtered = filter === 'alle' ? byDealer : byDealer.filter(a => (a.status || 'nieuw') === filter);
  const counts = aanvragen.reduce((acc, a) => {
    const s = a.status || 'nieuw';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  if (!isAllowed) {
    return <Layout><div className="p-10 text-center text-zinc-500">Geen toegang</div></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="admin-taxatie-aanvragen">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <FileText className="w-7 h-7 text-red-600" /> Taxatie-aanvragen
            </h1>
            <p className="text-zinc-500 mt-1">Binnengekomen aanvragen via motoimportbv.nl/taxatie</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => window.open(`${API}/public/taxatie-flyer`, '_blank')}
              variant="outline"
              data-testid="download-flyer-btn"
              title="Download A4 flyer (PDF) om dealers te werven"
            >
              <FileText className="w-4 h-4 mr-2" />Download flyer
            </Button>
            <Link to="/admin/taxatie-programma">
              <Button variant="outline" data-testid="back-to-bpm-btn">
                <ArrowLeft className="w-4 h-4 mr-2" />Terug naar BPM Vermindering
              </Button>
            </Link>
          </div>
        </div>

        {/* Bezoekers stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" data-testid="views-stats">
          <StatTile label="Vandaag" value={views.today} accent="bg-blue-600" />
          <StatTile label="Laatste 7 dagen" value={views.week} accent="bg-emerald-600" />
          <StatTile label="Totaal bezoekers" value={views.total} accent="bg-zinc-900" />
          <StatTile label="Aanvragen totaal" value={aanvragen.length} accent="bg-red-600" />
          <StatTile label="Dealers geregistreerd" value={dealers.length} accent="bg-amber-600" />
        </div>

        {/* Bron-tracking: waar komen bezoekers vandaan? */}
        {(views.by_source || []).length > 0 && (
          <div className="bg-white rounded-2xl border p-4" data-testid="by-source-block">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs uppercase tracking-wider font-bold text-zinc-500">📊 Bezoekers per bron</span>
              <span className="text-[10px] text-zinc-400">(uit ?ref= parameter)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {views.by_source.map(b => {
                const pct = views.total > 0 ? Math.round((b.count / views.total) * 100) : 0;
                const color =
                  b.source === 'flyer' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                  b.source === 'email' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                  b.source === 'direct' ? 'bg-zinc-100 text-zinc-700 border-zinc-300' :
                  'bg-amber-100 text-amber-800 border-amber-300';
                return (
                  <div key={b.source} className={`${color} border rounded-lg px-3 py-1.5 text-xs flex items-center gap-2`} data-testid={`source-${b.source}`}>
                    <span className="font-bold uppercase tracking-wider">{b.source}</span>
                    <span className="font-black text-base">{b.count}</span>
                    <span className="opacity-70">({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dealers paneel (collapsible) */}
        {dealers.length > 0 && (
          <details className="bg-white rounded-2xl border" data-testid="dealers-list">
            <summary className="cursor-pointer px-5 py-3 font-bold text-sm hover:bg-zinc-50 select-none flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" />
              Geregistreerde dealers ({dealers.length})
              <ChevronDown className="w-4 h-4 text-zinc-400 ml-auto" />
            </summary>
            <div className="border-t overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs uppercase font-bold text-zinc-600">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Geregistreerd</th>
                    <th className="px-4 py-2.5 text-left">Bedrijf</th>
                    <th className="px-4 py-2.5 text-left">Contact</th>
                    <th className="px-4 py-2.5 text-left">KVK / RSIN</th>
                    <th className="px-4 py-2.5 text-left">Art.8</th>
                    <th className="px-4 py-2.5 text-right">Aanvragen</th>
                    <th className="px-4 py-2.5 text-left">Laatste</th>
                  </tr>
                </thead>
                <tbody>
                  {dealers.map(d => {
                    const active = dealerFilter?.email === d.email;
                    return (
                      <tr
                        key={d.id}
                        onClick={() => setDealerFilter(active ? null : { email: d.email, company_name: d.company_name })}
                        className={`border-t cursor-pointer transition-colors ${active ? 'bg-amber-50' : 'hover:bg-zinc-50'}`}
                        data-testid={`dealer-row-${d.id}`}
                        title={active ? 'Klik om filter te verwijderen' : 'Klik om aanvragen van deze dealer te tonen'}
                      >
                      <td className="px-4 py-2.5 text-zinc-500 text-xs">
                        {d.created_at ? new Date(d.created_at).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-bold">{d.company_name || '—'}</td>
                      <td className="px-4 py-2.5 text-zinc-600 text-xs">
                        <div>{d.contact_person || d.name || '—'}</div>
                        {d.email && <a href={`mailto:${d.email}`} className="text-zinc-500 hover:text-red-600 block">{d.email}</a>}
                        {d.phone && <a href={`tel:${d.phone}`} className="text-zinc-500 hover:text-red-600 block" data-testid={`dealer-phone-${d.id || d.email}`}>{d.phone}</a>}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600 text-xs">
                        {d.kvk_number && <div>KVK: {d.kvk_number}</div>}
                        {d.rsin && <div>RSIN: {d.rsin}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {d.art8_vergunning ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">
                            <CheckCircle2 className="w-3 h-3" />{d.art8_nummer || 'Ja'}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold">{d.aanvragen_count || 0}</td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs">
                        {d.last_aanvraag_at
                          ? new Date(d.last_aanvraag_at).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: '2-digit' })
                          : <span className="text-zinc-300">geen</span>}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {/* Recente bezoekers (collapsible) */}
        {views.views.length > 0 && (
          <details className="bg-white rounded-2xl border" data-testid="views-list">
            <summary className="cursor-pointer px-5 py-3 font-bold text-sm hover:bg-zinc-50 select-none">
              👁️ Laatste {Math.min(views.views.length, 10)} bezoekers op /taxatie
              <span className="text-zinc-400 text-xs font-normal ml-2">(klik om te openen)</span>
            </summary>
            <div className="border-t divide-y">
              {views.views.slice(0, 10).map(v => (
                <div key={v.id} className="px-5 py-3 grid grid-cols-12 gap-3 text-sm">
                  <div className="col-span-3 text-zinc-600 text-xs">
                    {new Date(v.created_at).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="col-span-4 font-semibold">
                    {[v.city, v.country].filter(Boolean).join(', ') || <span className="text-zinc-400">Onbekend</span>}
                  </div>
                  <div className="col-span-3 text-zinc-500 text-xs">{v.device}</div>
                  <div className="col-span-2 text-zinc-400 text-xs truncate" title={v.isp}>{v.isp}</div>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Active dealer filter banner */}
        {dealerFilter && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl px-4 py-3 flex items-center justify-between" data-testid="dealer-filter-banner">
            <div className="text-sm">
              <span className="text-amber-700">Gefilterd op dealer: </span>
              <strong className="text-amber-900">{dealerFilter.company_name || dealerFilter.email}</strong>
              <span className="text-amber-700 text-xs ml-2">({byDealer.length} aanvragen)</span>
            </div>
            <button
              onClick={() => setDealerFilter(null)}
              className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1"
              data-testid="clear-dealer-filter"
            >
              <X className="w-3 h-3" />Filter verwijderen
            </button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {['alle', 'nieuw', 'in_behandeling', 'afgerond', 'afgewezen'].map(s => {
            const count = s === 'alle' ? aanvragen.length : (counts[s] || 0);
            const label = s === 'alle' ? 'Alle' : STATUS_LABELS[s].label;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                data-testid={`filter-${s}`}
                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
                  filter === s ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'
                }`}
              >
                {label} <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border p-10 text-center text-zinc-400" data-testid="aanvragen-empty">
            <Inbox className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-bold mb-1">Geen aanvragen</p>
            <p className="text-sm">Aanvragen die via <code>/taxatie</code> binnenkomen verschijnen hier.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase font-bold text-zinc-600">
                <tr>
                  <th className="px-4 py-3 text-left">Datum</th>
                  <th className="px-4 py-3 text-left">Bedrijf</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Locatie</th>
                  <th className="px-4 py-3 text-left">Foto's</th>
                  <th className="px-4 py-3 text-left">RDW</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const st = STATUS_LABELS[a.status || 'nieuw'];
                  const Icon = st.icon;
                  return (
                    <tr key={a.id} className="border-t hover:bg-zinc-50 cursor-pointer" onClick={() => setSelected(a)} data-testid={`row-${a.id}`}>
                      <td className="px-4 py-3 text-zinc-600 text-xs">
                        <div>{new Date(a.created_at).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                        {a.ref_nr && <div className="text-[10px] font-bold text-red-600 mt-0.5">{a.ref_nr}</div>}
                      </td>
                      <td className="px-4 py-3 font-bold">{a.bedrijfsnaam}</td>
                      <td className="px-4 py-3 text-zinc-600">
                        <div>{a.contactpersoon || '—'}</div>
                        <div className="text-xs text-zinc-400">{a.email}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 text-xs">{a.woonplaats}</td>
                      <td className="px-4 py-3 text-zinc-600">
                        {(a.files || []).length === 0 ? (
                          <span className="text-xs text-zinc-300">geen</span>
                        ) : (
                          <div className="flex items-center gap-1" data-testid={`thumbs-${a.id}`}>
                            {(a.files || []).slice(0, 4).map((f, idx) => (
                              <a
                                key={f.filename || idx}
                                href={`${BACKEND}${f.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="w-10 h-10 rounded border bg-zinc-100 overflow-hidden hover:border-red-400 hover:scale-110 transition flex-shrink-0"
                                title={f.field || f.filename}
                              >
                                <img
                                  src={`${BACKEND}${f.url}`}
                                  alt=""
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                              </a>
                            ))}
                            {(a.files || []).length > 4 && (
                              <span className="text-[10px] font-bold text-zinc-500 ml-1 whitespace-nowrap">
                                +{(a.files || []).length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {a.rdw_goedkeuring_datum ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded-md border border-emerald-300 whitespace-nowrap" data-testid={`rdw-${a.id}`}>
                            <CheckCircle2 className="w-3 h-3" />{new Date(a.rdw_goedkeuring_datum).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded-md border border-amber-300 whitespace-nowrap" data-testid={`rdw-pending-${a.id}`}>
                            <Clock className="w-3 h-3" />Wacht
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold border ${st.color}`}>
                          <Icon className="w-3 h-3" />{st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelected(a); }}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selected && (
        <DetailModal
          aanvraag={selected}
          onClose={() => setSelected(null)}
          onUpdateStatus={(s) => updateStatus(selected.id, s)}
          onDelete={() => deleteAanvraag(selected.id)}
          onStartBpm={() => startBpm(selected)}
          backend={BACKEND}
        />
      )}
    </Layout>
  );
}

function StatTile({ label, value, accent }) {
  return (
    <div className="bg-white rounded-xl border p-4 flex items-center gap-3" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className={`${accent} w-1.5 h-10 rounded-full`} />
      <div>
        <p className="text-xs font-bold uppercase text-zinc-500 tracking-wide">{label}</p>
        <p className="text-2xl font-black text-zinc-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{value}</p>
      </div>
    </div>
  );
}

function DetailModal({ aanvraag, onClose, onUpdateStatus, onDelete, onStartBpm, backend }) {
  const a = aanvraag;
  const st = STATUS_LABELS[a.status || 'nieuw'];
  const fixedFiles = (a.files || []).filter(f => !f.filename.includes('_detail_'));
  const detailFiles = (a.files || []).filter(f => f.filename.includes('_detail_'));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4" onClick={onClose} data-testid="aanvraag-detail-modal">
      <div className="bg-white rounded-2xl w-full max-w-4xl my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{a.bedrijfsnaam}</h2>
            <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2 flex-wrap">
              <Calendar className="w-4 h-4" />
              {new Date(a.created_at).toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' })}
              {a.ref_nr && <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded font-bold text-xs">{a.ref_nr}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-lg" data-testid="close-modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status + Actions */}
          <div className="flex flex-wrap items-center gap-3 justify-between p-4 bg-zinc-50 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase text-zinc-600">Status:</span>
              <select
                value={a.status || 'nieuw'}
                onChange={(e) => onUpdateStatus(e.target.value)}
                className={`px-3 py-2 rounded-lg text-sm font-bold border ${st.color}`}
                data-testid="status-select"
              >
                <option value="nieuw">Nieuw</option>
                <option value="in_behandeling">In behandeling</option>
                <option value="afgerond">Afgerond</option>
                <option value="afgewezen">Afgewezen</option>
              </select>
            </div>
            <div className="flex gap-2">
              {a.customer_id && (
                <Button onClick={onStartBpm} className="bg-red-600 hover:bg-red-700 text-white" data-testid="start-bpm-btn">
                  <FileText className="w-4 h-4 mr-2" />Start BPM Taxatie
                </Button>
              )}
              <Button variant="outline" onClick={onDelete} className="text-red-600 border-red-200 hover:bg-red-50" data-testid="delete-btn">
                <Trash2 className="w-4 h-4 mr-2" />Verwijderen
              </Button>
            </div>
          </div>

          {/* Bedrijfsgegevens */}
          <div>
            <h3 className="text-sm font-bold uppercase text-zinc-600 mb-3 pb-2 border-b">Bedrijfsgegevens</h3>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <Info icon={Building2} label="Bedrijfsnaam" value={a.bedrijfsnaam} />
              <Info icon={Hash} label="RSIN / BSN" value={a.rsin} />
              <Info icon={Mail} label="E-mail" value={<a className="text-red-600 hover:underline" href={`mailto:${a.email}`}>{a.email}</a>} />
              <Info icon={Phone} label="Telefoon" value={a.telefoon ? <a className="text-red-600 hover:underline" href={`tel:${a.telefoon}`}>{a.telefoon}</a> : '—'} />
              <Info icon={MapPin} label="Adres" value={a.adres} />
              <Info icon={MapPin} label="Woonplaats" value={a.woonplaats} />
              {a.contactpersoon && <Info icon={Building2} label="Contactpersoon" value={a.contactpersoon} />}
            </div>
            {a.opmerking && (
              <div className="mt-4 p-3 bg-amber-50 border-l-4 border-amber-300 rounded text-sm">
                <p className="font-bold text-amber-900 mb-1">Opmerking:</p>
                <p className="whitespace-pre-line text-amber-800">{a.opmerking}</p>
              </div>
            )}
          </div>

          {/* Vereiste foto's */}
          <div>
            <h3 className="text-sm font-bold uppercase text-zinc-600 mb-3 pb-2 border-b">Vereiste foto's ({fixedFiles.length}/9)</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {fixedFiles.map(f => {
                const fieldKey = f.field || 'foto';
                return (
                  <a key={f.filename} href={`${backend}${f.url}`} target="_blank" rel="noopener noreferrer" className="block group" data-testid={`photo-${fieldKey}`}>
                    <div className="aspect-square bg-zinc-100 rounded-lg overflow-hidden border hover:border-red-400">
                      <img src={`${backend}${f.url}`} alt={fieldKey} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    </div>
                    <p className="text-xs text-center mt-1 font-semibold text-zinc-700">{SLOT_LABELS[fieldKey] || fieldKey}</p>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Detailfoto's */}
          {detailFiles.length > 0 && (
            <div>
              <h3 className="text-sm font-bold uppercase text-zinc-600 mb-3 pb-2 border-b">Detailfoto's ({detailFiles.length})</h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {detailFiles.map(f => (
                  <a key={f.filename} href={`${backend}${f.url}`} target="_blank" rel="noopener noreferrer" className="block">
                    <div className="aspect-square bg-zinc-100 rounded-lg overflow-hidden border hover:border-red-400">
                      <img src={`${backend}${f.url}`} alt="detail" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs uppercase font-bold text-zinc-500">{label}</p>
        <p className="text-zinc-900">{value || '—'}</p>
      </div>
    </div>
  );
}
