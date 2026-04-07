import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import {
  ClipboardCheck, Plus, Search, Printer, Trash2, Eye, Edit2, ExternalLink,
  ChevronDown, ChevronUp, Star, Camera, Save, FileCheck, X, Loader2, Bike, Phone, MapPin, User, Mail
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const formatPrice = (p) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(p || 0);

const CONDITION_LABELS = { 1: 'Slecht', 2: 'Matig', 3: 'Redelijk', 4: 'Goed', 5: 'Uitstekend' };
const CONDITION_COLORS = { 1: 'bg-red-500', 2: 'bg-orange-500', 3: 'bg-yellow-500', 4: 'bg-green-500', 5: 'bg-emerald-600' };

const INSPECTION_ITEMS = [
  { key: 'engine', label: 'Motorblok', desc: 'Geluid, olielekkage, vermogen, koeling' },
  { key: 'frame', label: 'Frame & Chassis', desc: 'Roest, scheuren, lassen, stuurkoplagering' },
  { key: 'paint', label: 'Lak & Optisch', desc: 'Lakschade, krassen, deuken, roest' },
  { key: 'tires', label: 'Banden', desc: 'Profieldiepte, slijtage, leeftijd, merk' },
  { key: 'brakes', label: 'Remmen', desc: 'Remschijven, remblokken, remvloeistof, werking' },
  { key: 'electrics', label: 'Elektra', desc: 'Verlichting, accu, dashboard, schakelaars' },
  { key: 'exhaust', label: 'Uitlaat', desc: 'Roest, lekkage, geluidsniveau, bevestiging' },
  { key: 'suspension', label: 'Vering & Demping', desc: 'Voorvork, achterdemper, lekkage, werking' },
  { key: 'chain_drive', label: 'Ketting/Aandrijving', desc: 'Spanning, slijtage, tandwielen, smering' },
  { key: 'general', label: 'Algemene Staat', desc: 'Totaalindruk, netheid, completheid' },
];

const EMPTY_FORM = {
  kenteken: '', brand: '', model: '', year: new Date().getFullYear(), mileage: 0, color: '',
  vin_number: '', first_registration: '', fuel_type: 'Benzine', cylinder_capacity: '', power_kw: '',
  customer_name: '', customer_phone: '', customer_email: '', customer_address: '',
  score_engine: 3, score_frame: 3, score_paint: 3, score_tires: 3, score_brakes: 3,
  score_electrics: 3, score_exhaust: 3, score_suspension: 3, score_chain_drive: 3, score_general: 3,
  notes_engine: '', notes_frame: '', notes_paint: '', notes_tires: '', notes_brakes: '',
  notes_electrics: '', notes_general: '',
  accessories: '', modifications: '', damage_description: '', has_damage: false,
  service_history: '', last_service_date: '', apk_valid_until: '',
  autotelex_value: 0, market_value: 0, replacement_value: 0, taxatie_value: 0,
  photos: [], notes: '',
};

function ScoreSelector({ value, onChange, testId }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
            s <= value ? `${CONDITION_COLORS[s]} text-white` : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'
          }`}
          title={CONDITION_LABELS[s]}
          data-testid={`${testId}-${s}`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function TaxatieReport({ taxatie, onClose }) {
  const handlePrint = () => window.print();
  const avgScore = taxatie.average_score || 0;

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto print:relative" data-testid="taxatie-report">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" onClick={onClose}><X className="w-4 h-4 mr-2" />Sluiten</Button>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline"><Printer className="w-4 h-4 mr-2" />Printen</Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8 print:p-4 print:max-w-none">
        {/* Header */}
        <div className="bg-zinc-900 text-white p-8 rounded-t-xl print:rounded-none" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">TAXATIERAPPORT</h1>
              <p className="text-zinc-400 mt-1">Motorfiets Waardebepaling</p>
              <p className="text-zinc-500 text-sm mt-1">Moto Import B.V.</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg">{taxatie.taxatie_nummer}</p>
              <p className="text-sm text-zinc-400 mt-1">
                {new Date(taxatie.created_at).toLocaleDateString('nl-NL', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Geldig tot: {taxatie.valid_until ? new Date(taxatie.valid_until).toLocaleDateString('nl-NL') : '-'}
              </p>
              <span className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full ${
                taxatie.status === 'definitief' ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'
              }`}>
                {taxatie.status === 'definitief' ? 'DEFINITIEF' : 'CONCEPT'}
              </span>
            </div>
          </div>
        </div>

        <div className="border border-t-0 border-zinc-200 rounded-b-xl print:rounded-none p-8 space-y-8">
          {/* Voertuiggegevens + Klant */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Voertuiggegevens</h3>
              <div className="space-y-1.5 text-sm">
                <p><span className="text-zinc-500 w-32 inline-block">Merk / Model:</span> <strong>{taxatie.brand} {taxatie.model}</strong></p>
                <p><span className="text-zinc-500 w-32 inline-block">Bouwjaar:</span> {taxatie.year}</p>
                <p><span className="text-zinc-500 w-32 inline-block">Kenteken:</span> {taxatie.kenteken || '-'}</p>
                <p><span className="text-zinc-500 w-32 inline-block">Km-stand:</span> {(taxatie.mileage || 0).toLocaleString('nl-NL')} km</p>
                <p><span className="text-zinc-500 w-32 inline-block">Kleur:</span> {taxatie.color || '-'}</p>
                <p><span className="text-zinc-500 w-32 inline-block">Chassisnr:</span> {taxatie.vin_number || '-'}</p>
                <p><span className="text-zinc-500 w-32 inline-block">Brandstof:</span> {taxatie.fuel_type || '-'}</p>
                <p><span className="text-zinc-500 w-32 inline-block">Cilinderinhoud:</span> {taxatie.cylinder_capacity || '-'}</p>
                <p><span className="text-zinc-500 w-32 inline-block">Vermogen:</span> {taxatie.power_kw || '-'}</p>
                <p><span className="text-zinc-500 w-32 inline-block">APK tot:</span> {taxatie.apk_valid_until || '-'}</p>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Klantgegevens</h3>
              <div className="space-y-1.5 text-sm">
                <p><span className="text-zinc-500 w-28 inline-block">Naam:</span> <strong>{taxatie.customer_name || '-'}</strong></p>
                <p><span className="text-zinc-500 w-28 inline-block">Telefoon:</span> {taxatie.customer_phone || '-'}</p>
                <p><span className="text-zinc-500 w-28 inline-block">Email:</span> {taxatie.customer_email || '-'}</p>
                <p><span className="text-zinc-500 w-28 inline-block">Adres:</span> {taxatie.customer_address || '-'}</p>
              </div>
            </div>
          </div>

          {/* Technische Inspectie */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Technische Inspectie</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="text-left py-2 text-xs font-bold uppercase text-zinc-500">Onderdeel</th>
                  <th className="text-center py-2 text-xs font-bold uppercase text-zinc-500 w-24">Score</th>
                  <th className="text-center py-2 text-xs font-bold uppercase text-zinc-500 w-28">Beoordeling</th>
                  <th className="text-left py-2 text-xs font-bold uppercase text-zinc-500">Opmerkingen</th>
                </tr>
              </thead>
              <tbody>
                {INSPECTION_ITEMS.map(item => {
                  const score = taxatie[`score_${item.key}`] || 3;
                  const notes = taxatie[`notes_${item.key}`] || '';
                  return (
                    <tr key={item.key} className="border-b border-zinc-100">
                      <td className="py-2 font-medium">{item.label}</td>
                      <td className="py-2 text-center">
                        <span className={`inline-block w-7 h-7 rounded text-white text-xs font-bold leading-7 ${CONDITION_COLORS[score]}`}>{score}</span>
                      </td>
                      <td className="py-2 text-center text-xs">{CONDITION_LABELS[score]}</td>
                      <td className="py-2 text-zinc-600 text-xs">{notes || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-300">
                  <td className="py-3 font-bold">Gemiddelde Score</td>
                  <td className="py-3 text-center">
                    <span className="text-lg font-black">{avgScore.toFixed(1)}</span>
                  </td>
                  <td className="py-3 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold text-white ${
                      avgScore >= 4.5 ? 'bg-emerald-600' : avgScore >= 3.5 ? 'bg-green-500' :
                      avgScore >= 2.5 ? 'bg-yellow-500' : avgScore >= 1.5 ? 'bg-orange-500' : 'bg-red-500'
                    }`}>{taxatie.condition_label}</span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Schade & Accessoires */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Schade</h3>
              <p className="text-sm">{taxatie.has_damage ? taxatie.damage_description || 'Ja, zie opmerkingen' : 'Geen schade geconstateerd'}</p>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Onderhoudshistorie</h3>
              <p className="text-sm">{taxatie.service_history || '-'}</p>
              {taxatie.last_service_date && <p className="text-xs text-zinc-500 mt-1">Laatste beurt: {taxatie.last_service_date}</p>}
            </div>
          </div>

          {taxatie.accessories && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Accessoires</h3>
              <p className="text-sm">{taxatie.accessories}</p>
            </div>
          )}
          {taxatie.modifications && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Aanpassingen / Custom</h3>
              <p className="text-sm">{taxatie.modifications}</p>
            </div>
          )}

          {/* Foto's */}
          {taxatie.photos?.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Foto's</h3>
              <div className="grid grid-cols-3 gap-3">
                {taxatie.photos.map((p, i) => (
                  <img key={i} src={p} alt={`Foto ${i+1}`} className="w-full h-40 object-cover rounded-lg border" />
                ))}
              </div>
            </div>
          )}

          {/* Waardebepaling */}
          <div className="bg-zinc-50 rounded-xl p-6 border border-zinc-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">Waardebepaling</h3>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <p><span className="text-zinc-500">AutoTelex waarde:</span> <strong>{formatPrice(taxatie.autotelex_value)}</strong></p>
              <p><span className="text-zinc-500">Marktwaarde:</span> <strong>{formatPrice(taxatie.market_value)}</strong></p>
              <p><span className="text-zinc-500">Vervangingswaarde:</span> <strong>{formatPrice(taxatie.replacement_value)}</strong></p>
            </div>
            <div className="border-t border-zinc-300 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">Taxatiewaarde</span>
                <span className="text-3xl font-black text-red-600" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {formatPrice(taxatie.taxatie_value)}
                </span>
              </div>
            </div>
          </div>

          {/* Opmerkingen */}
          {taxatie.notes && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Opmerkingen</h3>
              <p className="text-sm bg-zinc-50 p-4 rounded-lg">{taxatie.notes}</p>
            </div>
          )}

          {/* Handtekening */}
          <div className="grid grid-cols-2 gap-8 mt-8 pt-6 border-t">
            <div>
              <p className="text-xs font-bold uppercase text-zinc-500 mb-12">Handtekening Taxateur</p>
              <div className="border-b border-zinc-300 mb-2" />
              <p className="text-xs text-zinc-400">Datum: _______________</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-zinc-500 mb-12">Handtekening Eigenaar</p>
              <div className="border-b border-zinc-300 mb-2" />
              <p className="text-xs text-zinc-400">Datum: _______________</p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-zinc-400 pt-6 border-t">
            <p>Moto Import B.V. | KVK: 94622086 | +31 6 24264861 | motoimportbv@gmail.com</p>
            <p className="mt-1">Dit taxatierapport is 3 jaar geldig vanaf de datum van afgifte.</p>
          </div>
        </div>
      </div>

      <style>{`@media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .print\\:hidden { display: none !important; } }`}</style>
    </div>
  );
}

export default function TaxatieProgramma() {
  const { token, user } = useAuth();
  const [taxaties, setTaxaties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list, form, report
  const [editingId, setEditingId] = useState(null);
  const [selectedTaxatie, setSelectedTaxatie] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [searchTerm, setSearchTerm] = useState('');

  if (user?.email?.toLowerCase() !== 'motoimportbv@gmail.com') {
    return <Layout><div className="flex items-center justify-center h-64 text-zinc-500">Geen toegang tot deze pagina.</div></Layout>;
  }

  const headers = { Authorization: `Bearer ${token}` };

  const fetchTaxaties = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/taxatie-programma`, { headers });
      setTaxaties(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchTaxaties(); }, [fetchTaxaties]);

  const updateField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingPhotos(true);
    const newPhotos = [...form.photos];
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await axios.post(`${API}/upload`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
        newPhotos.push(res.data.url);
      } catch { toast.error(`Upload mislukt: ${file.name}`); }
    }
    setForm(f => ({ ...f, photos: newPhotos }));
    setUploadingPhotos(false);
  };

  const handleSave = async () => {
    if (!form.brand || !form.model) { toast.error('Vul merk en model in'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await axios.put(`${API}/taxatie-programma/${editingId}`, form, { headers });
        toast.success('Taxatie bijgewerkt');
      } else {
        await axios.post(`${API}/taxatie-programma`, form, { headers });
        toast.success('Taxatie aangemaakt');
      }
      setView('list');
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      fetchTaxaties();
    } catch (e) { toast.error(e.response?.data?.detail || 'Fout bij opslaan'); }
    setSaving(false);
  };

  const handleEdit = (t) => {
    setForm({ ...EMPTY_FORM, ...t });
    setEditingId(t.id);
    setView('form');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Weet u zeker dat u deze taxatie wilt verwijderen?')) return;
    try {
      await axios.delete(`${API}/taxatie-programma/${id}`, { headers });
      toast.success('Taxatie verwijderd');
      fetchTaxaties();
    } catch { toast.error('Fout bij verwijderen'); }
  };

  const handleFinalize = async (id) => {
    try {
      await axios.post(`${API}/taxatie-programma/${id}/finalize`, {}, { headers });
      toast.success('Taxatie definitief gemaakt');
      fetchTaxaties();
    } catch { toast.error('Fout bij definitief maken'); }
  };

  const openAutoTelex = () => window.open('https://www.autotelex.nl', '_blank');

  const filtered = taxaties.filter(t => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return `${t.brand} ${t.model} ${t.kenteken} ${t.customer_name}`.toLowerCase().includes(s);
  });

  if (selectedTaxatie) {
    return <TaxatieReport taxatie={selectedTaxatie} onClose={() => setSelectedTaxatie(null)} />;
  }

  if (loading) return <Layout><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" /></div></Layout>;

  // === FORM VIEW ===
  if (view === 'form') {
    return (
      <Layout>
        <div className="space-y-6" data-testid="taxatie-form">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <ClipboardCheck className="w-7 h-7 text-red-600" />
              {editingId ? 'Taxatie Bewerken' : 'Nieuwe Taxatie'}
            </h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setView('list'); setEditingId(null); setForm({ ...EMPTY_FORM }); }}>Annuleren</Button>
              <Button onClick={openAutoTelex} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" data-testid="autotelex-btn">
                <ExternalLink className="w-4 h-4 mr-2" />AutoTelex.nl
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white" data-testid="save-taxatie-btn">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Opslaan
              </Button>
            </div>
          </div>

          {/* Voertuiggegevens */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Bike className="w-5 h-5 text-red-600" />Voertuiggegevens</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { k: 'kenteken', l: 'Kenteken', p: 'XX-999-X' },
                { k: 'brand', l: 'Merk *', p: 'BMW' },
                { k: 'model', l: 'Model *', p: 'R1250GS' },
                { k: 'year', l: 'Bouwjaar', p: '2023', t: 'number' },
                { k: 'mileage', l: 'Km-stand', p: '25000', t: 'number' },
                { k: 'color', l: 'Kleur', p: 'Zwart' },
                { k: 'vin_number', l: 'Chassisnummer', p: 'WB10...' },
                { k: 'first_registration', l: 'Eerste toelating', p: '01-01-2023' },
                { k: 'fuel_type', l: 'Brandstof', p: 'Benzine' },
                { k: 'cylinder_capacity', l: 'Cilinderinhoud', p: '1254 cc' },
                { k: 'power_kw', l: 'Vermogen', p: '100 kW / 136 pk' },
                { k: 'apk_valid_until', l: 'APK geldig tot', p: '01-01-2026' },
              ].map(f => (
                <div key={f.k}>
                  <label className="text-xs font-bold text-zinc-600 block mb-1">{f.l}</label>
                  <input type={f.t || 'text'} value={form[f.k]} onChange={e => updateField(f.k, f.t === 'number' ? Number(e.target.value) : e.target.value)} placeholder={f.p} className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none" data-testid={`field-${f.k}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Klantgegevens */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><User className="w-5 h-5 text-red-600" />Klantgegevens</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { k: 'customer_name', l: 'Naam', p: 'Jan Jansen', icon: User },
                { k: 'customer_phone', l: 'Telefoon', p: '+31612345678', icon: Phone },
                { k: 'customer_email', l: 'Email', p: 'jan@email.nl', icon: Mail },
                { k: 'customer_address', l: 'Adres', p: 'Straatnaam 1, 1234AB Stad', icon: MapPin },
              ].map(f => (
                <div key={f.k}>
                  <label className="text-xs font-bold text-zinc-600 block mb-1">{f.l}</label>
                  <input type="text" value={form[f.k]} onChange={e => updateField(f.k, e.target.value)} placeholder={f.p} className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none" data-testid={`field-${f.k}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Technische Inspectie */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Star className="w-5 h-5 text-red-600" />Technische Inspectie</h2>
            <p className="text-xs text-zinc-500 mb-4">Beoordeel elk onderdeel van 1 (slecht) tot 5 (uitstekend)</p>
            <div className="space-y-4">
              {INSPECTION_ITEMS.map(item => (
                <div key={item.key} className="flex items-start gap-4 p-3 rounded-lg bg-zinc-50">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{item.label}</p>
                    <p className="text-xs text-zinc-500">{item.desc}</p>
                  </div>
                  <ScoreSelector value={form[`score_${item.key}`]} onChange={v => updateField(`score_${item.key}`, v)} testId={`score-${item.key}`} />
                  {['engine', 'frame', 'paint', 'tires', 'brakes', 'electrics', 'general'].includes(item.key) && (
                    <input type="text" value={form[`notes_${item.key}`] || ''} onChange={e => updateField(`notes_${item.key}`, e.target.value)} placeholder="Opmerking..." className="w-48 border border-zinc-300 rounded-lg px-2 py-1.5 text-xs focus:border-red-500 focus:outline-none" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Schade & Onderhoud */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4">Schade & Onderhoud</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={form.has_damage} onChange={e => updateField('has_damage', e.target.checked)} className="w-4 h-4 accent-red-600" data-testid="has-damage-checkbox" />
                <label className="text-sm font-bold">Schade geconstateerd</label>
              </div>
              {form.has_damage && (
                <textarea value={form.damage_description} onChange={e => updateField('damage_description', e.target.value)} placeholder="Beschrijf de schade..." rows={2} className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none" data-testid="damage-description" />
              )}
              <div>
                <label className="text-xs font-bold text-zinc-600 block mb-1">Onderhoudshistorie</label>
                <textarea value={form.service_history} onChange={e => updateField('service_history', e.target.value)} placeholder="Onderhoud bij dealer, zelf onderhouden, etc." rows={2} className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none" data-testid="service-history" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-600 block mb-1">Laatste beurt</label>
                  <input type="text" value={form.last_service_date} onChange={e => updateField('last_service_date', e.target.value)} placeholder="01-01-2025" className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Accessoires */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4">Accessoires & Aanpassingen</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-600 block mb-1">Accessoires</label>
                <textarea value={form.accessories} onChange={e => updateField('accessories', e.target.value)} placeholder="Koffers, navigatie, windscherm, etc." rows={2} className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none" data-testid="accessories" />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-600 block mb-1">Aanpassingen / Custom</label>
                <textarea value={form.modifications} onChange={e => updateField('modifications', e.target.value)} placeholder="Uitlaat, tuning, custom lak, etc." rows={2} className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none" data-testid="modifications" />
              </div>
            </div>
          </div>

          {/* Foto's */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Camera className="w-5 h-5 text-red-600" />Foto's</h2>
            <div className="flex flex-wrap gap-3 mb-3">
              {form.photos.map((p, i) => (
                <div key={i} className="relative w-28 h-28 rounded-lg overflow-hidden border group">
                  <img src={p} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setForm(f => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))} className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                </div>
              ))}
              <label className="w-28 h-28 rounded-lg border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center cursor-pointer hover:border-red-400 transition-colors" data-testid="photo-upload">
                {uploadingPhotos ? <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" /> : <><Camera className="w-6 h-6 text-zinc-400" /><span className="text-xs text-zinc-400 mt-1">Toevoegen</span></>}
                <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhotos} />
              </label>
            </div>
          </div>

          {/* Waardebepaling */}
          <div className="bg-white rounded-2xl border-2 border-red-200 p-6">
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2 text-red-700">Waardebepaling</h2>
            <p className="text-xs text-zinc-500 mb-4">Bekijk de afschrijving op <button onClick={openAutoTelex} className="text-blue-600 font-bold hover:underline">AutoTelex.nl</button> en vul de waardes in</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { k: 'autotelex_value', l: 'AutoTelex waarde' },
                { k: 'market_value', l: 'Marktwaarde vergelijkbaar' },
                { k: 'replacement_value', l: 'Vervangingswaarde' },
              ].map(f => (
                <div key={f.k}>
                  <label className="text-xs font-bold text-zinc-600 block mb-1">{f.l}</label>
                  <input type="number" value={form[f.k]} onChange={e => updateField(f.k, Number(e.target.value))} className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none" data-testid={`field-${f.k}`} />
                </div>
              ))}
              <div>
                <label className="text-xs font-bold text-red-700 block mb-1">Taxatiewaarde (definitief)</label>
                <input type="number" value={form.taxatie_value} onChange={e => updateField('taxatie_value', Number(e.target.value))} className="w-full border-2 border-red-300 rounded-lg px-3 py-2 text-sm font-bold text-red-700 focus:border-red-500 focus:outline-none bg-red-50" data-testid="field-taxatie_value" />
              </div>
            </div>
          </div>

          {/* Opmerkingen */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4">Opmerkingen</h2>
            <textarea value={form.notes} onChange={e => updateField('notes', e.target.value)} placeholder="Overige opmerkingen..." rows={3} className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none" data-testid="notes" />
          </div>

          <div className="flex justify-end gap-3 pb-8">
            <Button variant="outline" onClick={() => { setView('list'); setEditingId(null); setForm({ ...EMPTY_FORM }); }}>Annuleren</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white" data-testid="save-taxatie-btn-bottom">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Opslaan
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // === LIST VIEW ===
  return (
    <Layout>
      <div className="space-y-6" data-testid="taxatie-programma">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <ClipboardCheck className="w-7 h-7 text-red-600" />
              Taxatie Programma
            </h1>
            <p className="text-zinc-500 mt-1">Motorfiets waardebepaling & taxatierapporten</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={openAutoTelex} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" data-testid="autotelex-list-btn">
              <ExternalLink className="w-4 h-4 mr-2" />AutoTelex.nl
            </Button>
            <Button onClick={() => { setForm({ ...EMPTY_FORM }); setEditingId(null); setView('form'); }} className="bg-red-600 hover:bg-red-700 text-white" data-testid="new-taxatie-btn">
              <Plus className="w-4 h-4 mr-2" />Nieuwe Taxatie
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Zoek op merk, model, kenteken of klant..." className="w-full pl-10 pr-4 py-3 border border-zinc-300 rounded-xl text-sm focus:border-red-500 focus:outline-none" data-testid="search-taxatie" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-xs text-zinc-500 font-bold uppercase">Totaal</p>
            <p className="text-2xl font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{taxaties.length}</p>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-xs text-zinc-500 font-bold uppercase">Concept</p>
            <p className="text-2xl font-black text-amber-600" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{taxaties.filter(t => t.status === 'concept').length}</p>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <p className="text-xs text-zinc-500 font-bold uppercase">Definitief</p>
            <p className="text-2xl font-black text-green-600" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{taxaties.filter(t => t.status === 'definitief').length}</p>
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border p-10 text-center text-zinc-400">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Geen taxaties gevonden</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border hover:border-zinc-300 transition-colors overflow-hidden" data-testid={`taxatie-${t.id}`}>
                <div className="p-5 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-zinc-100 flex items-center justify-center flex-shrink-0">
                    {t.photos?.[0] ? <img src={t.photos[0]} alt="" className="w-full h-full object-cover rounded-xl" /> : <Bike className="w-8 h-8 text-zinc-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">{t.brand} {t.model} ({t.year})</h3>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${t.status === 'definitief' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {t.status === 'definitief' ? 'Definitief' : 'Concept'}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500">{t.kenteken && `${t.kenteken} · `}{t.customer_name || 'Geen klant'} · {(t.mileage || 0).toLocaleString('nl-NL')} km</p>
                    <p className="text-sm text-zinc-400">{t.taxatie_nummer} · Score: <strong>{t.average_score?.toFixed(1)}</strong> ({t.condition_label})</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-black text-red-600" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{formatPrice(t.taxatie_value)}</p>
                    <p className="text-xs text-zinc-400">{new Date(t.created_at).toLocaleDateString('nl-NL')}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setSelectedTaxatie(t)} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500" title="Rapport bekijken" data-testid={`view-${t.id}`}><Eye className="w-4 h-4" /></button>
                    <button onClick={() => handleEdit(t)} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500" title="Bewerken" data-testid={`edit-${t.id}`}><Edit2 className="w-4 h-4" /></button>
                    {t.status === 'concept' && <button onClick={() => handleFinalize(t.id)} className="p-2 rounded-lg hover:bg-green-100 text-green-600" title="Definitief maken" data-testid={`finalize-${t.id}`}><FileCheck className="w-4 h-4" /></button>}
                    <button onClick={() => handleDelete(t.id)} className="p-2 rounded-lg hover:bg-red-100 text-red-500" title="Verwijderen" data-testid={`delete-${t.id}`}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
