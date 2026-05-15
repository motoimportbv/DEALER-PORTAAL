import React, { useEffect, useState, useCallback } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Users, Loader2, Trash2, Search, Plus, FileText, Receipt, Bike, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Link, useNavigate } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Inline editor voor de standaard fee per klant. Klik op het bedrag, type nieuw bedrag, Enter
// of focus-loss slaat op. Leeg = geen automatische fee.
function CustomerFeeEditor({ customer, onSaved, token, fieldKey, label }) {
  const initial = customer[fieldKey];
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(initial != null ? String(initial) : '');
  React.useEffect(() => {
    setValue(customer[fieldKey] != null ? String(customer[fieldKey]) : '');
  }, [customer, fieldKey]);
  const save = async () => {
    const n = value.trim() === '' ? null : Number(value);
    if (value.trim() !== '' && (Number.isNaN(n) || n < 0)) { toast.error('Ongeldig bedrag'); return; }
    try {
      await axios.post(`${API}/customers`, {
        name: customer.name,
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        city: customer.city || '',
        [fieldKey]: n,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(n != null ? `${label} \u20ac${n} opgeslagen` : `${label} verwijderd`);
      setEditing(false);
      onSaved && onSaved();
    } catch (e) { toast.error('Mislukt: ' + e.message); }
  };
  const current = customer[fieldKey];
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`px-2 py-1 rounded text-xs font-bold ${current ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'text-zinc-400 hover:bg-zinc-100'}`}
        data-testid={`${fieldKey}-edit-${customer.id}`}
      >
        {current ? `\u20ac ${current}` : '\u2014 instellen'}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1 justify-end" data-testid={`${fieldKey}-editor-${customer.id}`}>
      <span className="text-xs text-zinc-500">\u20ac</span>
      <input
        type="number"
        step="0.01"
        min="0"
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        className="w-20 border border-zinc-300 rounded px-2 py-1 text-xs"
      />
      <button type="button" onClick={save} className="text-emerald-600 hover:text-emerald-800 text-xs font-bold">OK</button>
      <button type="button" onClick={() => setEditing(false)} className="text-zinc-400 hover:text-zinc-600 text-xs">×</button>
    </div>
  );
}

// Inline editor voor RSIN/BSN per klant. Wordt automatisch gebruikt bij Aangifte BPM (veld 1.2_BSR).
function CustomerRsinEditor({ customer, onSaved, token }) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(customer.rsin || '');
  React.useEffect(() => { setValue(customer.rsin || ''); }, [customer]);
  const save = async () => {
    const v = value.trim();
    try {
      await axios.post(`${API}/customers`, {
        name: customer.name,
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || '',
        city: customer.city || '',
        rsin: v,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(v ? `RSIN ${v} opgeslagen` : 'RSIN verwijderd');
      setEditing(false);
      onSaved && onSaved();
    } catch (e) { toast.error('Mislukt: ' + e.message); }
  };
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`px-2 py-1 rounded text-xs ${customer.rsin ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 font-mono' : 'text-zinc-400 hover:bg-zinc-100'}`}
        data-testid={`rsin-edit-${customer.id}`}
      >
        {customer.rsin || '\u2014 instellen'}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1" data-testid={`rsin-editor-${customer.id}`}>
      <input
        type="text"
        maxLength={9}
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        placeholder="9 cijfers"
        className="w-24 border border-zinc-300 rounded px-2 py-1 text-xs font-mono"
      />
      <button type="button" onClick={save} className="text-emerald-600 hover:text-emerald-800 text-xs font-bold">OK</button>
      <button type="button" onClick={() => setEditing(false)} className="text-zinc-400 hover:text-zinc-600 text-xs">×</button>
    </div>
  );
}

