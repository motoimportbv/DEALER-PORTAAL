import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Loader2, FileText, Plus, LogOut, Building2, Phone, Mail, MapPin, Hash,
  Inbox, Clock, CheckCircle2, AlertCircle, Calendar, Pencil, X, Save,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS = {
  nieuw: { label: 'Nieuw', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Inbox },
  in_behandeling: { label: 'In behandeling', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock },
  afgerond: { label: 'Afgerond', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle2 },
  afgewezen: { label: 'Afgewezen', color: 'bg-zinc-100 text-zinc-600 border-zinc-300', icon: AlertCircle },
};

export default function TaxatieDealerDashboard() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [aanvragen, setAanvragen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  const fetchAll = useCallback(async () => {
    if (!token) { navigate('/taxatie-dealer/login'); return; }
    try {
      const [meRes, aRes] = await Promise.all([
        axios.get(`${API}/dealer/me`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/dealer/aanvragen`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setMe(meRes.data);
      setAanvragen(aRes.data?.aanvragen || []);
    } catch (e) {
      if (e.response?.status === 401 || e.response?.status === 403) {
        localStorage.removeItem('token');
        navigate('/taxatie-dealer/login');
        return;
      }
      toast.error('Laden mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setLoading(false);
  }, [token, navigate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/taxatie-dealer/login');
  };

  const counts = aanvragen.reduce((acc, a) => {
    const s = a.status || 'nieuw';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50" data-testid="dealer-dashboard">
      {/* Topbar */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/taxatie-dealer/dashboard" className="text-lg font-black tracking-tight text-zinc-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            MOTO IMPORT B.V. <span className="text-xs font-bold text-red-600 ml-2">DEALER</span>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={logout} className="p-2 text-zinc-500 hover:text-red-600 rounded-lg" title="Uitloggen" data-testid="logout-btn">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Welkom + profiel-tegel */}
        {me && (
          <section className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-gradient-to-br from-zinc-900 to-red-900 rounded-2xl p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-wider text-red-300 mb-1">Welkom terug</p>
              <h1 className="text-3xl font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{me.company_name || me.email}</h1>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <StatPill label="Totaal" value={aanvragen.length} />
                <StatPill label="Nieuw" value={counts.nieuw || 0} />
                <StatPill label="In behandeling" value={counts.in_behandeling || 0} />
                <StatPill label="Afgerond" value={counts.afgerond || 0} />
              </div>
            </div>
            <div className="bg-white rounded-2xl border p-5 text-sm space-y-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Account</p>
                <button onClick={() => setEditing(true)} className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1" data-testid="edit-profile-btn">
                  <Pencil className="w-3 h-3" />Bewerken
                </button>
              </div>
              <Info icon={Mail} value={me.email} />
              {me.phone && <Info icon={Phone} value={me.phone} />}
              {(me.address || me.city) && <Info icon={MapPin} value={[me.address, me.city].filter(Boolean).join(', ')} />}
              {me.kvk_number && <Info icon={Hash} value={`KVK: ${me.kvk_number}`} />}
              {me.rsin && <Info icon={Hash} value={`RSIN: ${me.rsin}`} />}
              {me.art8_vergunning && (
                <div className="mt-3 pt-3 border-t text-xs flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-bold">Art. 8-vergunning: {me.art8_nummer || 'ja'}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Aanvragen */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-zinc-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Mijn taxatie-aanvragen</h2>
          </div>

          {aanvragen.length === 0 ? (
            <div className="bg-white rounded-2xl border p-10 text-center" data-testid="dealer-no-aanvragen">
              <Building2 className="w-12 h-12 mx-auto text-zinc-300 mb-3" />
              <p className="font-bold text-zinc-700 mb-1">Nog geen aanvragen</p>
              <p className="text-sm text-zinc-500">Neem contact met ons op voor het indienen van een nieuwe taxatie-aanvraag.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs uppercase font-bold text-zinc-600">
                  <tr>
                    <th className="px-4 py-3 text-left">Referentie</th>
                    <th className="px-4 py-3 text-left">Datum</th>
                    <th className="px-4 py-3 text-left">Foto's</th>
                    <th className="px-4 py-3 text-left">RDW-goedkeuring</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {aanvragen.map(a => {
                    const st = STATUS[a.status || 'nieuw'];
                    const Icon = st.icon;
                    return (
                      <tr key={a.id} className="border-t" data-testid={`dealer-aanvraag-${a.id}`}>
                        <td className="px-4 py-3 font-bold text-red-700">{a.ref_nr || a.id.slice(0, 8)}</td>
                        <td className="px-4 py-3 text-zinc-600 text-xs">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          {new Date(a.created_at).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 text-xs">
                          <FileText className="w-3 h-3 inline mr-1" />
                          {(a.files || []).length}
                        </td>
                        <td className="px-4 py-3">
                          <RdwDateCell aanvraag={a} token={token} onUpdated={fetchAll} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold border ${st.color}`}>
                            <Icon className="w-3 h-3" />{st.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Edit profile modal */}
      {editing && me && (
        <EditProfileModal
          me={me}
          token={token}
          onClose={() => setEditing(false)}
          onSaved={(updated) => { setMe(updated); setEditing(false); }}
        />
      )}
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
      <p className="text-[10px] uppercase font-bold opacity-70 tracking-wide">{label}</p>
      <p className="text-2xl font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{value}</p>
    </div>
  );
}

function Info({ icon: Icon, value }) {
  return (
    <div className="flex items-center gap-2 text-zinc-700">
      <Icon className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
      <span className="truncate">{value}</span>
    </div>
  );
}

function EditProfileModal({ me, token, onClose, onSaved }) {
  const [form, setForm] = useState({
    company_name: me.company_name || '',
    contact_person: me.contact_person || '',
    phone: me.phone || '',
    kvk_number: me.kvk_number || '',
    rsin: me.rsin || '',
    address: me.address || '',
    postal_code: me.postal_code || '',
    city: me.city || '',
    art8_vergunning: !!me.art8_vergunning,
    art8_nummer: me.art8_nummer || '',
  });
  const [saving, setSaving] = useState(false);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await axios.patch(`${API}/dealer/me`, form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Profiel bijgewerkt');
      onSaved({
        ...me,
        ...data,
        // Backend retourneert mongoid-keys soms anders — map terug
        company_name: data.company_name || form.company_name,
        contact_person: data.contact_person || form.contact_person,
        phone: data.phone || form.phone,
        address: data.address || form.address,
        postal_code: data.postal_code || form.postal_code,
        city: data.city || form.city,
        kvk_number: data.kvk_number || form.kvk_number,
        rsin: data.rsin || form.rsin,
        art8_vergunning: !!data.art8_vergunning,
        art8_nummer: data.art8_nummer || form.art8_nummer,
      });
    } catch (err) {
      toast.error('Opslaan mislukt: ' + (err.response?.data?.detail || err.message));
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4" onClick={onClose} data-testid="edit-profile-modal">
      <form onSubmit={save} className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h2 className="text-xl font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Profiel bewerken</h2>
            <p className="text-xs text-zinc-500 mt-1">E-mail kan niet gewijzigd worden. Andere velden wel.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-lg" data-testid="close-edit-btn">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <Sec title="Bedrijf">
            <F label="Bedrijfsnaam" value={form.company_name} onChange={(v) => setF('company_name', v)} t="company_name" />
            <div className="grid sm:grid-cols-2 gap-3">
              <F label="KVK" value={form.kvk_number} onChange={(v) => setF('kvk_number', v)} t="kvk_number" />
              <F label="RSIN / BSN" value={form.rsin} onChange={(v) => setF('rsin', v)} t="rsin" />
            </div>
          </Sec>
          <Sec title="Contact">
            <div className="grid sm:grid-cols-2 gap-3">
              <F label="Contactpersoon" value={form.contact_person} onChange={(v) => setF('contact_person', v)} t="contact_person" />
              <F label="Telefoonnummer" value={form.phone} onChange={(v) => setF('phone', v)} t="phone" />
            </div>
          </Sec>
          <Sec title="Adres">
            <F label="Adres + huisnummer" value={form.address} onChange={(v) => setF('address', v)} t="address" />
            <div className="grid sm:grid-cols-2 gap-3">
              <F label="Postcode" value={form.postal_code} onChange={(v) => setF('postal_code', v)} t="postal_code" />
              <F label="Woonplaats" value={form.city} onChange={(v) => setF('city', v)} t="city" />
            </div>
          </Sec>
          <Sec title="Artikel 8-vergunning">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.art8_vergunning} onChange={(e) => setF('art8_vergunning', e.target.checked)}
                className="w-4 h-4 accent-red-600" data-testid="edit-art8-toggle" />
              <span className="font-semibold">Ik heb een artikel 8-vergunning</span>
            </label>
            {form.art8_vergunning && (
              <F label="Art.8 vergunning-nummer" value={form.art8_nummer} onChange={(v) => setF('art8_nummer', v)} t="art8_nummer" placeholder="bv. 810691103BPM01" />
            )}
          </Sec>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t bg-zinc-50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-100 rounded-lg" data-testid="cancel-edit-btn">Annuleren</button>
          <button type="submit" disabled={saving} className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-bold rounded-lg flex items-center gap-2" data-testid="save-profile-btn">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Opslaan</>}
          </button>
        </div>
      </form>
    </div>
  );
}

function Sec({ title, children }) {
  return (
    <div className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">{title}</h3>
      {children}
    </div>
  );
}

function F({ label, value, onChange, t, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-700 mb-1">{label}</label>
      <input
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
        data-testid={`edit-${t}`}
      />
    </div>
  );
}


function RdwDateCell({ aanvraag, token, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(aanvraag.rdw_goedkeuring_datum || '');
  const [saving, setSaving] = useState(false);

  const fmtDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return iso; }
  };

  const save = async () => {
    if (!value) return;
    setSaving(true);
    try {
      await axios.patch(
        `${API}/dealer/aanvragen/${aanvraag.id}/rdw-datum`,
        { rdw_goedkeuring_datum: value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('RDW-datum doorgegeven. Wij sturen u het verslag z.s.m.');
      setEditing(false);
      if (onUpdated) onUpdated();
    } catch (e) {
      toast.error('Mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setSaving(false);
  };

  if (aanvraag.rdw_goedkeuring_datum && !editing) {
    return (
      <div className="flex items-center gap-2" data-testid={`rdw-cell-${aanvraag.id}`}>
        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-md border border-emerald-300">
          <CheckCircle2 className="w-3 h-3" />{fmtDate(aanvraag.rdw_goedkeuring_datum)}
        </span>
        <button onClick={() => setEditing(true)} className="text-zinc-400 hover:text-red-600" title="Datum aanpassen" data-testid={`rdw-edit-${aanvraag.id}`}>
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    );
  }

  if (editing || !aanvraag.rdw_goedkeuring_datum) {
    return (
      <div className="flex items-center gap-1" data-testid={`rdw-cell-${aanvraag.id}`}>
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="text-xs border border-zinc-300 rounded px-2 py-1 focus:border-red-500 focus:outline-none"
          data-testid={`rdw-input-${aanvraag.id}`}
        />
        <button
          onClick={save}
          disabled={saving || !value}
          className="bg-red-600 hover:bg-red-700 disabled:bg-zinc-300 text-white text-xs font-bold px-2 py-1 rounded"
          data-testid={`rdw-save-${aanvraag.id}`}
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        </button>
        {editing && (
          <button onClick={() => { setEditing(false); setValue(aanvraag.rdw_goedkeuring_datum || ''); }} className="text-zinc-400 hover:text-red-600">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }
}
