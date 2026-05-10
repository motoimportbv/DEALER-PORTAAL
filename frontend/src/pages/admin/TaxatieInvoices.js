import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getBranding } from '../../utils/branding';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Plus,
  FileText,
  Printer,
  Trash2,
  ChevronLeft,
  CheckCircle,
  Clock,
  X,
  Euro,
  Bike,
  User,
  Edit,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BRANDS = ['BMW', 'Ducati', 'Honda', 'Kawasaki', 'KTM', 'Triumph', 'Yamaha', 'Suzuki', 'Harley-Davidson', 'Aprilia', 'Moto Guzzi', 'Brixton', 'Overig'];

const emptyForm = {
  customer_name: '', customer_address: '', customer_city: '', customer_phone: '', customer_email: '',
  invoice_type: 'both', // 'taxatie_only', 'fee_only', 'both'
  taxatie_items: [{ brand: '', model: '', year: '', vin: '', license_plate: '', fee: 160, taxatie_value: '' }],
  extra_fee: 60, extra_fee_no_btw: true,
  notes: '', date: new Date().toISOString().split('T')[0],
};

export default function TaxatieInvoices() {
  const { token, user } = useAuth();
  const cb = getBranding(user);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'create' | 'detail'
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState(null);  // null = create, anders = edit modus
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [saving, setSaving] = useState(false);
  const printRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/taxatie/invoices`, { headers });
      setInvoices(res.data);
    } catch {
      toast.error('Kon facturen niet laden');
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // ===== Klantenbestand met autocomplete =====
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  useEffect(() => {
    let cancel = false;
    const t = setTimeout(async () => {
      const q = customerQuery.trim();
      if (q.length < 2) { setCustomerSuggestions([]); return; }
      try {
        const res = await axios.get(`${API}/customers?q=${encodeURIComponent(q)}`, { headers });
        if (!cancel) setCustomerSuggestions(res.data || []);
      } catch { /* stilte: niet kritisch */ }
    }, 200);
    return () => { cancel = true; clearTimeout(t); };
  }, [customerQuery, token]);
  const pickCustomer = (c) => {
    setForm(f => ({
      ...f,
      customer_name: c.name || '',
      customer_phone: c.phone || '',
      customer_address: c.address || '',
      customer_city: c.city || '',
      customer_email: c.email || '',
    }));
    setCustomerQuery(c.name || '');
    setShowSuggestions(false);
  };

  // Auto-refresh when tab/app becomes visible again
  useEffect(() => {
    const onFocus = () => fetchInvoices();
    const onVisible = () => { if (document.visibilityState === 'visible') fetchInvoices(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisible); };
  }, [fetchInvoices]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.customer_name) { toast.error('Vul een klantnaam in'); return; }
    setSaving(true);
    try {
      // Map new format to backend
      const items = form.taxatie_items || [];
      const firstItem = items[0] || {};
      const totalFee = items.reduce((s, i) => s + (parseFloat(i.fee) || 0), 0);
      const payload = {
        customer_name: form.customer_name,
        customer_address: form.customer_address,
        customer_city: form.customer_city,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email,
        motorcycle_brand: firstItem.brand || '',
        motorcycle_model: firstItem.model || '',
        motorcycle_year: firstItem.year || '',
        motorcycle_license_plate: firstItem.license_plate || '',
        motorcycle_vin: firstItem.vin || '',
        taxatie_value: parseFloat(firstItem.taxatie_value) || 0,
        fee: (form.invoice_type === 'fee_only') ? 0 : totalFee,
        include_extra_fee: form.invoice_type === 'fee_only' || form.invoice_type === 'both',
        extra_fee: parseFloat(form.extra_fee) || 60,
        extra_fee_no_btw: form.extra_fee_no_btw,
        invoice_type: form.invoice_type,
        taxatie_items: items,
        notes: form.notes,
        date: form.date,
      };
      const res = editingId
        ? await axios.put(`${API}/taxatie/invoices/${editingId}`, payload, { headers })
        : await axios.post(`${API}/taxatie/invoices`, payload, { headers });
      if (editingId) {
        toast.success('Factuur bijgewerkt');
      } else {
        toast.success(`Factuur #${res.data.invoice_number} aangemaakt`);
      }
      setEditingId(null);
      setForm({ ...emptyForm, taxatie_items: [{ brand: '', model: '', year: '', vin: '', license_plate: '', fee: 160, taxatie_value: '' }] });
      setView('list');
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Fout bij aanmaken');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Weet u zeker dat u deze factuur wilt verwijderen?')) return;
    try {
      await axios.delete(`${API}/taxatie/invoices/${id}`, { headers });
      toast.success('Factuur verwijderd');
      if (view === 'detail') setView('list');
      fetchInvoices();
    } catch {
      toast.error('Fout bij verwijderen');
    }
  };

  const handleStatusToggle = async (inv) => {
    const nextStatus = inv.status === 'concept' ? 'open' : inv.status === 'open' ? 'betaald' : 'open';
    try {
      await axios.put(`${API}/taxatie/invoices/${inv.id}`, { status: nextStatus }, { headers });
      toast.success(`Status gewijzigd naar ${nextStatus}`);
      if (selectedInvoice) setSelectedInvoice({ ...selectedInvoice, status: nextStatus });
      fetchInvoices();
    } catch {
      toast.error('Fout bij bijwerken');
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Taxatie Factuur</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; padding: 40px; }
        .invoice { max-width: 800px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #dc2626; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { font-size: 28px; color: #dc2626; font-weight: 800; letter-spacing: -0.5px; }
        .header .company { text-align: right; font-size: 13px; color: #555; line-height: 1.6; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
        .meta-box { background: #f8f8f8; border-radius: 8px; padding: 16px; }
        .meta-box h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 8px; font-weight: 700; }
        .meta-box p { font-size: 13px; line-height: 1.7; color: #333; }
        .meta-box strong { color: #111; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #1a1a1a; color: white; padding: 10px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
        td { padding: 12px 16px; border-bottom: 1px solid #eee; font-size: 14px; }
        .total-row td { font-weight: 700; font-size: 16px; border-top: 2px solid #1a1a1a; background: #fafafa; }
        .bank { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin-top: 20px; }
        .bank h3 { font-size: 14px; font-weight: 700; color: #92400e; margin-bottom: 8px; }
        .bank p { font-size: 14px; color: #78350f; line-height: 1.8; }
        .notes { margin-top: 20px; font-size: 13px; color: #666; line-height: 1.6; padding-top: 16px; border-top: 1px solid #eee; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #aaa; padding-top: 16px; border-top: 1px solid #eee; }
        @media print { body { padding: 20px; } .no-print { display: none; } }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  const openDetail = (inv) => {
    setSelectedInvoice(inv);
    setView('detail');
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(num);
  };

  // ===== LIST VIEW =====
  if (view === 'list') {
    return (
      <Layout>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900" data-testid="taxatie-title">
              Taxatie Facturen
            </h1>
            <p className="text-zinc-500 mt-1">Beheer uw taxatie facturen</p>
          </div>
          <Button onClick={() => { setForm({ ...emptyForm }); setEditingId(null); setView('create'); }} className="bg-red-600 hover:bg-red-700 text-white" data-testid="create-invoice-btn">
            <Plus className="w-4 h-4 mr-2" /> Nieuwe Factuur
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : invoices.length === 0 ? (
          <Card><CardContent className="py-16 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-zinc-300" />
            <h3 className="font-barlow text-xl font-bold uppercase text-zinc-700 mb-2">Geen facturen</h3>
            <p className="text-zinc-500 mb-4">Maak uw eerste taxatie factuur aan</p>
            <Button onClick={() => setView('create')} className="bg-red-600 hover:bg-red-700 text-white"><Plus className="w-4 h-4 mr-2" /> Nieuwe Factuur</Button>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                onClick={() => openDetail(inv)}
                className="flex items-center justify-between bg-white border border-zinc-200 rounded-xl px-5 py-4 cursor-pointer hover:border-red-300 hover:shadow-sm transition-all"
                data-testid={`invoice-row-${inv.invoice_number}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${inv.status === 'betaald' ? 'bg-green-100' : inv.status === 'concept' ? 'bg-zinc-100' : 'bg-amber-100'}`}>
                    {inv.status === 'betaald' ? <CheckCircle className="w-5 h-5 text-green-600" /> : inv.status === 'concept' ? <FileText className="w-5 h-5 text-zinc-500" /> : <Clock className="w-5 h-5 text-amber-600" />}
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900 text-sm">#{inv.invoice_number} — {inv.customer_name}</p>
                    <p className="text-xs text-zinc-500">{inv.motorcycle_brand} {inv.motorcycle_model} {inv.motorcycle_year ? `(${inv.motorcycle_year})` : ''} {inv.motorcycle_vin ? `· ${inv.motorcycle_vin}` : ''} · {inv.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-zinc-900">{formatCurrency(
                    ((parseFloat(inv.fee) || 0) * 1.21) + (inv.include_extra_fee ? (parseFloat(inv.extra_fee) || 0) : 0)
                  )}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${inv.status === 'betaald' ? 'bg-green-100 text-green-700' : inv.status === 'concept' ? 'bg-zinc-100 text-zinc-600' : 'bg-amber-100 text-amber-700'}`}>
                    {inv.status === 'betaald' ? 'Betaald' : inv.status === 'concept' ? 'Concept' : 'Open'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Layout>
    );
  }

  // ===== CREATE VIEW =====
  if (view === 'create') {
    return (
      <Layout>
        <button onClick={() => { setEditingId(null); setView('list'); }} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 text-sm mb-6 transition-colors" data-testid="back-to-list">
          <ChevronLeft className="w-4 h-4" /> Terug naar overzicht
        </button>
        <h1 className="font-barlow text-2xl font-bold uppercase tracking-tight text-zinc-900 mb-6">{editingId ? 'Taxatie Factuur Bewerken' : 'Nieuwe Taxatie Factuur'}</h1>

        <form onSubmit={handleCreate} className="space-y-6 max-w-3xl" data-testid="taxatie-form">
          {/* Klantgegevens */}
          <Card><CardContent className="pt-6">
            <h3 className="flex items-center gap-2 font-bold text-zinc-700 text-sm uppercase tracking-wider mb-4"><User className="w-4 h-4" /> Klantgegevens</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-zinc-600 mb-1">Naam *</label>
                <input
                  data-testid="tax-customer-name"
                  value={form.customer_name}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm({ ...form, customer_name: v });
                    setCustomerQuery(v);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => { if ((form.customer_name || '').length >= 2) setShowSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                  placeholder="Jan de Vries — type om bestaande klant te kiezen"
                  autoComplete="off"
                />
                {showSuggestions && customerSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-zinc-300 rounded-lg shadow-lg max-h-60 overflow-y-auto z-30" data-testid="customer-suggestions">
                    {customerSuggestions.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); pickCustomer(c); }}
                        className="w-full text-left px-3 py-2 hover:bg-red-50 border-b border-zinc-100 last:border-b-0"
                        data-testid={`customer-suggestion-${c.id}`}
                      >
                        <div className="font-bold text-sm">{c.name}</div>
                        <div className="text-xs text-zinc-500 flex flex-wrap gap-x-2">
                          {c.phone && <span>{c.phone}</span>}
                          {c.city && <span>· {c.city}</span>}
                          {c.email && <span>· {c.email}</span>}
                          {c.usage_count > 1 && <span className="ml-auto text-zinc-400">{c.usage_count}× gebruikt</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Telefoon</label>
                <input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="06-12345678" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Adres</label>
                <input value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Straatnaam 1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Woonplaats</label>
                <input value={form.customer_city} onChange={(e) => setForm({ ...form, customer_city: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Amsterdam" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-zinc-600 mb-1">E-mail</label>
                <input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="klant@email.nl" />
              </div>
            </div>
          </CardContent></Card>

          {/* Factuurtype keuze */}
          <Card><CardContent className="pt-6">
            <h3 className="flex items-center gap-2 font-bold text-zinc-700 text-sm uppercase tracking-wider mb-4"><Euro className="w-4 h-4" /> Type Factuur</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'taxatie_only', label: 'Alleen taxatiekosten', desc: 'Taxatie per motor met BTW' },
                { value: 'fee_only', label: 'Alleen fee kosten', desc: 'Fee zonder BTW' },
                { value: 'both', label: 'Taxatie + Fee', desc: 'Beide op één factuur' },
              ].map(opt => (
                <button key={opt.value} type="button" onClick={() => setForm({ ...form, invoice_type: opt.value })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${form.invoice_type === opt.value ? 'border-red-500 bg-red-50' : 'border-zinc-200 hover:border-zinc-300'}`}
                  data-testid={`type-${opt.value}`}>
                  <span className={`text-sm font-bold ${form.invoice_type === opt.value ? 'text-red-700' : 'text-zinc-700'}`}>{opt.label}</span>
                  <p className="text-xs text-zinc-500 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Datum</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" />
              </div>
            </div>
          </CardContent></Card>

          {/* Taxatie regels (motoren) */}
          {form.invoice_type !== 'fee_only' && (
            <Card><CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 font-bold text-zinc-700 text-sm uppercase tracking-wider"><Bike className="w-4 h-4" /> Taxatie Regels ({form.taxatie_items.length})</h3>
                <Button type="button" size="sm" variant="outline" className="text-xs" data-testid="add-taxatie-item"
                  onClick={() => setForm({ ...form, taxatie_items: [...form.taxatie_items, { brand: '', model: '', year: '', vin: '', license_plate: '', fee: 160, taxatie_value: '' }] })}>
                  <Plus className="w-3 h-3 mr-1" /> Motor toevoegen
                </Button>
              </div>
              {form.taxatie_items.map((item, idx) => (
                <div key={idx} className={`border rounded-xl p-4 mb-3 ${form.taxatie_items.length > 1 ? 'border-zinc-200' : 'border-transparent'}`}>
                  {form.taxatie_items.length > 1 && (
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-zinc-500 uppercase">Motor {idx + 1}</span>
                      <button type="button" onClick={() => { const next = form.taxatie_items.filter((_, i) => i !== idx); setForm({ ...form, taxatie_items: next }); }}
                        className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Merk</label>
                      <select value={item.brand} onChange={(e) => { const next = [...form.taxatie_items]; next[idx] = { ...item, brand: e.target.value }; setForm({ ...form, taxatie_items: next }); }}
                        className="w-full border border-zinc-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-red-500" data-testid={`item-brand-${idx}`}>
                        <option value="">Merk</option>
                        {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Model</label>
                      <input value={item.model} onChange={(e) => { const next = [...form.taxatie_items]; next[idx] = { ...item, model: e.target.value }; setForm({ ...form, taxatie_items: next }); }}
                        className="w-full border border-zinc-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-red-500" placeholder="Model" data-testid={`item-model-${idx}`} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Bouwjaar</label>
                      <input type="number" value={item.year} onChange={(e) => { const next = [...form.taxatie_items]; next[idx] = { ...item, year: e.target.value }; setForm({ ...form, taxatie_items: next }); }}
                        className="w-full border border-zinc-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-red-500" placeholder="2023" data-testid={`item-year-${idx}`} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Taxatie kosten</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1.5 text-xs text-zinc-400">€</span>
                        <input type="number" value={item.fee} onChange={(e) => { const next = [...form.taxatie_items]; next[idx] = { ...item, fee: e.target.value }; setForm({ ...form, taxatie_items: next }); }}
                          className="w-full border border-zinc-300 rounded-lg pl-6 pr-2 py-1.5 text-sm font-bold focus:outline-none focus:border-red-500" data-testid={`item-fee-${idx}`} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Chassisnummer (VIN)</label>
                      <input value={item.vin} onChange={(e) => { const next = [...form.taxatie_items]; next[idx] = { ...item, vin: e.target.value.toUpperCase() }; setForm({ ...form, taxatie_items: next }); }}
                        className="w-full border border-zinc-300 rounded-lg px-2 py-1.5 text-sm uppercase focus:outline-none focus:border-red-500" placeholder="VIN" data-testid={`item-vin-${idx}`} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">Kenteken</label>
                      <input value={item.license_plate} onChange={(e) => { const next = [...form.taxatie_items]; next[idx] = { ...item, license_plate: e.target.value.toUpperCase() }; setForm({ ...form, taxatie_items: next }); }}
                        className="w-full border border-zinc-300 rounded-lg px-2 py-1.5 text-sm uppercase focus:outline-none focus:border-red-500" placeholder="XX-123-YY" data-testid={`item-plate-${idx}`} />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent></Card>
          )}

          {/* Fee kosten */}
          {(form.invoice_type === 'fee_only' || form.invoice_type === 'both') && (
            <Card><CardContent className="pt-6">
              <h3 className="flex items-center gap-2 font-bold text-zinc-700 text-sm uppercase tracking-wider mb-4"><Euro className="w-4 h-4" /> Fee Kosten</h3>
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-600 mb-1">Fee bedrag</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-zinc-400">€</span>
                    <input type="number" value={form.extra_fee} onChange={(e) => setForm({ ...form, extra_fee: e.target.value })}
                      className="w-40 border border-zinc-300 rounded-lg pl-7 pr-3 py-2 text-sm font-bold focus:outline-none focus:border-red-500" data-testid="fee-amount" />
                  </div>
                </div>
                <div className="pt-5">
                  <label className="flex items-center gap-2 cursor-pointer" data-testid="fee-no-btw-toggle">
                    <input type="checkbox" checked={form.extra_fee_no_btw || false} onChange={(e) => setForm({ ...form, extra_fee_no_btw: e.target.checked })}
                      className="w-4 h-4 rounded border-zinc-300 text-red-600 focus:ring-red-500" />
                    <span className="text-sm text-zinc-700">Zonder BTW</span>
                  </label>
                </div>
              </div>
            </CardContent></Card>
          )}

          {/* Totaaloverzicht */}
          {(() => {
            const items = form.taxatie_items || [];
            const taxatieFee = items.reduce((s, i) => s + (parseFloat(i.fee) || 0), 0);
            const showTaxatie = form.invoice_type !== 'fee_only';
            const showFee = form.invoice_type === 'fee_only' || form.invoice_type === 'both';
            const taxatieBtw = showTaxatie ? taxatieFee * 0.21 : 0;
            const feeAmount = showFee ? (parseFloat(form.extra_fee) || 0) : 0;
            const total = (showTaxatie ? taxatieFee + taxatieBtw : 0) + feeAmount;
            return (
              <div className="bg-zinc-900 rounded-xl p-5 text-white">
                {showTaxatie && items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-400">Taxatie {item.brand} {item.model} {item.year}</span>
                    <span>{formatCurrency(parseFloat(item.fee) || 0)}</span>
                  </div>
                ))}
                {showTaxatie && (
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-400">BTW 21%</span>
                    <span>{formatCurrency(taxatieBtw)}</span>
                  </div>
                )}
                {showFee && (
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-400">Fee kosten{form.extra_fee_no_btw ? ' (zonder BTW)' : ''}</span>
                    <span>{formatCurrency(feeAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t border-zinc-700">
                  <span>Totaal te betalen</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            );
          })()}

          <Card><CardContent className="pt-6">
            <div>
              <label className="block text-sm font-medium text-zinc-600 mb-1">Opmerkingen</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 resize-none" placeholder="Eventuele opmerkingen..." />
            </div>
          </CardContent></Card>

          {/* Bank info preview */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm">
            <p className="font-bold text-amber-800 mb-1">Betaalinformatie op factuur:</p>
            <p className="text-amber-700">t.n.v. <strong>S. Milone</strong> — IBAN: <strong>NL84 BUNQ 2159 3568 75</strong></p>
          </div>

          <Button type="submit" disabled={saving} data-testid="save-invoice" className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 font-semibold rounded-xl">
            {saving ? 'Opslaan...' : (editingId ? 'Wijzigingen Opslaan' : 'Factuur Aanmaken')}
          </Button>
        </form>
      </Layout>
    );
  }

  // ===== DETAIL VIEW (with Print) =====
  if (view === 'detail' && selectedInvoice) {
    const inv = selectedInvoice;
    return (
      <Layout>
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setView('list')} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 text-sm transition-colors" data-testid="back-from-detail">
            <ChevronLeft className="w-4 h-4" /> Terug
          </button>
          <div className="flex items-center gap-2">
            <Button onClick={() => {
              // Laad factuur in form voor bewerking
              const items = (inv.taxatie_items && inv.taxatie_items.length > 0)
                ? inv.taxatie_items.map(it => ({
                    brand: it.brand || '',
                    model: it.model || '',
                    year: it.year || '',
                    vin: it.vin || '',
                    license_plate: it.license_plate || '',
                    fee: it.fee ?? 160,
                    taxatie_value: it.taxatie_value ?? '',
                  }))
                : [{
                    brand: inv.motorcycle_brand || '',
                    model: inv.motorcycle_model || '',
                    year: inv.motorcycle_year || '',
                    vin: inv.motorcycle_vin || '',
                    license_plate: inv.motorcycle_license_plate || '',
                    fee: inv.fee ?? 160,
                    taxatie_value: inv.taxatie_value ?? '',
                  }];
              setForm({
                customer_name: inv.customer_name || '',
                customer_address: inv.customer_address || '',
                customer_city: inv.customer_city || '',
                customer_phone: inv.customer_phone || '',
                customer_email: inv.customer_email || '',
                taxatie_items: items,
                notes: inv.notes || '',
                btw_percentage: inv.btw_percentage ?? 21,
                invoice_type: inv.invoice_type || 'taxatie_only',
                extra_fee: inv.extra_fee ?? 60,
                extra_fee_no_btw: inv.extra_fee_no_btw ?? true,
                date: inv.date || new Date().toISOString().split('T')[0],
              });
              setEditingId(inv.id);
              setView('create');
            }} variant="outline" className="text-sm" data-testid="edit-invoice-btn">
              <Edit className="w-4 h-4 mr-1" /> Bewerken
            </Button>
            <Button onClick={() => handleStatusToggle(inv)} variant="outline" className="text-sm" data-testid="toggle-status-btn">
              {inv.status === 'concept' ? <><Clock className="w-4 h-4 mr-1" /> Naar Open</> : inv.status === 'open' ? <><CheckCircle className="w-4 h-4 mr-1" /> Markeer Betaald</> : <><Clock className="w-4 h-4 mr-1" /> Markeer Open</>}
            </Button>
            <Button onClick={handlePrint} className="bg-zinc-900 hover:bg-zinc-800 text-white text-sm" data-testid="print-invoice-btn">
              <Printer className="w-4 h-4 mr-2" /> Printen / PDF
            </Button>
            <Button onClick={() => handleDelete(inv.id)} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 text-sm" data-testid="delete-invoice-btn">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Printable invoice */}
        <div ref={printRef}>
          <div className="invoice">
            <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #dc2626', paddingBottom: '20px', marginBottom: '30px' }}>
              <div>
                <h1 style={{ fontSize: '28px', color: '#dc2626', fontWeight: 800 }}>TAXATIE FACTUUR</h1>
                <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>Factuurnummer: <strong style={{ color: '#111' }}>#{inv.invoice_number}</strong></p>
                <p style={{ fontSize: '13px', color: '#888' }}>Datum: <strong style={{ color: '#111' }}>{inv.date}</strong></p>
                <p style={{ fontSize: '13px', color: '#888' }}>Status: <strong style={{ color: inv.status === 'betaald' ? '#16a34a' : inv.status === 'concept' ? '#6b7280' : '#d97706' }}>{inv.status === 'betaald' ? 'BETAALD' : inv.status === 'concept' ? 'CONCEPT' : 'OPEN'}</strong></p>
              </div>
              <div style={{ textAlign: 'right', fontSize: '13px', color: '#555', lineHeight: '1.6' }}>
                <strong style={{ color: '#111' }}>{cb.name}</strong><br />
                {cb.email && <>{cb.email}<br /></>}
                {cb.phone && <>{cb.phone}</>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
              <div style={{ background: '#f8f8f8', borderRadius: '8px', padding: '16px' }}>
                <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#888', marginBottom: '8px', fontWeight: 700 }}>Klantgegevens</h3>
                <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#333' }}>
                  <strong>{inv.customer_name}</strong><br />
                  {inv.customer_address && <>{inv.customer_address}<br /></>}
                  {inv.customer_city && <>{inv.customer_city}<br /></>}
                  {inv.customer_phone && <>Tel: {inv.customer_phone}<br /></>}
                  {inv.customer_email && <>E-mail: {inv.customer_email}</>}
                </p>
              </div>
              <div style={{ background: '#f8f8f8', borderRadius: '8px', padding: '16px' }}>
                <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#888', marginBottom: '8px', fontWeight: 700 }}>Motorgegevens</h3>
                <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#333' }}>
                  {(inv.taxatie_items && inv.taxatie_items.length > 0) ? inv.taxatie_items.map((item, idx) => (
                    <span key={idx}>
                      {idx > 0 && <br />}
                      <strong>{item.brand} {item.model}</strong> ({item.year || '-'})
                      {item.vin && <> · VIN: {item.vin}</>}
                      {item.license_plate && <> · {item.license_plate}</>}
                    </span>
                  )) : (
                    <>
                      {inv.motorcycle_brand && <><strong>{inv.motorcycle_brand} {inv.motorcycle_model}</strong><br /></>}
                      Bouwjaar: <strong>{inv.motorcycle_year || '-'}</strong><br />
                      Chassisnummer: <strong>{inv.motorcycle_vin || '-'}</strong><br />
                      {inv.motorcycle_license_plate && <>Kenteken: <strong>{inv.motorcycle_license_plate}</strong></>}
                    </>
                  )}
                </p>
              </div>
            </div>

            {(() => {
              const items = inv.taxatie_items && inv.taxatie_items.length > 0 ? inv.taxatie_items : [];
              const showTaxatie = inv.invoice_type !== 'fee_only';
              const showFee = inv.invoice_type === 'fee_only' || inv.invoice_type === 'both' || inv.include_extra_fee;
              const taxatieFee = showTaxatie ? (items.length > 0 ? items.reduce((s, i) => s + (parseFloat(i.fee) || 0), 0) : (parseFloat(inv.fee) || 0)) : 0;
              const taxatieBtw = taxatieFee * ((inv.btw_percentage || 21) / 100);
              const feeAmount = showFee ? (parseFloat(inv.extra_fee) || 0) : 0;
              const total = taxatieFee + taxatieBtw + feeAmount;

              return (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                    <thead>
                      <tr>
                        <th style={{ background: '#1a1a1a', color: 'white', padding: '10px 16px', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Omschrijving</th>
                        <th style={{ background: '#1a1a1a', color: 'white', padding: '10px 16px', textAlign: 'right', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', width: '150px' }}>Bedrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {showTaxatie && items.length > 0 && items.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontSize: '14px' }}>
                            Taxatie {item.brand} {item.model} {item.year ? `(${item.year})` : ''}
                            {item.vin && <span style={{ color: '#888', fontSize: '12px' }}> · {item.vin}</span>}
                          </td>
                          <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontSize: '14px', textAlign: 'right' }}>{formatCurrency(item.fee)}</td>
                        </tr>
                      ))}
                      {showTaxatie && items.length === 0 && (
                        <tr>
                          <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontSize: '14px' }}>Taxatie kosten</td>
                          <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontSize: '14px', textAlign: 'right' }}>{formatCurrency(inv.fee)}</td>
                        </tr>
                      )}
                      {showTaxatie && (
                        <tr>
                          <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontSize: '14px' }}>BTW {inv.btw_percentage || 21}%</td>
                          <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontSize: '14px', textAlign: 'right' }}>{formatCurrency(taxatieBtw)}</td>
                        </tr>
                      )}
                      {showFee && (
                        <tr>
                          <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontSize: '14px' }}>Fee kosten{inv.extra_fee_no_btw ? ' (zonder BTW)' : ''}</td>
                          <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontSize: '14px', textAlign: 'right' }}>{formatCurrency(feeAmount)}</td>
                        </tr>
                      )}
                      <tr>
                        <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '16px', borderTop: '2px solid #1a1a1a', background: '#fafafa' }}>Te betalen</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '16px', borderTop: '2px solid #1a1a1a', background: '#fafafa', textAlign: 'right' }}>
                          {formatCurrency(total)}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '20px', marginTop: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#92400e', marginBottom: '8px' }}>Betaalinformatie</h3>
                    <p style={{ fontSize: '14px', color: '#78350f', lineHeight: '1.8' }}>
                      Gelieve het bedrag van <strong>{formatCurrency(total)}</strong> over te maken naar:<br />
                      <strong>t.n.v. {inv.bank_name || 'S. Milone'}</strong><br />
                      IBAN: <strong>{inv.bank_iban || 'NL84BUNQ2159356875'}</strong><br />
                      o.v.v. Factuurnummer <strong>#{inv.invoice_number}</strong>
                    </p>
                  </div>
                </>
              );
            })()}

            {inv.notes && (
              <div style={{ marginTop: '20px', fontSize: '13px', color: '#666', lineHeight: '1.6', paddingTop: '16px', borderTop: '1px solid #eee' }}>
                <strong>Opmerkingen:</strong> {inv.notes}
              </div>
            )}

            <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '11px', color: '#aaa', paddingTop: '16px', borderTop: '1px solid #eee' }}>
              {cb.name}{cb.email ? ` · ${cb.email}` : ''}{cb.phone ? ` · ${cb.phone}` : ''}{cb.kvk ? ` · KVK ${cb.kvk}` : ''}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return null;
}