// Detail-modal: BPM-aangifte historie + facturen + "Nieuwe taxatie voor deze klant" knop
function CustomerHistoryModal({ customerId, onClose, token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API}/customers/${customerId}/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setData(r.data))
      .catch(e => toast.error('Laden mislukt: ' + (e.response?.data?.detail || e.message)))
      .finally(() => setLoading(false));
  }, [customerId, token]);

  const fmtEur = (n) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('nl-NL') : '\u2014';

  const handleNewTaxatie = () => {
    navigate(`/admin/taxatie-programma?prefill_customer=${customerId}`);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} data-testid="customer-history-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {loading || !data ? (
          <div className="p-10 flex items-center justify-center text-zinc-500"><Loader2 className="w-5 h-5 mr-2 animate-spin" />Laden\u2026</div>
        ) : (
          <>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-zinc-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{data.customer.name}</h2>
                <div className="text-xs text-zinc-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {data.customer.phone && <span>{data.customer.phone}</span>}
                  {data.customer.email && <span>{data.customer.email}</span>}
                  {data.customer.rsin && <span className="font-mono">RSIN: {data.customer.rsin}</span>}
                  {data.customer.address && <span>{data.customer.address}{data.customer.city ? `, ${data.customer.city}` : ''}</span>}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} data-testid="customer-history-close-btn"><X className="w-4 h-4" /></Button>
            </div>

            <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50 border-b">
              <div className="bg-white rounded-lg border p-3 text-center">
                <p className="text-xs text-zinc-500 font-bold uppercase">BPM Taxaties</p>
                <p className="text-2xl font-black text-red-600" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{data.stats.taxatie_count}</p>
              </div>
              <div className="bg-white rounded-lg border p-3 text-center">
                <p className="text-xs text-zinc-500 font-bold uppercase">Facturen</p>
                <p className="text-2xl font-black text-blue-600" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{data.stats.invoice_count}</p>
              </div>
              <div className="bg-white rounded-lg border p-3 text-center">
                <p className="text-xs text-zinc-500 font-bold uppercase">BPM ontvangen</p>
                <p className="text-lg font-black text-emerald-600" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{fmtEur(data.stats.total_bpm_received)}</p>
              </div>
              <div className="bg-white rounded-lg border p-3 text-center">
                <p className="text-xs text-zinc-500 font-bold uppercase">Gefactureerd</p>
                <p className="text-lg font-black text-amber-600" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{fmtEur(data.stats.total_invoiced)}</p>
              </div>
            </div>

            <div className="px-6 py-4 space-y-5">
              <section>
                <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-700 mb-2 flex items-center gap-2"><Bike className="w-4 h-4" />BPM Taxaties ({data.taxaties.length})</h3>
                {data.taxaties.length === 0 ? (
                  <p className="text-sm text-zinc-400 italic">Nog geen BPM taxaties voor deze klant.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-zinc-50">
                        <tr>
                          <th className="text-left px-3 py-2 font-bold text-zinc-500">Nummer</th>
                          <th className="text-left px-3 py-2 font-bold text-zinc-500">Voertuig</th>
                          <th className="text-left px-3 py-2 font-bold text-zinc-500">Rapportdatum</th>
                          <th className="text-right px-3 py-2 font-bold text-zinc-500">BPM</th>
                          <th className="text-left px-3 py-2 font-bold text-zinc-500">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.taxaties.map(t => (
                          <tr key={t.id} className="border-t hover:bg-zinc-50" data-testid={`history-taxatie-${t.id}`}>
                            <td className="px-3 py-2 font-mono">{t.taxatie_nummer || '\u2014'}</td>
                            <td className="px-3 py-2 font-bold">{t.brand} {t.model}</td>
                            <td className="px-3 py-2">{fmtDate(t.report_date || t.created_at)}</td>
                            <td className="px-3 py-2 text-right font-bold text-red-600">{fmtEur(t.netto_bpm)}</td>
                            <td className="px-3 py-2">
                              {t.bpm_received_at ? (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Ontvangen</span>
                              ) : t.status === 'definitief' ? (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Definitief</span>
                              ) : (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Concept</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-700 mb-2 flex items-center gap-2"><Receipt className="w-4 h-4" />Taxatie Facturen ({data.invoices.length})</h3>
                {data.invoices.length === 0 ? (
                  <p className="text-sm text-zinc-400 italic">Nog geen facturen voor deze klant.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-zinc-50">
                        <tr>
                          <th className="text-left px-3 py-2 font-bold text-zinc-500">Nummer</th>
                          <th className="text-left px-3 py-2 font-bold text-zinc-500">Datum</th>
                          <th className="text-right px-3 py-2 font-bold text-zinc-500">Bedrag</th>
                          <th className="text-left px-3 py-2 font-bold text-zinc-500">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.invoices.map(i => (
                          <tr key={i.id} className="border-t hover:bg-zinc-50" data-testid={`history-invoice-${i.id}`}>
                            <td className="px-3 py-2 font-mono">{i.invoice_number || '\u2014'}</td>
                            <td className="px-3 py-2">{fmtDate(i.created_at)}</td>
                            <td className="px-3 py-2 text-right font-bold">{fmtEur(i.total_incl_btw)}</td>
                            <td className="px-3 py-2">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${i.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {i.status === 'paid' ? 'Betaald' : 'Open'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-3 flex items-center justify-between gap-2">
              <p className="text-xs text-zinc-500">
                {data.customer.default_taxatie_fee ? `Taxatietarief: \u20ac${data.customer.default_taxatie_fee}` : 'Standaard taxatietarief \u20ac160'}
                {data.customer.default_fee ? ` \u2022 Extra fee: \u20ac${data.customer.default_fee}` : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={onClose} data-testid="history-cancel-btn">Sluiten</Button>
                <Button onClick={handleNewTaxatie} className="bg-red-600 hover:bg-red-700 text-white" data-testid="history-new-taxatie-btn">
                  <FileText className="w-4 h-4 mr-2" />Nieuwe BPM Taxatie
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


export default function CustomerDirectory() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '', city: '', default_fee: '', default_taxatie_fee: '', rsin: '' });
  const [historyCustomerId, setHistoryCustomerId] = useState(null);
  const isAllowed = user?.email?.toLowerCase() === 'motoimportbv@gmail.com' || user?.role === 'admin' || user?.role === 'taxateur';

  const fetchCustomers = useCallback(async () => {
    if (!isAllowed) { setLoading(false); return; }
    try {
      const url = q.trim() ? `${API}/customers?q=${encodeURIComponent(q)}` : `${API}/customers`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setCustomers(res.data || []);
    } catch (e) { toast.error('Laden mislukt: ' + e.message); }
    setLoading(false);
  }, [token, q, isAllowed]);

  useEffect(() => {
    const t = setTimeout(fetchCustomers, 200);
    return () => clearTimeout(t);
  }, [fetchCustomers]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Klant '${name}' verwijderen?`)) return;
    try {
      await axios.delete(`${API}/customers/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Klant verwijderd');
      fetchCustomers();
    } catch (e) { toast.error('Mislukt: ' + e.message); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newCustomer.name.trim()) { toast.error('Naam is verplicht'); return; }
    try {
      await axios.post(`${API}/customers`, newCustomer, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Klant opgeslagen');
      setShowAdd(false);
      setNewCustomer({ name: '', phone: '', email: '', address: '', city: '', default_fee: '', default_taxatie_fee: '', rsin: '' });
      fetchCustomers();
    } catch (e) { toast.error('Mislukt: ' + (e.response?.data?.detail || e.message)); }
  };

  if (!isAllowed) return <Layout><div className="flex items-center justify-center h-64 text-zinc-500">Geen toegang.</div></Layout>;

  return (
    <Layout>
      <div className="space-y-6" data-testid="customer-directory">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <Users className="w-7 h-7 text-red-600" /> Mijn Klanten
            </h1>
            <p className="text-zinc-500 mt-1">{customers.length} klant{customers.length === 1 ? '' : 'en'} opgeslagen</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowAdd(true)} className="bg-red-600 hover:bg-red-700 text-white" data-testid="add-customer-btn">
              <Plus className="w-4 h-4 mr-2" />Klant toevoegen
            </Button>
            <Link to="/admin/taxatie-programma">
              <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />Terug</Button>
            </Link>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek op naam, telefoon, email of stad..."
            className="w-full pl-10 pr-4 py-2.5 border border-zinc-300 rounded-xl bg-white text-sm focus:border-red-500 focus:outline-none"
            data-testid="customer-search-input"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
        ) : customers.length === 0 ? (
          <div className="bg-white rounded-2xl border p-10 text-center text-zinc-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-bold mb-1">Nog geen klanten</p>
            <p className="text-sm">Klanten worden automatisch toegevoegd zodra je een factuur of taxatie aanmaakt.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-bold uppercase text-zinc-500">Naam</th>
                  <th className="text-left px-4 py-2 text-xs font-bold uppercase text-zinc-500">Telefoon</th>
                  <th className="text-left px-4 py-2 text-xs font-bold uppercase text-zinc-500">E-mail</th>
                  <th className="text-left px-4 py-2 text-xs font-bold uppercase text-zinc-500">Adres</th>
                  <th className="text-left px-4 py-2 text-xs font-bold uppercase text-zinc-500">Stad</th>
                  <th className="text-left px-4 py-2 text-xs font-bold uppercase text-zinc-500">RSIN</th>
                  <th className="text-right px-4 py-2 text-xs font-bold uppercase text-zinc-500">Taxatie tarief</th>
                  <th className="text-right px-4 py-2 text-xs font-bold uppercase text-zinc-500">Extra fee</th>
                  <th className="text-center px-4 py-2 text-xs font-bold uppercase text-zinc-500">Gebruikt</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} className="border-t border-zinc-100 hover:bg-zinc-50" data-testid={`customer-row-${c.id}`}>
                    <td className="px-4 py-3 font-bold">
                      <button
                        type="button"
                        onClick={() => setHistoryCustomerId(c.id)}
                        className="text-left hover:text-red-600 hover:underline transition-colors"
                        data-testid={`customer-history-${c.id}`}
                      >{c.name}</button>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{c.phone || '\u2014'}</td>
                    <td className="px-4 py-3 text-zinc-700">{c.email || '\u2014'}</td>
                    <td className="px-4 py-3 text-zinc-700">{c.address || '\u2014'}</td>
                    <td className="px-4 py-3 text-zinc-700">{c.city || '\u2014'}</td>
                    <td className="px-4 py-3 text-zinc-700 font-mono text-xs">
                      <CustomerRsinEditor customer={c} onSaved={fetchCustomers} token={token} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <CustomerFeeEditor customer={c} onSaved={fetchCustomers} token={token} fieldKey="default_taxatie_fee" label="Taxatietarief" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <CustomerFeeEditor customer={c} onSaved={fetchCustomers} token={token} fieldKey="default_fee" label="Extra fee" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">{c.usage_count || 0}\u00d7</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id, c.name)}
                        className="p-2 rounded-lg hover:bg-red-100 text-red-500"
                        title="Verwijderen"
                        data-testid={`delete-customer-${c.id}`}
                      ><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showAdd && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAdd(false)} data-testid="add-customer-modal">
            <form onSubmit={handleAdd} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-zinc-200 bg-red-50">
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-red-600" />
                  <h2 className="text-lg font-black text-zinc-900">Nieuwe klant</h2>
                </div>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { k: 'name', l: 'Naam *', p: 'Jan Jansen' },
                  { k: 'phone', l: 'Telefoon', p: '06-12345678' },
                  { k: 'email', l: 'E-mail', p: 'jan@email.nl' },
                  { k: 'address', l: 'Adres', p: 'Straatnaam 1' },
                  { k: 'city', l: 'Stad', p: 'Amsterdam' },
                  { k: 'rsin', l: 'RSIN / BSN (Belastingdienst)', p: 'bv. 866851525 — auto-invullen op Aangifte BPM' },
                  { k: 'default_taxatie_fee', l: 'Taxatietarief (\u20ac, optioneel)', p: 'standaard 160 — anders bv. 175', type: 'number' },
                  { k: 'default_fee', l: 'Extra fee (\u20ac, optioneel)', p: 'bv. 60 — leeg = geen automatische fee', type: 'number' },
                ].map(f => (
                  <div key={f.k}>
                    <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">{f.l}</label>
                    <input
                      type={f.type || 'text'}
                      step={f.type === 'number' ? '0.01' : undefined}
                      min={f.type === 'number' ? '0' : undefined}
                      value={newCustomer[f.k]}
                      onChange={e => setNewCustomer({ ...newCustomer, [f.k]: e.target.value })}
                      placeholder={f.p}
                      className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                      data-testid={`new-customer-${f.k}`}
                    />
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-zinc-200 bg-zinc-50 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-zinc-300 hover:bg-zinc-100">Annuleren</button>
                <button type="submit" disabled={!newCustomer.name.trim()} className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50" data-testid="save-customer-btn">Opslaan</button>
              </div>
            </form>
          </div>
        )}
        {historyCustomerId && (
          <CustomerHistoryModal
            customerId={historyCustomerId}
            token={token}
            onClose={() => setHistoryCustomerId(null)}
          />
        )}
      </div>
    </Layout>
  );
}
