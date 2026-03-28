import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
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
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BRANDS = ['BMW', 'Ducati', 'Honda', 'Kawasaki', 'KTM', 'Triumph', 'Yamaha', 'Suzuki', 'Harley-Davidson', 'Aprilia', 'Moto Guzzi', 'Brixton', 'Overig'];

const emptyForm = {
  customer_name: '', customer_address: '', customer_city: '', customer_phone: '', customer_email: '',
  motorcycle_brand: '', motorcycle_model: '', motorcycle_year: '', motorcycle_license_plate: '', motorcycle_vin: '',
  taxatie_value: '', fee: 160, include_extra_fee: false, extra_fee: 60, notes: '', date: new Date().toISOString().split('T')[0],
};

export default function TaxatieInvoices() {
  const { token } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'create' | 'detail'
  const [form, setForm] = useState({ ...emptyForm });
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

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.customer_name) { toast.error('Vul een klantnaam in'); return; }
    setSaving(true);
    try {
      const res = await axios.post(`${API}/taxatie/invoices`, {
        ...form,
        fee: parseFloat(form.fee) || 160,
        extra_fee: parseFloat(form.extra_fee) || 60,
        include_extra_fee: form.include_extra_fee,
        taxatie_value: parseFloat(form.taxatie_value) || 0,
      }, { headers });
      toast.success(`Factuur #${res.data.invoice_number} aangemaakt`);
      setForm({ ...emptyForm });
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
    const newStatus = inv.status === 'open' ? 'betaald' : 'open';
    try {
      await axios.put(`${API}/taxatie/invoices/${inv.id}`, { status: newStatus }, { headers });
      toast.success(`Status gewijzigd naar ${newStatus}`);
      if (selectedInvoice) setSelectedInvoice({ ...selectedInvoice, status: newStatus });
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
          <Button onClick={() => { setForm({ ...emptyForm }); setView('create'); }} className="bg-red-600 hover:bg-red-700 text-white" data-testid="create-invoice-btn">
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
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${inv.status === 'betaald' ? 'bg-green-100' : 'bg-amber-100'}`}>
                    {inv.status === 'betaald' ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Clock className="w-5 h-5 text-amber-600" />}
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900 text-sm">#{inv.invoice_number} — {inv.customer_name}</p>
                    <p className="text-xs text-zinc-500">{inv.motorcycle_brand} {inv.motorcycle_model} · {inv.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-zinc-900">{formatCurrency(
                    ((parseFloat(inv.fee) || 0) * 1.21) + (inv.include_extra_fee ? (parseFloat(inv.extra_fee) || 0) : 0)
                  )}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${inv.status === 'betaald' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {inv.status === 'betaald' ? 'Betaald' : 'Open'}
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
        <button onClick={() => setView('list')} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 text-sm mb-6 transition-colors" data-testid="back-to-list">
          <ChevronLeft className="w-4 h-4" /> Terug naar overzicht
        </button>
        <h1 className="font-barlow text-2xl font-bold uppercase tracking-tight text-zinc-900 mb-6">Nieuwe Taxatie Factuur</h1>

        <form onSubmit={handleCreate} className="space-y-6 max-w-3xl" data-testid="taxatie-form">
          {/* Klantgegevens */}
          <Card><CardContent className="pt-6">
            <h3 className="flex items-center gap-2 font-bold text-zinc-700 text-sm uppercase tracking-wider mb-4"><User className="w-4 h-4" /> Klantgegevens</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Naam *</label>
                <input data-testid="tax-customer-name" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="Jan de Vries" />
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

          {/* Motorgegevens */}
          <Card><CardContent className="pt-6">
            <h3 className="flex items-center gap-2 font-bold text-zinc-700 text-sm uppercase tracking-wider mb-4"><Bike className="w-4 h-4" /> Motorgegevens</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Merk</label>
                <select value={form.motorcycle_brand} onChange={(e) => setForm({ ...form, motorcycle_brand: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" data-testid="tax-brand">
                  <option value="">Selecteer merk</option>
                  {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Model</label>
                <input value={form.motorcycle_model} onChange={(e) => setForm({ ...form, motorcycle_model: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="R 1250 GS" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Bouwjaar</label>
                <input type="number" value={form.motorcycle_year} onChange={(e) => setForm({ ...form, motorcycle_year: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="2023" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Kenteken</label>
                <input value={form.motorcycle_license_plate} onChange={(e) => setForm({ ...form, motorcycle_license_plate: e.target.value.toUpperCase() })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 uppercase" placeholder="XX-123-YY" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-zinc-600 mb-1">VIN / Chassisnummer</label>
                <input value={form.motorcycle_vin} onChange={(e) => setForm({ ...form, motorcycle_vin: e.target.value.toUpperCase() })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 uppercase" placeholder="WB10XX1234567890" />
              </div>
            </div>
          </CardContent></Card>

          {/* Taxatie */}
          <Card><CardContent className="pt-6">
            <h3 className="flex items-center gap-2 font-bold text-zinc-700 text-sm uppercase tracking-wider mb-4"><Euro className="w-4 h-4" /> Taxatie Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Taxatiewaarde motor</label>
                <input type="number" data-testid="tax-value" value={form.taxatie_value} onChange={(e) => setForm({ ...form, taxatie_value: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="8500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Taxatie kosten (ex BTW)</label>
                <input type="number" data-testid="tax-fee" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" placeholder="160" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Datum</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" />
              </div>
              <div className="flex items-end">
                <div className="bg-zinc-100 rounded-lg px-4 py-2 text-sm text-zinc-600 w-full">
                  BTW 21%: <strong className="text-zinc-900">{formatCurrency((parseFloat(form.fee) || 0) * 0.21)}</strong>
                  <span className="mx-2">|</span>
                  Totaal: <strong className="text-zinc-900">{formatCurrency((parseFloat(form.fee) || 0) * 1.21)}</strong>
                </div>
              </div>
            </div>

            {/* Extra fee checkbox */}
            <div className="mt-4 border border-zinc-200 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer" data-testid="extra-fee-toggle">
                <input 
                  type="checkbox" 
                  checked={form.include_extra_fee} 
                  onChange={(e) => setForm({ ...form, include_extra_fee: e.target.checked })}
                  className="w-5 h-5 rounded border-zinc-300 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="text-sm font-semibold text-zinc-800">Fee kosten toevoegen</span>
                  <span className="text-sm text-zinc-500 ml-2">({formatCurrency(form.extra_fee)})</span>
                </div>
              </label>
              {form.include_extra_fee && (
                <div className="mt-3 ml-8">
                  <label className="block text-sm font-medium text-zinc-600 mb-1">Fee bedrag</label>
                  <input type="number" value={form.extra_fee} onChange={(e) => setForm({ ...form, extra_fee: e.target.value })}
                    className="w-40 border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" />
                </div>
              )}
            </div>

            {/* Totaaloverzicht */}
            <div className="mt-4 bg-zinc-900 rounded-xl p-4 text-white">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-zinc-400">Taxatie kosten (ex BTW)</span>
                <span>{formatCurrency(parseFloat(form.fee) || 0)}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-zinc-400">BTW 21%</span>
                <span>{formatCurrency((parseFloat(form.fee) || 0) * 0.21)}</span>
              </div>
              {form.include_extra_fee && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-400">Fee kosten</span>
                  <span>{formatCurrency(parseFloat(form.extra_fee) || 0)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t border-zinc-700">
                <span>Totaal te betalen</span>
                <span>{formatCurrency(
                  ((parseFloat(form.fee) || 0) * 1.21) + (form.include_extra_fee ? (parseFloat(form.extra_fee) || 0) : 0)
                )}</span>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-zinc-600 mb-1">Opmerkingen</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 resize-none" placeholder="Eventuele opmerkingen..." />
            </div>
          </CardContent></Card>

          {/* Bank info preview */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm">
            <p className="font-bold text-amber-800 mb-1">Betaalinformatie op factuur:</p>
            <p className="text-amber-700">t.n.v. <strong>S. Milone</strong> — IBAN: <strong>NL03SNSB8846497880</strong></p>
          </div>

          <Button type="submit" disabled={saving} data-testid="save-invoice" className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 font-semibold rounded-xl">
            {saving ? 'Opslaan...' : 'Factuur Aanmaken'}
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
            <Button onClick={() => handleStatusToggle(inv)} variant="outline" className="text-sm" data-testid="toggle-status-btn">
              {inv.status === 'open' ? <><CheckCircle className="w-4 h-4 mr-1" /> Markeer Betaald</> : <><Clock className="w-4 h-4 mr-1" /> Markeer Open</>}
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
                <p style={{ fontSize: '13px', color: '#888' }}>Status: <strong style={{ color: inv.status === 'betaald' ? '#16a34a' : '#d97706' }}>{inv.status === 'betaald' ? 'BETAALD' : 'OPEN'}</strong></p>
              </div>
              <div style={{ textAlign: 'right', fontSize: '13px', color: '#555', lineHeight: '1.6' }}>
                <strong style={{ color: '#111' }}>Moto Import B.V.</strong><br />
                info@motoimportbv.nl<br />
                +31 6 24264861
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
                  {inv.motorcycle_brand && <><strong>{inv.motorcycle_brand} {inv.motorcycle_model}</strong><br /></>}
                  {inv.motorcycle_year && <>Bouwjaar: {inv.motorcycle_year}<br /></>}
                  {inv.motorcycle_license_plate && <>Kenteken: <strong>{inv.motorcycle_license_plate}</strong><br /></>}
                  {inv.motorcycle_vin && <>VIN: {inv.motorcycle_vin}</>}
                </p>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr>
                  <th style={{ background: '#1a1a1a', color: 'white', padding: '10px 16px', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Omschrijving</th>
                  <th style={{ background: '#1a1a1a', color: 'white', padding: '10px 16px', textAlign: 'right', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', width: '150px' }}>Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {parseFloat(inv.taxatie_value) > 0 && (
                  <tr>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontSize: '14px' }}>Taxatiewaarde motorfiets</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontSize: '14px', textAlign: 'right' }}>{formatCurrency(inv.taxatie_value)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontSize: '14px' }}>Taxatie kosten (ex BTW)</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontSize: '14px', textAlign: 'right' }}>{formatCurrency(inv.fee)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontSize: '14px' }}>BTW {inv.btw_percentage || 21}%</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontSize: '14px', textAlign: 'right' }}>{formatCurrency((parseFloat(inv.fee) || 0) * ((inv.btw_percentage || 21) / 100))}</td>
                </tr>
                {inv.include_extra_fee && (
                  <tr>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontSize: '14px' }}>Fee kosten</td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #eee', fontSize: '14px', textAlign: 'right' }}>{formatCurrency(inv.extra_fee || 60)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '16px', borderTop: '2px solid #1a1a1a', background: '#fafafa' }}>Te betalen</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '16px', borderTop: '2px solid #1a1a1a', background: '#fafafa', textAlign: 'right' }}>
                    {formatCurrency(
                      ((parseFloat(inv.fee) || 0) * (1 + (inv.btw_percentage || 21) / 100)) + (inv.include_extra_fee ? (parseFloat(inv.extra_fee) || 0) : 0)
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', padding: '20px', marginTop: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#92400e', marginBottom: '8px' }}>Betaalinformatie</h3>
              <p style={{ fontSize: '14px', color: '#78350f', lineHeight: '1.8' }}>
                Gelieve het bedrag van <strong>{formatCurrency(
                  ((parseFloat(inv.fee) || 0) * (1 + (inv.btw_percentage || 21) / 100)) + (inv.include_extra_fee ? (parseFloat(inv.extra_fee) || 0) : 0)
                )}</strong> over te maken naar:<br />
                <strong>t.n.v. {inv.bank_name}</strong><br />
                IBAN: <strong>{inv.bank_iban}</strong><br />
                o.v.v. Factuurnummer <strong>#{inv.invoice_number}</strong>
              </p>
            </div>

            {inv.notes && (
              <div style={{ marginTop: '20px', fontSize: '13px', color: '#666', lineHeight: '1.6', paddingTop: '16px', borderTop: '1px solid #eee' }}>
                <strong>Opmerkingen:</strong> {inv.notes}
              </div>
            )}

            <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '11px', color: '#aaa', paddingTop: '16px', borderTop: '1px solid #eee' }}>
              Moto Import B.V. · info@motoimportbv.nl · +31 6 24264861
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return null;
}
