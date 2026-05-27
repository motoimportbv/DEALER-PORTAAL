import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, FileText, Mail, Phone, MapPin, Building2, Hash,
  Calendar, X, Trash2, ExternalLink, Inbox, CheckCircle2, Clock, AlertCircle,
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
  const isAllowed = user?.role === 'admin' || user?.role === 'taxateur' || user?.email?.toLowerCase() === 'motoimportbv@gmail.com';

  const fetchData = useCallback(async () => {
    if (!isAllowed) { setLoading(false); return; }
    try {
      const res = await axios.get(`${API}/admin/taxatie-aanvragen`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAanvragen(res.data?.aanvragen || []);
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

  const filtered = filter === 'alle' ? aanvragen : aanvragen.filter(a => (a.status || 'nieuw') === filter);
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
          <Link to="/admin/taxatie-programma">
            <Button variant="outline" data-testid="back-to-bpm-btn">
              <ArrowLeft className="w-4 h-4 mr-2" />Terug naar BPM Vermindering
            </Button>
          </Link>
        </div>

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
                        {new Date(a.created_at).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 font-bold">{a.bedrijfsnaam}</td>
                      <td className="px-4 py-3 text-zinc-600">
                        <div>{a.contactpersoon || '—'}</div>
                        <div className="text-xs text-zinc-400">{a.email}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 text-xs">{a.woonplaats}</td>
                      <td className="px-4 py-3 text-zinc-600 text-xs">{(a.files || []).length}</td>
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
            <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {new Date(a.created_at).toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' })}
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
