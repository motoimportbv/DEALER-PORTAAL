import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import {
  X, Save, FileText, Loader2, Download, Building2, Car, Calendar,
  Wrench, Euro, Paperclip, AlertCircle, RotateCcw, Sparkles,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DEFAULT_BRANDING = {
  company_name: 'motoimport bv',
  address: 'Horsterhoekweg 11',
  postal_code: '7433 SV',
  city: 'Schalkhaar',
  phone: '+31 6 24264861',
  email: 'motoimportbv@gmail.com',
  kvk: '94622086',
  btw: 'NL867456982B01',
  taxateur_name: 'S. Milone',
  taxateur_title: 'Erkend BPM-taxateur',
};

const empty = {
  rapportnummer: '',
  rapport_datum: new Date().toISOString().slice(0, 10),
  voertuig: {
    merk: '', model: '', uitvoering: '', bouwjaar: '', vin: '',
    buitenlands_kenteken: '', det: '', kilometerstand: '', brandstof: 'Benzine',
    co2: '', cilinderinhoud: '', vermogen: '', kleur: '',
  },
  opname: { datum: '', begintijd: '', eindtijd: '', locatie: '' },
  schade: { algemene_staat: '', omschrijving: '' },
  waarde: {
    methode: 'Taxatie op basis van fysieke opname + koerslijst',
    koerslijst: '', historische_nieuwprijs: '', inkoopwaarde_nl: '',
    herstelkosten: '', waardevermindering_pct: 31, onderbouwing_hoger_pct: '',
  },
  branding: {},
  bijlage_inkoop: '',
  extra_bijlagen: '',
};

function num(v) { const x = parseFloat(v); return isFinite(x) ? x : 0; }

export default function BpmReportEditor({ aanvraag, token, onClose, onSaved }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [section, setSection] = useState('voertuig');
  const [useCustomBranding, setUseCustomBranding] = useState(false);

  // Prefill from existing aanvraag.bpm_report or auto-fill from aanvraag
  useEffect(() => {
    const existing = aanvraag.bpm_report;
    if (existing) {
      setForm({
        ...empty,
        ...existing,
        voertuig: { ...empty.voertuig, ...(existing.voertuig || {}) },
        opname: { ...empty.opname, ...(existing.opname || {}) },
        schade: { ...empty.schade, ...(existing.schade || {}) },
        waarde: { ...empty.waarde, ...(existing.waarde || {}) },
        branding: existing.branding || {},
      });
      if (existing.branding && Object.keys(existing.branding).length > 0) {
        setUseCustomBranding(true);
      }
    } else {
      // Auto-fill from aanvraag basic data
      setForm({
        ...empty,
        rapportnummer: aanvraag.ref_nr ? `BPM-${aanvraag.ref_nr.replace('TX-', '')}` : '',
        opname: { ...empty.opname, datum: new Date().toISOString().slice(0, 10) },
      });
    }
  }, [aanvraag]);

  const update = (section, key, value) => {
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  };

  // Live afschrijvings-berekening
  const nieuwprijs = num(form.waarde.historische_nieuwprijs);
  const inkoopwaarde = num(form.waarde.inkoopwaarde_nl);
  const afschrijving = Math.max(nieuwprijs - inkoopwaarde, 0);
  const afschrPct = nieuwprijs > 0 ? (afschrijving / nieuwprijs * 100) : 0;
  const herstelkosten = num(form.waarde.herstelkosten);
  const wmPct = num(form.waarde.waardevermindering_pct) || 31;
  const waardeverm = herstelkosten * (wmPct / 100);

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${API}/admin/taxatie-aanvragen/${aanvraag.id}/bpm-report`,
        form,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('BPM-rapport opgeslagen');
      onSaved && onSaved();
    } catch (e) {
      toast.error('Opslaan mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setSaving(false);
  };

  const generatePdf = async () => {
    setDownloading(true);
    try {
      // Save first then download
      await axios.put(
        `${API}/admin/taxatie-aanvragen/${aanvraag.id}/bpm-report`,
        form,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const res = await axios.get(
        `${API}/admin/taxatie-aanvragen/${aanvraag.id}/bpm-report/pdf`,
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      );
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      onSaved && onSaved();
    } catch (e) {
      toast.error('PDF mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setDownloading(false);
  };

  const runOcr = async () => {
    if (!window.confirm("AI scant de foto's met Gemini Vision en vult de Voertuig-velden automatisch. Bestaande waarden worden overschreven. Doorgaan?")) return;
    setOcrLoading(true);
    try {
      const r = await axios.post(
        `${API}/admin/taxatie-aanvragen/${aanvraag.id}/bpm-report/ocr`,
        {},
        { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 }
      );
      const v = r.data?.voertuig || {};
      const inkoop = r.data?.inkoop || {};
      const processed = r.data?.files_processed || [];
      const successCount = processed.filter(p => p.success).length;
      if (Object.keys(v).length === 0 && Object.keys(inkoop).length === 0) {
        toast.error(`OCR vond geen data (${processed.length} foto's gescand)`);
      } else {
        setForm(prev => ({
          ...prev,
          voertuig: { ...prev.voertuig, ...v },
          bijlage_inkoop: inkoop.factuurnummer
            ? `Inkoopfactuur ${inkoop.factuurnummer} d.d. ${inkoop.inkoopdatum || '?'} — ${inkoop.verkoper || ''}${inkoop.inkoopbedrag ? ` (€${inkoop.inkoopbedrag})` : ''}`.trim()
            : prev.bijlage_inkoop,
        }));
        toast.success(`AI vulde ${Object.keys(v).length} velden in (${successCount}/${processed.length} foto's gelezen)`);
      }
    } catch (e) {
      toast.error('OCR mislukt: ' + (e.response?.data?.detail || e.message));
    }
    setOcrLoading(false);
  };

  const tabs = [
    { id: 'voertuig', label: 'Voertuig', icon: Car },
    { id: 'opname', label: 'Opname', icon: Calendar },
    { id: 'schade', label: 'Schade', icon: Wrench },
    { id: 'waarde', label: 'Waarde', icon: Euro },
    { id: 'bijlagen', label: 'Bijlagen', icon: Paperclip },
    { id: 'branding', label: 'Branding', icon: Building2 },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 flex items-start justify-center overflow-y-auto p-4"
      onClick={onClose}
      data-testid="bpm-report-editor"
    >
      <div className="bg-white rounded-2xl w-full max-w-5xl my-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-600" />
              BPM-tegenbewijs taxatierapport
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              {aanvraag.bedrijfsnaam} · {aanvraag.ref_nr || aanvraag.id.slice(0, 8)} ·
              Belastingdienst Bijlage 1 — Uitvoeringsregeling BPM 1992
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-lg" data-testid="close-bpm-editor">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top meta row */}
        <div className="px-5 py-3 bg-zinc-50 border-b grid sm:grid-cols-2 gap-3">
          <LabeledInput label="Rapportnummer" value={form.rapportnummer}
            onChange={v => setForm({ ...form, rapportnummer: v })} placeholder="BPM-2026-0042" />
          <LabeledInput label="Rapportdatum" type="date" value={form.rapport_datum}
            onChange={v => setForm({ ...form, rapport_datum: v })} />
        </div>

        {/* Tabs */}
        <div className="border-b px-5 flex gap-1 overflow-x-auto">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setSection(t.id)}
                className={`px-3 py-2.5 text-sm font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  section === t.id
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-zinc-500 hover:text-zinc-900'
                }`}
                data-testid={`tab-${t.id}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {section === 'voertuig' && (
            <div className="space-y-3">
              {(aanvraag.files || []).length > 0 && (
                <button
                  type="button"
                  onClick={runOcr}
                  disabled={ocrLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-semibold text-sm shadow-md disabled:opacity-60 transition-all"
                  data-testid="ocr-photos-btn"
                >
                  {ocrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {ocrLoading ? 'Foto\'s aan het lezen met Gemini Vision...' : `Auto-vul uit foto's (${(aanvraag.files || []).length} foto's)`}
                </button>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
              <LabeledInput label="Merk *" value={form.voertuig.merk} onChange={v => update('voertuig', 'merk', v)} placeholder="BMW" />
              <LabeledInput label="Model / Type *" value={form.voertuig.model} onChange={v => update('voertuig', 'model', v)} placeholder="R1250GS Adventure" />
              <LabeledInput label="Uitvoering" value={form.voertuig.uitvoering} onChange={v => update('voertuig', 'uitvoering', v)} placeholder="Triple Black" />
              <LabeledInput label="Bouwjaar *" value={form.voertuig.bouwjaar} onChange={v => update('voertuig', 'bouwjaar', v)} placeholder="2023" />
              <LabeledInput label="VIN / Chassisnummer *" value={form.voertuig.vin} onChange={v => update('voertuig', 'vin', v)} placeholder="WB10K0303PZB12345" />
              <LabeledInput label="Buitenlands kenteken" value={form.voertuig.buitenlands_kenteken} onChange={v => update('voertuig', 'buitenlands_kenteken', v)} placeholder="M-BMW 1234" />
              <LabeledInput label="DET (Datum eerste toelating buitenland) *" type="date" value={form.voertuig.det} onChange={v => update('voertuig', 'det', v)} />
              <LabeledInput label="Kilometerstand *" value={form.voertuig.kilometerstand} onChange={v => update('voertuig', 'kilometerstand', v)} placeholder="14250 km" />
              <LabeledSelect label="Brandstof" value={form.voertuig.brandstof} onChange={v => update('voertuig', 'brandstof', v)}
                options={['Benzine', 'Diesel', 'Elektrisch', 'Hybride', 'LPG', 'CNG']} />
              <LabeledInput label="CO₂-uitstoot (g/km)" value={form.voertuig.co2} onChange={v => update('voertuig', 'co2', v)} placeholder="108" />
              <LabeledInput label="Cilinderinhoud (cc)" value={form.voertuig.cilinderinhoud} onChange={v => update('voertuig', 'cilinderinhoud', v)} placeholder="1254" />
              <LabeledInput label="Vermogen (kW)" value={form.voertuig.vermogen} onChange={v => update('voertuig', 'vermogen', v)} placeholder="100" />
              <LabeledInput label="Kleur" value={form.voertuig.kleur} onChange={v => update('voertuig', 'kleur', v)} placeholder="Triple Black" />
              </div>
            </div>
          )}

          {section === 'opname' && (
            <div className="space-y-3">
              <InfoBanner text="De fysieke opname mag maximaal 1 maand vóór de RDW-keuringsdatum hebben plaatsgevonden." />
              <div className="grid sm:grid-cols-2 gap-3">
                <LabeledInput label="Datum opname *" type="date" value={form.opname.datum} onChange={v => update('opname', 'datum', v)} />
                <LabeledInput label="Locatie opname" value={form.opname.locatie} onChange={v => update('opname', 'locatie', v)} placeholder="Schalkhaar" />
                <LabeledInput label="Begintijd *" type="time" value={form.opname.begintijd} onChange={v => update('opname', 'begintijd', v)} />
                <LabeledInput label="Eindtijd *" type="time" value={form.opname.eindtijd} onChange={v => update('opname', 'eindtijd', v)} />
              </div>
            </div>
          )}

          {section === 'schade' && (
            <div className="space-y-3">
              <InfoBanner text="Een BPM-taxatierapport mag alleen worden gebruikt voor voertuigen met méér dan normale gebruiksschade óf voertuigen die niet in de koerslijst voorkomen." />
              <LabeledInput label="Algemene staat van het voertuig" value={form.schade.algemene_staat}
                onChange={v => update('schade', 'algemene_staat', v)}
                placeholder="Goed, conform leeftijd en kilometerstand met enkele aandachtspunten." />
              <LabeledTextarea label="Specificatie schade / gebreken *" rows={6}
                value={form.schade.omschrijving}
                onChange={v => update('schade', 'omschrijving', v)}
                placeholder="Lakschade rechter koffer (krassen + deuk ca. 8x4 cm).&#10;Voorruit met krassen door steenslag.&#10;Carbon-bescherming motorblok beschadigd.&#10;Tankpad gedeeltelijk losgekomen." />
            </div>
          )}

          {section === 'waarde' && (
            <div className="space-y-3">
              <LabeledInput label="Waardemethode" value={form.waarde.methode} onChange={v => update('waarde', 'methode', v)} />
              <LabeledInput label="Gebruikte koerslijst" value={form.waarde.koerslijst} onChange={v => update('waarde', 'koerslijst', v)} placeholder="AutoTelex / EuroTax / X-ray" />
              <div className="grid sm:grid-cols-2 gap-3">
                <LabeledInput label="Historische nieuwprijs NL (€) *" type="number" value={form.waarde.historische_nieuwprijs} onChange={v => update('waarde', 'historische_nieuwprijs', v)} placeholder="23500" />
                <LabeledInput label="Handelsinkoopwaarde NL (€) *" type="number" value={form.waarde.inkoopwaarde_nl} onChange={v => update('waarde', 'inkoopwaarde_nl', v)} placeholder="12800" />
              </div>
              {/* Live calc */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm grid sm:grid-cols-3 gap-2">
                <div><span className="text-zinc-600 text-xs">Afschrijving:</span> <strong>€ {afschrijving.toFixed(2)}</strong></div>
                <div><span className="text-zinc-600 text-xs">Afschr. %:</span> <strong className="text-amber-700">{afschrPct.toFixed(2)}%</strong></div>
                <div><span className="text-zinc-600 text-xs">Methode:</span> <strong>Taxatie</strong></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <LabeledInput label="Begroting herstelkosten (€)" type="number" value={form.waarde.herstelkosten} onChange={v => update('waarde', 'herstelkosten', v)} placeholder="0" />
                <LabeledInput label="Waardeverminderings-% (standaard 31%)" type="number" value={form.waarde.waardevermindering_pct} onChange={v => update('waarde', 'waardevermindering_pct', v)} placeholder="31" />
              </div>
              {wmPct > 31 && (
                <LabeledTextarea label="Onderbouwing hoger percentage (verplicht bij >31%)" rows={3}
                  value={form.waarde.onderbouwing_hoger_pct} onChange={v => update('waarde', 'onderbouwing_hoger_pct', v)}
                  placeholder="Specifieke voertuig-onderbouwing — meer dan algemene opmerkingen over segment/leeftijd/km" />
              )}
              {herstelkosten > 0 && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-sm">
                  <span className="text-zinc-600 text-xs">Waardevermindering door schade:</span>{' '}
                  <strong>€ {waardeverm.toFixed(2)}</strong> ({wmPct.toFixed(0)}% van € {herstelkosten.toFixed(2)})
                </div>
              )}
            </div>
          )}

          {section === 'bijlagen' && (
            <div className="space-y-3">
              <InfoBanner text="De Belastingdienst eist een kopie van de inkoopfactuur (bedrijf) of inkoopverklaring (particulier). De foto's uit deze aanvraag worden automatisch als bijlage A meegestuurd." />
              <LabeledInput label="Inkoopfactuur / inkoopverklaring (omschrijving)"
                value={form.bijlage_inkoop} onChange={v => setForm({ ...form, bijlage_inkoop: v })}
                placeholder="Inkoopfactuur d.d. 10-02-2026, factuurnummer DE-2026-0012" />
              <LabeledTextarea label="Extra bijlagen (optioneel)" rows={3}
                value={form.extra_bijlagen} onChange={v => setForm({ ...form, extra_bijlagen: v })}
                placeholder="Schade-expertise rapport, RDW-keuringskaart, etc." />
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
                <strong>{(aanvraag.files || []).length} foto&apos;s</strong> uit de aanvraag worden automatisch in Bijlage A van het PDF opgenomen.
              </div>
            </div>
          )}

          {section === 'branding' && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={useCustomBranding}
                    onChange={e => {
                      setUseCustomBranding(e.target.checked);
                      if (!e.target.checked) setForm({ ...form, branding: {} });
                    }}
                    className="w-4 h-4"
                    data-testid="custom-branding-toggle"
                  />
                  <span className="text-sm font-semibold">
                    Gebruik eigen branding op het rapport (whitelabel)
                  </span>
                </label>
                <p className="text-xs text-zinc-600 mt-1 ml-6">
                  Default = <strong>motoimport bv</strong>. Vink aan om bedrijf-X (bijv. Ten Kate Motoren) als taxateur op het rapport te zetten.
                </p>
              </div>

              {useCustomBranding && (
                <div className="grid sm:grid-cols-2 gap-3 p-4 bg-zinc-50 rounded-lg border">
                  <LabeledInput label="Bedrijfsnaam *" value={form.branding.company_name || ''}
                    onChange={v => setForm({ ...form, branding: { ...form.branding, company_name: v } })}
                    placeholder="Ten Kate Motoren BV" />
                  <LabeledInput label="Taxateur (naam) *" value={form.branding.taxateur_name || ''}
                    onChange={v => setForm({ ...form, branding: { ...form.branding, taxateur_name: v } })}
                    placeholder="J. ten Kate" />
                  <LabeledInput label="Functie / kwalificatie" value={form.branding.taxateur_title || ''}
                    onChange={v => setForm({ ...form, branding: { ...form.branding, taxateur_title: v } })}
                    placeholder="Erkend taxateur RMT/SCVM" />
                  <LabeledInput label="Telefoon" value={form.branding.phone || ''}
                    onChange={v => setForm({ ...form, branding: { ...form.branding, phone: v } })}
                    placeholder="+31 578 555 1234" />
                  <LabeledInput label="Adres" value={form.branding.address || ''}
                    onChange={v => setForm({ ...form, branding: { ...form.branding, address: v } })}
                    placeholder="Industrieweg 5" />
                  <LabeledInput label="Postcode" value={form.branding.postal_code || ''}
                    onChange={v => setForm({ ...form, branding: { ...form.branding, postal_code: v } })}
                    placeholder="8161 BL" />
                  <LabeledInput label="Plaats" value={form.branding.city || ''}
                    onChange={v => setForm({ ...form, branding: { ...form.branding, city: v } })}
                    placeholder="Epe" />
                  <LabeledInput label="E-mail" value={form.branding.email || ''}
                    onChange={v => setForm({ ...form, branding: { ...form.branding, email: v } })}
                    placeholder="info@tenkate.nl" />
                  <LabeledInput label="KvK-nummer" value={form.branding.kvk || ''}
                    onChange={v => setForm({ ...form, branding: { ...form.branding, kvk: v } })}
                    placeholder="08123456" />
                  <LabeledInput label="BTW-nummer" value={form.branding.btw || ''}
                    onChange={v => setForm({ ...form, branding: { ...form.branding, btw: v } })}
                    placeholder="NL811234567B01" />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, branding: { ...DEFAULT_BRANDING } })}
                    className="text-xs text-blue-600 hover:underline col-span-2 text-left flex items-center gap-1"
                    data-testid="reset-branding-btn"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset naar motoimport bv gegevens
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex items-center justify-between bg-zinc-50 rounded-b-2xl">
          <p className="text-xs text-zinc-500">
            ⚠️ Alle 10 Belastingdienst-velden worden gevuld bij het opslaan
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving || downloading} data-testid="cancel-bpm-btn">
              Sluiten
            </Button>
            <Button variant="outline" onClick={save} disabled={saving || downloading} data-testid="save-bpm-btn">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Opslaan
            </Button>
            <Button
              onClick={generatePdf} disabled={saving || downloading}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="generate-pdf-btn"
            >
              {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Genereer PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wide mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
      />
    </div>
  );
}

function LabeledTextarea({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wide mb-1">{label}</label>
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
      />
    </div>
  );
}

function LabeledSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wide mb-1">{label}</label>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function InfoBanner({ text }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}
