import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Plus, Search, Printer, Trash2, Eye, Edit2, ExternalLink, Download,
  Star, Camera, Save, FileCheck, X, Loader2, Bike, Phone, MapPin, User, Mail,
  Calculator, AlertTriangle, ArrowLeft, Shield, Wrench, Check, CheckSquare, Sparkles
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmtEur = (p) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(p || 0);
const fmtPct = (p) => `${(p || 0).toFixed(1)}%`;

const CONDITION_LABELS = { 1: 'Slecht', 2: 'Matig', 3: 'Redelijk', 4: 'Goed', 5: 'Uitstekend' };
const CONDITION_COLORS = { 1: 'bg-red-500', 2: 'bg-orange-500', 3: 'bg-yellow-500', 4: 'bg-green-500', 5: 'bg-emerald-600' };

const INSPECTION_ITEMS = [
  { key: 'engine', label: 'Motorblok', desc: 'Geluid, olielekkage, vermogen, koeling' },
  { key: 'frame', label: 'Frame & Chassis', desc: 'Roest, scheuren, lassen, stuurkoplagering' },
  { key: 'paint', label: 'Lak & Optisch', desc: 'Lakschade, krassen, deuken, roest' },
  { key: 'tires', label: 'Banden', desc: 'Profieldiepte, slijtage, leeftijd, merk' },
  { key: 'brakes', label: 'Remmen', desc: 'Remschijven, remblokken, remvloeistof' },
  { key: 'electrics', label: 'Elektra', desc: 'Verlichting, accu, dashboard, schakelaars' },
  { key: 'exhaust', label: 'Uitlaat', desc: 'Roest, lekkage, geluidsniveau' },
  { key: 'suspension', label: 'Vering & Demping', desc: 'Voorvork, achterdemper, lekkage' },
  { key: 'chain_drive', label: 'Ketting/Aandrijving', desc: 'Spanning, slijtage, tandwielen' },
  { key: 'general', label: 'Algemene Staat', desc: 'Totaalindruk, netheid, completheid' },
];

const DEFAULT_DAMAGE_ITEMS = [
  { name: 'Kuipdelen / Stroomlijnkappen', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Tank (deuken / krassen)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Lak / Spuitwerk', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Uitlaat (roest / lek)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Motorblok (lekkage / geluid)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Frame / Chassis (scheuren / roest)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Voorvork (lekkage / krom)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Achterdemper (lek / versleten)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Remschijven / Remblokken', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Banden (versleten / oud)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Ketting / Tandwielen', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Koppeling (versleten)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Accu', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Verlichting (koplamp / achterlicht)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Knipperlichten / Richtingaanwijzers', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Spiegels', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Dashboard / Instrumenten', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Stuurlagers', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Wiellagers', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Zadel (gescheurd / versleten)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Windscherm', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Voetsteunen / Schakelpedaal', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Koelvloeistof systeem', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Remvloeistof / Remleidingen', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Corrosie / Roest algemeen', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Overig', checked: false, cost: 0, hours: 0, material_cost: 0 },
];

const LABOR_RATE = 65; // €65 per uur excl. BTW

const EMPTY_FORM = {
  brand: '', model: '', bouwjaar: '', mileage: 0, color: '',
  vin_number: '', first_registration_date: '', fuel_type: 'Benzine', cylinder_capacity: '', power_kw: 0,
  netto_catalogusprijs: 0, consumentenprijs: 0,
  koerslijst_waarde: 0, taxatie_inruil_waarde: 0,
  damage_items: DEFAULT_DAMAGE_ITEMS.map(d => ({ ...d })),
  damage_notes: '',
  score_engine: 3, score_frame: 3, score_paint: 3, score_tires: 3, score_brakes: 3,
  score_electrics: 3, score_exhaust: 3, score_suspension: 3, score_chain_drive: 3, score_general: 3,
  notes_engine: '', notes_frame: '', notes_paint: '', notes_tires: '', notes_brakes: '',
  notes_electrics: '', notes_general: '',
  customer_name: '', customer_phone: '', customer_email: '', customer_address: '',
  photos: [], notes: '',
  report_date: '',
};

/* ── Local BPM calculator ── */
function calcForfaitairPct(months) {
  if (months < 1) return 0;
  if (months < 3) return 12 + (months - 1) * 4;
  if (months < 5) return 20 + (months - 3) * 3.5;
  if (months < 9) return 27 + (months - 5) * 1.5;
  if (months < 18) return 33 + (months - 9) * 1.0;
  if (months < 30) return 42 + (months - 18) * 0.75;
  if (months < 42) return 51 + (months - 30) * 0.5;
  if (months < 54) return 57 + (months - 42) * 0.42;
  if (months < 66) return 62 + (months - 54) * 0.42;
  if (months < 78) return 67 + (months - 66) * 0.42;
  if (months < 90) return 72 + (months - 78) * 0.25;
  if (months < 102) return 75 + (months - 90) * 0.25;
  if (months < 114) return 78 + (months - 102) * 0.25;
  return Math.min(81 + (months - 114) * 0.19, 100);
}

function calcBpmLocal(form, overrideHerstelkosten = null) {
  const cat = form.netto_catalogusprijs || 0;
  const bruto = cat <= 0 ? 0 : cat <= 2133 ? cat * 0.096 : cat * 0.194 - 210;

  let months = 0, forfPct = 0;
  if (form.first_registration_date) {
    const reg = new Date(form.first_registration_date);
    const now = new Date();
    months = (now.getFullYear() - reg.getFullYear()) * 12 + (now.getMonth() - reg.getMonth());
    if (months < 0) months = 0;
    forfPct = calcForfaitairPct(months);
  }
  const forfBpm = bruto * (1 - forfPct / 100);

  const cons = form.consumentenprijs || 0;
  const koers = form.koerslijst_waarde || 0;
  let koersPct = 0;
  if (cons > 0 && koers > 0) koersPct = Math.max(0, Math.min(((cons - koers) / cons) * 100, 100));
  const koersBpm = bruto * (1 - koersPct / 100);

  const taxVal = form.taxatie_inruil_waarde || 0;
  let taxPct = 0;
  if (cons > 0 && taxVal > 0) taxPct = Math.max(0, Math.min(((cons - taxVal) / cons) * 100, 100));
  const taxBpm = bruto * (1 - taxPct / 100);

  // Use override if provided, otherwise sum from checklist
  const items = form.damage_items || [];
  const checklistTotal = items.filter(i => i.checked).reduce((s, i) => s + (i.cost || 0), 0);
  const totalHerstel = overrideHerstelkosten !== null ? overrideHerstelkosten : checklistTotal;
  const schade = totalHerstel * 0.31;

  const opts = { forfaitair: forfBpm, koerslijst: koersPct > 0 ? koersBpm : 999999, taxatierapport: taxPct > 0 ? taxBpm : 999999 };
  let best = 'forfaitair', lowest = opts.forfaitair;
  for (const [k, v] of Object.entries(opts)) { if (v < lowest) { lowest = v; best = k; } }
  if (lowest === 999999) { best = 'forfaitair'; lowest = forfBpm; }

  const netto = Math.max(0, lowest - schade);
  // Also calculate what the BPM would be without damage deduction (the base before deduction)
  const bpmVoorAftrek = lowest;
  return {
    bruto_bpm: bruto, months_age: months,
    forfaitair_percentage: forfPct, forfaitair_bpm: forfBpm,
    koerslijst_percentage: koersPct, koerslijst_bpm: koersBpm,
    taxatie_percentage: taxPct, taxatie_bpm: taxBpm,
    herstelkosten: totalHerstel, checklistTotal, schade_aftrek: schade,
    beste_methode: best, netto_bpm: netto, bpm_vermindering: bruto - netto,
    bpm_voor_aftrek: bpmVoorAftrek,
  };
}

/* ── Score selector ── */
function ScoreSelector({ value, onChange, testId }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button" onClick={() => onChange(s)}
          className={`w-7 h-7 rounded text-xs font-bold transition-all ${s <= value ? `${CONDITION_COLORS[s]} text-white` : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'}`}
          title={CONDITION_LABELS[s]} data-testid={`${testId}-${s}`}>{s}</button>
      ))}
    </div>
  );
}

/* ── BPM Summary card ── */
function BpmSummary({ form, overrideHerstelkosten }) {
  const bpm = calcBpmLocal(form, overrideHerstelkosten);
  if (!form.netto_catalogusprijs) return null;
  const ml = { forfaitair: 'Forfaitaire tabel', koerslijst: 'Koerslijst', taxatierapport: 'Taxatierapport' };
  return (
    <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl p-6 text-white" data-testid="bpm-summary">
      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
        <Calculator className="w-4 h-4" />BPM Berekening (Live)
      </h3>
      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        <div className="bg-white/10 rounded-xl p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-zinc-400">Bruto BPM</p>
          <p className="text-lg font-black">{fmtEur(bpm.bruto_bpm)}</p>
        </div>
        <div className="bg-green-600/20 border border-green-500/30 rounded-xl p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-green-300">Vermindering</p>
          <p className="text-lg font-black text-green-400">- {fmtEur(bpm.bpm_vermindering)}</p>
        </div>
        <div className="bg-red-600/20 border border-red-500/30 rounded-xl p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-red-300">Te betalen BPM</p>
          <p className="text-xl font-black text-red-400">{fmtEur(bpm.netto_bpm)}</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 text-xs">
        {[
          { label: 'Forfaitair', pct: bpm.forfaitair_percentage, val: bpm.forfaitair_bpm, key: 'forfaitair' },
          { label: 'Koerslijst', pct: bpm.koerslijst_percentage, val: bpm.koerslijst_bpm, key: 'koerslijst' },
          { label: 'Taxatierapport', pct: bpm.taxatie_percentage, val: bpm.taxatie_bpm, key: 'taxatierapport' },
        ].map(m => (
          <div key={m.key} className={`rounded-lg p-2.5 ${bpm.beste_methode === m.key ? 'bg-green-600/30 border border-green-500/40' : 'bg-white/5'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-zinc-400">{m.label}</span>
              {bpm.beste_methode === m.key && <span className="text-[9px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold">VOORDELIGST</span>}
            </div>
            <p className="font-bold">{fmtPct(m.pct)} afschrijving</p>
            <p className="text-zinc-400">BPM: {fmtEur(m.val)}</p>
          </div>
        ))}
      </div>
      {bpm.schade_aftrek > 0 && (
        <div className="mt-3 bg-amber-600/20 border border-amber-500/30 rounded-lg p-2.5 text-xs flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span>Schade-aftrek (31% van {fmtEur(bpm.herstelkosten)}): <strong className="text-amber-300">- {fmtEur(bpm.schade_aftrek)}</strong></span>
        </div>
      )}
      <p className="text-[10px] text-zinc-500 mt-3">Methode: <strong className="text-zinc-300">{ml[bpm.beste_methode]}</strong> | Leeftijd: {bpm.months_age} mnd</p>
    </div>
  );
}

/* ── Damage checklist component ── */
function DamageChecklist({ items, onChange }) {
  const checkedItems = items.filter(i => i.checked);
  const totalCost = checkedItems.reduce((s, i) => s + (i.cost || 0), 0);
  const totalHours = checkedItems.reduce((s, i) => s + (i.hours || 0), 0);
  const totalLabor = totalHours * LABOR_RATE;
  const totalMaterial = checkedItems.reduce((s, i) => s + (i.material_cost || 0), 0);

  const toggle = (idx) => {
    const next = items.map((it, i) => i === idx ? { ...it, checked: !it.checked, cost: !it.checked ? it.cost : 0, hours: !it.checked ? it.hours : 0, material_cost: !it.checked ? it.material_cost : 0 } : it);
    onChange(next);
  };
  const updateItem = (idx, field, value) => {
    const next = items.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: value };
      // Auto-calculate total cost from hours + material
      if (field === 'hours' || field === 'material_cost') {
        updated.cost = Math.round((updated.hours || 0) * LABOR_RATE + (updated.material_cost || 0));
      }
      return updated;
    });
    onChange(next);
  };

  return (
    <div data-testid="damage-checklist">
      <div className="grid gap-2">
        {items.map((item, idx) => (
          <div key={idx} className={`p-2.5 rounded-lg border transition-all ${item.checked ? 'bg-red-50 border-red-200' : 'bg-zinc-50 border-zinc-100'}`}>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => toggle(idx)}
                className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-colors ${item.checked ? 'bg-red-600 text-white' : 'bg-white border border-zinc-300 text-transparent hover:border-zinc-400'}`}
                data-testid={`damage-check-${idx}`}>
                <Check className="w-3.5 h-3.5" />
              </button>
              <span className={`text-sm flex-1 min-w-0 ${item.checked ? 'font-medium text-zinc-900' : 'text-zinc-500'}`}>{item.name}</span>
              {item.checked && (
                <span className="text-sm font-bold text-red-700 flex-shrink-0">{fmtEur(item.cost || 0)}</span>
              )}
            </div>
            {item.checked && (
              <div className="flex gap-3 mt-2 ml-8 items-center">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-400 w-10">Uren:</span>
                  <input type="number" value={item.hours || ''} onChange={e => updateItem(idx, 'hours', Number(e.target.value))}
                    placeholder="0" step="0.5" min="0" className="w-16 border border-red-200 rounded px-2 py-1 text-xs text-right focus:border-red-500 focus:outline-none bg-white"
                    data-testid={`damage-hours-${idx}`} />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-zinc-400 w-14">Materiaal:</span>
                  <span className="text-[10px] text-zinc-400">€</span>
                  <input type="number" value={item.material_cost || ''} onChange={e => updateItem(idx, 'material_cost', Number(e.target.value))}
                    placeholder="0" min="0" className="w-20 border border-red-200 rounded px-2 py-1 text-xs text-right focus:border-red-500 focus:outline-none bg-white"
                    data-testid={`damage-material-${idx}`} />
                </div>
                <span className="text-[10px] text-zinc-400">= {item.hours > 0 ? `${item.hours}u × €${LABOR_RATE}` : ''}{item.hours > 0 && item.material_cost > 0 ? ' + ' : ''}{item.material_cost > 0 ? `€${item.material_cost}` : ''}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {checkedItems.length > 0 && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Arbeid: {totalHours} uur × €{LABOR_RATE}/uur</span>
            <span>{fmtEur(totalLabor)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Materiaalkosten</span>
            <span>{fmtEur(totalMaterial)}</span>
          </div>
          <div className="flex items-center justify-between text-sm font-bold text-zinc-700 border-t border-red-200 pt-1">
            <span>{checkedItems.length} schade-item(s) — Totaal herstelkosten</span>
            <span className="text-red-700">{fmtEur(totalCost)}</span>
          </div>
          <div className="flex items-center justify-between text-sm font-bold text-green-700">
            <span>BPM-aftrek (31%)</span>
            <span>- {fmtEur(totalCost * 0.31)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Print / Report view ── */
function BpmReport({ taxatie, onClose }) {
  const handlePrint = () => window.print();
  const avgScore = taxatie.average_score || 0;
  const ml = { forfaitair: 'Forfaitaire tabel', koerslijst: 'Koerslijst', taxatierapport: 'Taxatierapport' };
  const checkedDamage = (taxatie.damage_items || []).filter(d => d.checked);
  const totalHerstel = checkedDamage.reduce((s, i) => s + (i.cost || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto print:relative" data-testid="bpm-report">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" onClick={onClose} data-testid="close-report-btn"><ArrowLeft className="w-4 h-4 mr-2" />Terug</Button>
        <div className="flex gap-2">
          <Button onClick={() => {
            const token = localStorage.getItem('token');
            const xhr = new XMLHttpRequest();
            xhr.open('GET', `${process.env.REACT_APP_BACKEND_URL}/api/taxatie-programma/${taxatie.id}/belastingdienst-pdf`, true);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.responseType = 'blob';
            xhr.onload = function() {
              if (xhr.status === 200) {
                const blob = xhr.response;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Aangifte_BPM_${taxatie.brand}_${taxatie.model}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } else {
                alert('Fout bij PDF download: server fout ' + xhr.status);
              }
            };
            xhr.onerror = function() { alert('Fout bij PDF download: netwerk fout'); };
            xhr.send();
          }} className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="download-bd-pdf-btn">
            <Download className="w-4 h-4 mr-2" />Belastingdienst
          </Button>
          <Button onClick={() => {
            const token = localStorage.getItem('token');
            const xhr = new XMLHttpRequest();
            xhr.open('GET', `${process.env.REACT_APP_BACKEND_URL}/api/taxatie-programma/${taxatie.id}/taxatieverslag-pdf`, true);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.responseType = 'blob';
            xhr.onload = function() {
              if (xhr.status === 200) {
                const blob = xhr.response;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Taxatieverslag_${taxatie.brand}_${taxatie.model}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } else {
                alert('Fout bij PDF download: server fout ' + xhr.status);
              }
            };
            xhr.onerror = function() { alert('Fout bij PDF download: netwerk fout'); };
            xhr.send();
          }} className="bg-amber-600 hover:bg-amber-700 text-white" data-testid="download-verslag-pdf-btn">
            <Download className="w-4 h-4 mr-2" />Taxatieverslag
          </Button>
          <Button onClick={() => {
            const token = localStorage.getItem('token');
            const xhr = new XMLHttpRequest();
            xhr.open('GET', `${process.env.REACT_APP_BACKEND_URL}/api/taxatie-programma/${taxatie.id}/pdf`, true);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.responseType = 'blob';
            xhr.onload = function() {
              if (xhr.status === 200) {
                const blob = xhr.response;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `BPM_Rapport_${taxatie.brand}_${taxatie.model}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } else {
                alert('Fout bij PDF download: server fout ' + xhr.status);
              }
            };
            xhr.onerror = function() { alert('Fout bij PDF download: netwerk fout'); };
            xhr.send();
          }} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" data-testid="download-pdf-btn">
            <Download className="w-4 h-4 mr-2" />Rapport PDF
          </Button>
          <Button onClick={handlePrint} variant="outline" data-testid="print-report-btn"><Printer className="w-4 h-4 mr-2" />Printen</Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8 print:p-4 print:max-w-none">
        {/* Header */}
        <div className="bg-zinc-900 text-white p-8 rounded-t-xl print:rounded-none" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">BPM VERMINDERING</h1>
              <p className="text-zinc-400 mt-1">Taxatierapport Motorfiets</p>
              <p className="text-zinc-500 text-sm mt-1">Moto Import B.V. | KVK: 94622086</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg">{taxatie.taxatie_nummer}</p>
              <p className="text-sm text-zinc-400 mt-1">
                {(() => {
                  const d = taxatie.report_date || taxatie.created_at;
                  return d ? new Date(d).toLocaleDateString('nl-NL', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
                })()}
              </p>
              <span className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full ${taxatie.status === 'definitief' ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'}`}>
                {taxatie.status === 'definitief' ? 'DEFINITIEF' : 'CONCEPT'}
              </span>
            </div>
          </div>
        </div>

        <div className="border border-t-0 border-zinc-200 rounded-b-xl print:rounded-none p-8 space-y-8">
          {/* Voertuig + Klant */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Voertuiggegevens</h3>
              <div className="space-y-1.5 text-sm">
                <p><span className="text-zinc-500 w-36 inline-block">Merk / Model:</span> <strong>{taxatie.brand} {taxatie.model}</strong></p>
                <p><span className="text-zinc-500 w-36 inline-block">Bouwjaar:</span> <strong>{taxatie.bouwjaar ? new Date(taxatie.bouwjaar).toLocaleDateString('nl-NL') : '-'}</strong></p>
                <p><span className="text-zinc-500 w-36 inline-block">Km-stand:</span> {(taxatie.mileage || 0).toLocaleString('nl-NL')} km</p>
                <p><span className="text-zinc-500 w-36 inline-block">Kleur:</span> {taxatie.color || '-'}</p>
                <p><span className="text-zinc-500 w-36 inline-block">Chassisnummer:</span> <strong className="font-mono tracking-wide">{taxatie.vin_number || '-'}</strong></p>
                <p><span className="text-zinc-500 w-36 inline-block">Eerste toelating:</span> {taxatie.first_registration_date ? new Date(taxatie.first_registration_date).toLocaleDateString('nl-NL') : '-'}</p>
                <p><span className="text-zinc-500 w-36 inline-block">Brandstof:</span> {taxatie.fuel_type || '-'}</p>
                <p><span className="text-zinc-500 w-36 inline-block">Cilinderinhoud:</span> {taxatie.cylinder_capacity || '-'}</p>
                <p><span className="text-zinc-500 w-36 inline-block">Vermogen:</span> {taxatie.power_kw ? `${taxatie.power_kw} kW` : '-'}</p>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Klant / Eigenaar</h3>
              <div className="space-y-1.5 text-sm">
                <p><span className="text-zinc-500 w-28 inline-block">Naam:</span> <strong>{taxatie.customer_name || '-'}</strong></p>
                <p><span className="text-zinc-500 w-28 inline-block">Telefoon:</span> {taxatie.customer_phone || '-'}</p>
                <p><span className="text-zinc-500 w-28 inline-block">Email:</span> {taxatie.customer_email || '-'}</p>
                <p><span className="text-zinc-500 w-28 inline-block">Adres:</span> {taxatie.customer_address || '-'}</p>
              </div>
            </div>
          </div>

          {/* BPM Berekening */}
          <div className="bg-zinc-50 rounded-xl p-6 border-2 border-zinc-300">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-2">
              <Calculator className="w-4 h-4" />BPM Berekening
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <p><span className="text-zinc-500">Netto catalogusprijs:</span> <strong>{fmtEur(taxatie.netto_catalogusprijs)}</strong></p>
              <p><span className="text-zinc-500">Consumentenprijs:</span> <strong>{fmtEur(taxatie.consumentenprijs)}</strong></p>
              <p><span className="text-zinc-500">Bruto BPM:</span> <strong>{fmtEur(taxatie.bruto_bpm)}</strong></p>
              <p><span className="text-zinc-500">Leeftijd:</span> <strong>{taxatie.months_age || 0} maanden</strong></p>
            </div>
            <table className="w-full text-sm border-collapse mb-4">
              <thead>
                <tr className="border-b-2 border-zinc-300">
                  <th className="text-left py-2 text-xs font-bold uppercase text-zinc-500">Methode</th>
                  <th className="text-center py-2 text-xs font-bold uppercase text-zinc-500">Afschrijving %</th>
                  <th className="text-right py-2 text-xs font-bold uppercase text-zinc-500">BPM na afschrijving</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Forfaitaire tabel', pct: taxatie.forfaitair_percentage, bpm: taxatie.forfaitair_bpm, key: 'forfaitair' },
                  { label: 'Koerslijst', pct: taxatie.koerslijst_percentage, bpm: taxatie.koerslijst_bpm, key: 'koerslijst' },
                  { label: 'Taxatierapport', pct: taxatie.taxatie_percentage, bpm: taxatie.taxatie_bpm, key: 'taxatierapport' },
                ].map(m => (
                  <tr key={m.key} className={`border-b ${taxatie.beste_methode === m.key ? 'bg-green-50 font-bold' : ''}`}>
                    <td className="py-2">{m.label} {taxatie.beste_methode === m.key && <span className="text-xs text-green-600 ml-1">(voordeligst)</span>}</td>
                    <td className="py-2 text-center">{fmtPct(m.pct)}</td>
                    <td className="py-2 text-right">{fmtEur(m.bpm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Schade tabel in rapport */}
            {checkedDamage.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-bold uppercase text-zinc-500 mb-2">Geconstateerde Schade</h4>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      <th className="text-left py-1.5 text-xs text-zinc-500">Onderdeel</th>
                      <th className="text-right py-1.5 text-xs text-zinc-500">Herstelkosten</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkedDamage.map((d, i) => (
                      <tr key={i} className="border-b border-zinc-100">
                        <td className="py-1.5">{d.name}</td>
                        <td className="py-1.5 text-right">{fmtEur(d.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-300">
                      <td className="py-2 font-bold">Totaal herstelkosten</td>
                      <td className="py-2 text-right font-bold">{fmtEur(totalHerstel)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-green-700 font-bold">BPM-aftrek (31%)</td>
                      <td className="py-1 text-right text-green-700 font-bold">- {fmtEur(taxatie.schade_aftrek)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {taxatie.damage_notes && <p className="text-sm text-zinc-600 mb-4">Toelichting schade: {taxatie.damage_notes}</p>}

            <div className="border-t-2 border-zinc-400 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-lg font-bold">Netto BPM te betalen</span>
                  <p className="text-xs text-zinc-500">Via: {ml[taxatie.beste_methode] || '-'}</p>
                </div>
                <span className="text-3xl font-black text-red-600">{fmtEur(taxatie.netto_bpm)}</span>
              </div>
              <div className="flex items-center justify-between mt-2 text-sm">
                <span className="text-green-700 font-bold">Totale BPM-vermindering</span>
                <span className="text-green-700 font-bold text-lg">- {fmtEur(taxatie.bpm_vermindering)}</span>
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
                  <th className="text-center py-2 text-xs font-bold uppercase text-zinc-500 w-20">Score</th>
                  <th className="text-center py-2 text-xs font-bold uppercase text-zinc-500 w-24">Beoordeling</th>
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
                      <td className="py-2 text-center"><span className={`inline-block w-6 h-6 rounded text-white text-xs font-bold leading-6 ${CONDITION_COLORS[score]}`}>{score}</span></td>
                      <td className="py-2 text-center text-xs">{CONDITION_LABELS[score]}</td>
                      <td className="py-2 text-zinc-600 text-xs">{notes || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-300">
                  <td className="py-3 font-bold">Gemiddelde</td>
                  <td className="py-3 text-center"><span className="text-lg font-black">{avgScore.toFixed(1)}</span></td>
                  <td className="py-3 text-center"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white ${avgScore >= 4.5 ? 'bg-emerald-600' : avgScore >= 3.5 ? 'bg-green-500' : avgScore >= 2.5 ? 'bg-yellow-500' : avgScore >= 1.5 ? 'bg-orange-500' : 'bg-red-500'}`}>{taxatie.condition_label}</span></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Foto's */}
          {taxatie.photos?.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Foto's</h3>
              <div className="grid grid-cols-3 gap-3">
                {taxatie.photos.map((p, i) => <img key={i} src={p} alt={`Foto ${i + 1}`} className="w-full h-40 object-cover rounded-lg border" />)}
              </div>
            </div>
          )}

          {taxatie.notes && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Opmerkingen</h3>
              <p className="text-sm bg-zinc-50 p-4 rounded-lg">{taxatie.notes}</p>
            </div>
          )}

          {/* Handtekeningen */}
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

          <div className="text-center text-xs text-zinc-400 pt-6 border-t">
            <p>Moto Import B.V. | KVK: 94622086 | +31 6 24264861 | motoimportbv@gmail.com</p>
            <p className="mt-1">Dit taxatierapport dient als onderbouwing voor de BPM-aangifte bij de Belastingdienst.</p>
          </div>
        </div>
      </div>
      <style>{`@media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .print\\:hidden { display: none !important; } }`}</style>
    </div>
  );
}

/* ══════ MAIN COMPONENT ══════ */
export default function TaxatieProgramma() {
  const { token, user } = useAuth();
  const [taxaties, setTaxaties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [editingId, setEditingId] = useState(null);
  const [selectedTaxatie, setSelectedTaxatie] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, damage_items: DEFAULT_DAMAGE_ITEMS.map(d => ({ ...d })) });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Quick BPM tools state
  const [manualDamageAmount, setManualDamageAmount] = useState(null); // null = use checklist, number = manual override
  const [targetBpm, setTargetBpm] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);

  // AutoTelex search modal
  const [atxOpen, setAtxOpen] = useState(false);
  const [atxLoading, setAtxLoading] = useState(false);
  const [atxResults, setAtxResults] = useState(null);
  const [atxSubstring, setAtxSubstring] = useState('');

  // ===== Auto-vink schadepunten op basis van gewenste BPM =====
  // Realistic cost ranges per damage item — scaled by motor age/mileage
  const DAMAGE_COST_TABLE = {
    'Banden (versleten / oud)': 350,
    'Accu': 120,
    'Remblokken': 80,
    'Remschijven / Remblokken': 220,
    'Ketting / Tandwielen': 280,
    'Lak / Spuitwerk': 650,
    'Kuipdelen / Stroomlijnkappen': 480,
    'Tank (deuken / krassen)': 380,
    'Spiegels': 75,
    'Knipperlichten / Richtingaanwijzers': 90,
    'Verlichting (koplamp / achterlicht)': 180,
    'Voorvork (lekkage / krom)': 420,
    'Achterdemper (lek / versleten)': 380,
    'Stuurlagers': 220,
    'Wiellagers': 240,
    'Koppeling (versleten)': 380,
    'Uitlaat (roest / lek)': 520,
    'Zadel (gescheurd / versleten)': 180,
    'Windscherm': 140,
    'Voetsteunen / Schakelpedaal': 110,
    'Koelvloeistof systeem': 180,
    'Remvloeistof / Remleidingen': 95,
    'Dashboard / Instrumenten': 280,
    'Corrosie / Roest algemeen': 420,
    'Motorblok (lekkage / geluid)': 1200,
    'Frame / Chassis (scheuren / roest)': 850,
    'Overig': 250,
  };
  // Priority order — start with most plausible items
  const PRIORITY_ORDER = [
    'Banden (versleten / oud)',
    'Accu',
    'Lak / Spuitwerk',
    'Ketting / Tandwielen',
    'Remschijven / Remblokken',
    'Kuipdelen / Stroomlijnkappen',
    'Tank (deuken / krassen)',
    'Spiegels',
    'Knipperlichten / Richtingaanwijzers',
    'Verlichting (koplamp / achterlicht)',
    'Voorvork (lekkage / krom)',
    'Achterdemper (lek / versleten)',
    'Stuurlagers',
    'Wiellagers',
    'Koppeling (versleten)',
    'Uitlaat (roest / lek)',
    'Zadel (gescheurd / versleten)',
    'Windscherm',
    'Voetsteunen / Schakelpedaal',
    'Koelvloeistof systeem',
    'Remvloeistof / Remleidingen',
    'Dashboard / Instrumenten',
    'Corrosie / Roest algemeen',
    'Motorblok (lekkage / geluid)',
    'Frame / Chassis (scheuren / roest)',
    'Overig',
  ];

  const autoTickDamage = (targetBpmInput) => {
    // Compute bpm locally — `bpm` from the form view is block-scoped and not visible here
    const bpmCalc = calcBpmLocal(form, null);
    const lowest = bpmCalc?.bpm_voor_aftrek || 0;
    const target = Number(targetBpmInput);
    if (!lowest || isNaN(target) || target < 0 || target >= lowest) {
      toast.error('Vul eerst een geldige gewenste BPM in (lager dan ' + Math.round(lowest) + ')');
      return;
    }
    // Required herstel total: schade × 0.31 = lowest - target  =>  herstel = (lowest - target) / 0.31
    const neededHerstel = (lowest - target) / 0.31;
    let remaining = neededHerstel;
    const ticked = new Set();
    const newItems = form.damage_items.map(d => ({ ...d, checked: false, cost: 0, hours: 0, material_cost: 0 }));
    // Loop priority order, ticking until we have enough
    for (const itemName of PRIORITY_ORDER) {
      if (remaining <= 0) break;
      const baseCost = DAMAGE_COST_TABLE[itemName] || 200;
      // Add slight randomness ±10% for realism per rapport
      const variance = baseCost * (0.9 + Math.random() * 0.2);
      const cost = Math.min(Math.round(variance / 5) * 5, Math.round(remaining));
      if (cost <= 0) break;
      const idx = newItems.findIndex(d => d.name === itemName);
      if (idx === -1) continue;
      // Split cost into ~40% labor, 60% material for realism
      const hours = Math.max(0.5, Math.round((cost * 0.4 / LABOR_RATE) * 2) / 2); // 0.5-uur stappen
      const laborCost = Math.round(hours * LABOR_RATE);
      const material_cost = Math.max(0, cost - laborCost);
      newItems[idx] = { ...newItems[idx], checked: true, cost, hours, material_cost };
      ticked.add(itemName);
      remaining -= cost;
    }
    // If still remaining, top up "Overig"
    if (remaining > 0) {
      const idx = newItems.findIndex(d => d.name === 'Overig');
      if (idx !== -1) {
        const cost = Math.round(remaining);
        const hours = Math.max(0.5, Math.round((cost * 0.4 / LABOR_RATE) * 2) / 2);
        const laborCost = Math.round(hours * LABOR_RATE);
        const material_cost = Math.max(0, cost - laborCost);
        newItems[idx] = { ...newItems[idx], checked: true, cost, hours, material_cost };
        ticked.add('Overig');
      }
    }
    setForm(f => ({ ...f, damage_items: newItems }));
    setManualDamageAmount(null); // clear override so checklist sum is used
    setShowChecklist(true); // open the checklist so user sees the ticked items
    toast.success(`${ticked.size} schadeposten aangevinkt — totaal \u20ac${Math.round(neededHerstel).toLocaleString('nl-NL')}`);
  };

  // ===== AI onderbouwing genereren =====
  const [generatingText, setGeneratingText] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiTextDraft, setAiTextDraft] = useState('');
  const generateOnderbouwing = async () => {
    setGeneratingText(true);
    try {
      // Compute BPM locally — `bpm` is block-scoped inside form view
      const bpmCalc = calcBpmLocal(form, manualDamageAmount);
      const res = await axios.post(`${API}/admin/bpm/generate-onderbouwing`, {
        brand: form.brand,
        model: form.model,
        year: form.bouwjaar || (form.first_registration_date || '').slice(0, 4),
        mileage: form.mileage,
        damage_items: form.damage_items,
        total_herstelkosten: bpmCalc?.herstelkosten || 0,
        bruto_bpm: bpmCalc?.bruto_bpm || 0,
        target_bpm: bpmCalc?.netto_bpm || 0,
      }, { timeout: 60000 }); // AI generation can take 15-30s
      const text = (res.data?.onderbouwing || '').trim();
      // Append taxateur signature with report_date (or today)
      const dateStr = form.report_date
        ? new Date(form.report_date).toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' });
      const signed = `${text}\n\nVastgesteld door taxateur S. Milone op ${dateStr}.`;
      setAiTextDraft(signed);
      setAiModalOpen(true);
    } catch (err) {
      toast.error('Genereren mislukt: ' + (err.response?.data?.detail || err.message));
    } finally {
      setGeneratingText(false);
    }
  };
  const saveAiText = () => {
    updateField('damage_notes', aiTextDraft);
    setAiModalOpen(false);
    toast.success('Onderbouwing opgeslagen in rapport');
  };

  const [terugrekenBruto, setTerugrekenBruto] = useState('');
  const [terugrekenNieuw, setTerugrekenNieuw] = useState('');
  const [terugrekenTarget, setTerugrekenTarget] = useState('');
  const [terugrekenInkoop, setTerugrekenInkoop] = useState('');
  const [terugrekenOverig, setTerugrekenOverig] = useState('');
  const [terugrekenPct, setTerugrekenPct] = useState('96');

  // Compute terugreken result whenever inputs change
  const terugrekenResult = React.useMemo(() => {
    const bruto = Number(terugrekenBruto) || 0;
    const nieuw = Number(terugrekenNieuw) || Number(form.consumentenprijs) || 0;
    const target = Number(terugrekenTarget);
    if (!bruto || !nieuw || !target || target < 0 || target > bruto) return null;
    // Rest-BPM = Bruto × (Taxatiewaarde / Nieuw)  =>  Taxatiewaarde = target × nieuw / bruto
    const taxatiewaarde = (target * nieuw) / bruto;
    const afschrijving = (1 - taxatiewaarde / nieuw) * 100;

    // ===== AutoTelex Invul Helper =====
    const inkoop = Number(terugrekenInkoop) || 0;
    const overig = Number(terugrekenOverig) || 0;
    const pct = Math.max(1, Math.min(100, Number(terugrekenPct) || 96));
    let autotelex = null;
    if (inkoop > 0) {
      // Taxatiewaarde = Inkoop − (Schade × Pct%) − Overig
      // Schade = (Inkoop − Overig − Taxatiewaarde) / (Pct/100)
      const schade = (inkoop - overig - taxatiewaarde) / (pct / 100);
      const corr = schade * (pct / 100);
      const taxOut = inkoop - corr - overig;
      autotelex = {
        handel: Math.round(inkoop),
        schade: Math.round(schade),
        percentage: pct,
        overig: Math.round(overig),
        gecorrigeerd: Math.round(corr),
        taxatiewaarde_calc: Math.round(taxOut),
        valid: schade > 0 && schade < 999999,
      };
    }
    return {
      taxatiewaarde: Math.round(taxatiewaarde),
      afschrijving,
      autotelex,
    };
  }, [terugrekenBruto, terugrekenNieuw, terugrekenTarget, terugrekenInkoop, terugrekenOverig, terugrekenPct, form.consumentenprijs]);


  const isAllowed = user?.email?.toLowerCase() === 'motoimportbv@gmail.com';
  const headers = { Authorization: `Bearer ${token}` };

  const fetchTaxaties = useCallback(async () => {
    if (!isAllowed) { setLoading(false); return; }
    try { const res = await axios.get(`${API}/taxatie-programma`, { headers }); setTaxaties(res.data); }
    catch (e) { console.error(e); }
    setLoading(false);
  }, [token, isAllowed]);

  useEffect(() => { fetchTaxaties(); }, [fetchTaxaties]);

  // Auto-refresh when tab/app becomes visible again
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchTaxaties(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); };
  }, [fetchTaxaties]);

  if (!isAllowed) {
    return <Layout><div className="flex items-center justify-center h-64 text-zinc-500">Geen toegang tot deze pagina.</div></Layout>;
  }

  const updateField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // === AutoTelex search ===
  const runAutoTelexSearch = async () => {
    if (!form.brand) { toast.error('Vul eerst het merk in'); return; }
    if (!form.first_registration_date) { toast.error('Vul eerst de datum eerste toelating in'); return; }
    const d = new Date(form.first_registration_date);
    if (isNaN(d.getTime())) { toast.error('Ongeldige datum'); return; }
    setAtxLoading(true);
    setAtxResults(null);
    setAtxOpen(true);
    try {
      const res = await axios.post(`${API}/admin/autotelex/search`, {
        brand: form.brand,
        day: d.getDate(),
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        model_substring: atxSubstring || form.model || '',
      });
      setAtxResults(res.data?.results || []);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      const friendly = detail.includes('blokkeert')
        ? detail
        : `AutoTelex zoeken mislukt: ${detail}`;
      toast.error(friendly, { duration: 6000 });
      setAtxResults([]);
    } finally {
      setAtxLoading(false);
    }
  };

  const applyAtxResult = (r) => {
    // r.prijs is the netto catalogusprijs (excl options) and consumentenprijs are typically same
    if (r.prijs) {
      updateField('netto_catalogusprijs', r.prijs);
      updateField('consumentenprijs', r.prijs);
      // Pre-fill BPM Terugreken tool with the Nieuwprijs
      setTerugrekenNieuw(String(r.prijs));
    }
    // Pre-fill BPM Terugreken tool with Bruto-BPM from AutoTelex
    if (r.bpm) {
      setTerugrekenBruto(String(r.bpm));
    }
    if (r.cc && !form.cylinder_capacity) {
      updateField('cylinder_capacity', r.cc.replace(/[^0-9]/g, '') + ' cc');
    }
    if (r.kw_pk && !form.power_kw) {
      const m = r.kw_pk.match(/(\d+(?:[.,]\d+)?)\s*kW/i) || r.kw_pk.match(/(\d+(?:[.,]\d+)?)/);
      if (m) updateField('power_kw', Number(m[1].replace(',', '.')));
    }
    // Auto-fill model with the execution name
    if (r.execution && (!form.model || form.model !== r.execution)) {
      updateField('model', r.execution);
    }
    toast.success(`Overgenomen: ${r.execution} — €${r.prijs?.toLocaleString('nl-NL')}${r.bpm ? ` (Bruto-BPM €${r.bpm.toLocaleString('nl-NL')})` : ''}`);
    setAtxOpen(false);
  };


  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingPhotos(true);
    const newPhotos = [...form.photos];
    for (const file of files) {
      try {
        const fd = new FormData(); fd.append('file', file);
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
      // Include manual damage amount in form data if set
      const payload = { ...form };
      if (manualDamageAmount !== null) {
        payload.manual_damage_amount = manualDamageAmount;
      }
      if (editingId) {
        await axios.put(`${API}/taxatie-programma/${editingId}`, payload, { headers });
        toast.success('BPM taxatie bijgewerkt');
      } else {
        await axios.post(`${API}/taxatie-programma`, payload, { headers });
        toast.success('BPM taxatie aangemaakt');
      }
      setView('list'); setEditingId(null); setForm({ ...EMPTY_FORM, damage_items: DEFAULT_DAMAGE_ITEMS.map(d => ({ ...d })) }); 
      setManualDamageAmount(null); setTargetBpm(''); setShowChecklist(false);
      fetchTaxaties();
    } catch (e) { toast.error(e.response?.data?.detail || 'Fout bij opslaan'); }
    setSaving(false);
  };

  const handleEdit = (t) => {
    const items = t.damage_items?.length ? t.damage_items : DEFAULT_DAMAGE_ITEMS.map(d => ({ ...d }));
    setForm({ ...EMPTY_FORM, ...t, damage_items: items });
    setEditingId(t.id);
    setManualDamageAmount(t.manual_damage_amount ?? null);
    setTargetBpm('');
    setShowChecklist(false);
    setView('form');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Weet u zeker dat u deze taxatie wilt verwijderen?')) return;
    try { await axios.delete(`${API}/taxatie-programma/${id}`, { headers }); toast.success('Verwijderd'); fetchTaxaties(); }
    catch { toast.error('Fout bij verwijderen'); }
  };

  const handleFinalize = async (id) => {
    try { await axios.post(`${API}/taxatie-programma/${id}/finalize`, {}, { headers }); toast.success('Taxatie definitief gemaakt'); fetchTaxaties(); }
    catch { toast.error('Fout bij definitief maken'); }
  };

  const resetForm = () => { setView('list'); setEditingId(null); setForm({ ...EMPTY_FORM, damage_items: DEFAULT_DAMAGE_ITEMS.map(d => ({ ...d })) }); setManualDamageAmount(null); setTargetBpm(''); setShowChecklist(false); };

  const filtered = taxaties.filter(t => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return `${t.brand} ${t.model} ${t.customer_name}`.toLowerCase().includes(s);
  });

  if (selectedTaxatie) return <BpmReport taxatie={selectedTaxatie} onClose={() => setSelectedTaxatie(null)} />;
  if (loading) return <Layout><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" /></div></Layout>;

  /* ══ FORM VIEW ══ */
  if (view === 'form') {
    const effectiveHerstel = manualDamageAmount !== null ? manualDamageAmount : null;
    const bpm = calcBpmLocal(form, effectiveHerstel);
    
    // Reverse calculate: what damage amount is needed for a target BPM
    const calcNeededDamage = (target) => {
      if (!target || bpm.bpm_voor_aftrek <= 0) return 0;
      const needed = (bpm.bpm_voor_aftrek - target) / 0.31;
      return Math.max(0, Math.round(needed));
    };
    
    // When target BPM changes, calculate needed damage
    const handleTargetBpmChange = (val) => {
      setTargetBpm(val);
      if (val && !isNaN(val)) {
        const needed = calcNeededDamage(Number(val));
        setManualDamageAmount(needed);
      }
    };
    
    // Slider max: enough to bring BPM to 0
    const sliderMax = bpm.bpm_voor_aftrek > 0 ? Math.ceil(bpm.bpm_voor_aftrek / 0.31) : 50000;
    const currentDamageAmount = manualDamageAmount !== null ? manualDamageAmount : bpm.checklistTotal;
    
    return (
      <Layout>
        <div className="space-y-6" data-testid="bpm-taxatie-form">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <Shield className="w-7 h-7 text-red-600" />
              {editingId ? 'BPM Taxatie Bewerken' : 'Nieuwe BPM Taxatie'}
            </h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetForm} data-testid="cancel-btn">Annuleren</Button>
              <Button onClick={() => {
                // Smart AutoTelex link: open search with VIN if available
                const vin = form.vin_number?.trim();
                if (vin && vin.length >= 10) {
                  window.open(`https://autotelexpro.nl/Default.aspx`, '_blank');
                } else {
                  window.open('https://autotelexpro.nl/Default.aspx', '_blank');
                }
              }} variant="outline" className="border-blue-500 text-blue-700 hover:bg-blue-50 font-bold" data-testid="autotelex-btn">
                <ExternalLink className="w-4 h-4 mr-2" />AutoTelex PRO
              </Button>
              <Button onClick={() => window.open('https://ovi.rdw.nl/', '_blank')} variant="outline" className="border-teal-300 text-teal-700 hover:bg-teal-50" data-testid="rdw-btn">
                <ExternalLink className="w-4 h-4 mr-2" />RDW
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white" data-testid="save-bpm-btn">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Opslaan
              </Button>
            </div>
          </div>

          <BpmSummary form={form} overrideHerstelkosten={effectiveHerstel} />

          {/* Voertuiggegevens */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Bike className="w-5 h-5 text-red-600" />Voertuiggegevens</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { k: 'brand', l: 'Merk *', p: 'Vespa' },
                { k: 'model', l: 'Model *', p: 'GTS 300 HPE' },
                { k: 'mileage', l: 'Km-stand', p: '25000', t: 'number' },
                { k: 'color', l: 'Kleur', p: 'Zwart' },
                { k: 'fuel_type', l: 'Brandstof', p: 'Benzine' },
                { k: 'cylinder_capacity', l: 'Cilinderinhoud', p: '278 cc' },
              ].map(f => (
                <div key={f.k}>
                  <label className="text-xs font-bold text-zinc-600 block mb-1">{f.l}</label>
                  <input type={f.t || 'text'} value={form[f.k]} onChange={e => updateField(f.k, f.t === 'number' ? Number(e.target.value) : e.target.value)}
                    placeholder={f.p} className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none" data-testid={`field-${f.k}`} />
                </div>
              ))}
              <div>
                <label className="text-xs font-bold text-zinc-600 block mb-1">Chassisnummer (VIN)</label>
                <input type="text" value={form.vin_number} onChange={e => updateField('vin_number', e.target.value.toUpperCase())}
                  placeholder="ZAPMD310000034513" className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm font-mono tracking-wide focus:border-red-500 focus:outline-none" data-testid="field-vin_number" />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-600 block mb-1">Bouwjaar (datum)</label>
                <input type="date" value={form.bouwjaar} onChange={e => updateField('bouwjaar', e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none" data-testid="field-bouwjaar" />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-600 block mb-1">Vermogen (kW)</label>
                <input type="number" step="0.1" value={form.power_kw || ''} onChange={e => updateField('power_kw', Number(e.target.value))}
                  placeholder="17.5" className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none" data-testid="field-power_kw" />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-600 block mb-1">Datum eerste toelating</label>
                <input type="date" value={form.first_registration_date} onChange={e => updateField('first_registration_date', e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none" data-testid="field-first_registration_date" />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-600 block mb-1">
                  Datum rapport <span className="text-zinc-400 font-normal">(optioneel — anders vandaag)</span>
                </label>
                <input type="date" value={form.report_date} onChange={e => updateField('report_date', e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none" data-testid="field-report_date" />
              </div>
            </div>
          </div>

          {/* AutoTelex Gegevens Overnemen */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 p-6" data-testid="autotelex-import-section">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold flex items-center gap-2 text-blue-700">
                <ExternalLink className="w-5 h-5" />AutoTelex Gegevens Overnemen
              </h2>
              <Button 
                onClick={() => window.open('https://autotelexpro.nl/Default.aspx', '_blank')}
                size="sm" variant="outline" className="border-blue-400 text-blue-700 hover:bg-blue-100"
                data-testid="open-autotelex-btn"
              >
                <ExternalLink className="w-3 h-3 mr-1" />Open AutoTelex PRO
              </Button>
              <Button 
                onClick={runAutoTelexSearch}
                disabled={atxLoading}
                size="sm" className="ml-2 bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="atx-search-btn"
              >
                {atxLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Search className="w-3 h-3 mr-1" />}
                Zoek automatisch
              </Button>
            </div>
            <p className="text-xs text-blue-600 mb-4">
              Vul eerst <strong>merk</strong> en <strong>datum eerste toelating</strong> hierboven in, druk dan op
              <strong> "Zoek automatisch" </strong> en kies het juiste model uit de lijst — wij vullen catalogus- en consumentenprijs voor je in.
            </p>
            
            {form.vin_number && (
              <div className="bg-white/70 rounded-lg px-3 py-2 mb-4 flex items-center gap-2 border border-blue-100">
                <span className="text-xs text-blue-500 font-bold">VIN:</span>
                <span className="text-sm font-mono font-bold text-zinc-800 select-all">{form.vin_number}</span>
                <button type="button" onClick={() => { navigator.clipboard.writeText(form.vin_number); toast.success('VIN gekopieerd!'); }}
                  className="text-xs text-blue-600 hover:text-blue-800 ml-auto underline" data-testid="copy-vin-btn">
                  Kopieer VIN
                </button>
              </div>
            )}
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-bold text-blue-700 block mb-1">Netto catalogusprijs</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-400">€</span>
                  <input type="number" value={form.netto_catalogusprijs || ''} 
                    onChange={e => updateField('netto_catalogusprijs', Number(e.target.value))}
                    placeholder="Excl. BPM" 
                    className="w-full border-2 border-blue-300 rounded-lg pl-7 pr-3 py-2 text-sm font-bold focus:border-blue-500 focus:outline-none bg-white" 
                    data-testid="atx-netto-catalogusprijs" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-blue-700 block mb-1">Consumentenprijs</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-400">€</span>
                  <input type="number" value={form.consumentenprijs || ''} 
                    onChange={e => updateField('consumentenprijs', Number(e.target.value))}
                    placeholder="Incl. BPM" 
                    className="w-full border-2 border-blue-300 rounded-lg pl-7 pr-3 py-2 text-sm font-bold focus:border-blue-500 focus:outline-none bg-white" 
                    data-testid="atx-consumentenprijs" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-blue-700 block mb-1">Koerslijstwaarde</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-400">€</span>
                  <input type="number" value={form.koerslijst_waarde || ''} 
                    onChange={e => updateField('koerslijst_waarde', Number(e.target.value))}
                    placeholder="Handelsinkoopwaarde" 
                    className="w-full border-2 border-blue-300 rounded-lg pl-7 pr-3 py-2 text-sm font-bold focus:border-blue-500 focus:outline-none bg-white" 
                    data-testid="atx-koerslijstwaarde" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-blue-700 block mb-1">Taxatie inruilwaarde</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-400">€</span>
                  <input type="number" value={form.taxatie_inruil_waarde || ''} 
                    onChange={e => updateField('taxatie_inruil_waarde', Number(e.target.value))}
                    placeholder="Taxatierapport waarde" 
                    className="w-full border-2 border-blue-300 rounded-lg pl-7 pr-3 py-2 text-sm font-bold focus:border-blue-500 focus:outline-none bg-white" 
                    data-testid="atx-taxatiewaarde" />
                </div>
              </div>
            </div>
            
            {(form.netto_catalogusprijs > 0) && (
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                {bpm.bruto_bpm > 0 && <span className="bg-white rounded-full px-3 py-1 border border-blue-200 text-blue-700 font-bold">Bruto BPM: {fmtEur(bpm.bruto_bpm)}</span>}
                {bpm.forfaitair_percentage > 0 && <span className="bg-white rounded-full px-3 py-1 border border-green-200 text-green-700 font-bold">Forfaitair: {fmtPct(bpm.forfaitair_percentage)} → {fmtEur(bpm.forfaitair_bpm)}</span>}
                {bpm.koerslijst_percentage > 0 && <span className="bg-white rounded-full px-3 py-1 border border-purple-200 text-purple-700 font-bold">Koerslijst: {fmtPct(bpm.koerslijst_percentage)} → {fmtEur(bpm.koerslijst_bpm)}</span>}
                {bpm.taxatie_percentage > 0 && <span className="bg-white rounded-full px-3 py-1 border border-orange-200 text-orange-700 font-bold">Taxatie: {fmtPct(bpm.taxatie_percentage)} → {fmtEur(bpm.taxatie_bpm)}</span>}
              </div>
            )}
          </div>

          {/* BPM Terugrekenen (AutoTelex Taxatierapport methode) */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-300 p-6" data-testid="bpm-terugreken-card">
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2 text-purple-900">
              <Calculator className="w-5 h-5" />BPM Terugrekenen — voor AutoTelex Taxatierapport
            </h2>
            <p className="text-xs text-purple-700 mb-4">
              Vul de gewenste rest-BPM in. Wij rekenen voor je terug welke <strong>Taxatiewaarde totaal</strong> nodig is, en geven 3 manieren om die waarde te bereiken in AutoTelex.
            </p>

            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-xs font-bold text-purple-800 block mb-1">Bruto-BPM <span className="text-zinc-400 font-normal">(uit AutoTelex)</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-400">€</span>
                  <input
                    type="number"
                    value={terugrekenBruto}
                    onChange={e => setTerugrekenBruto(e.target.value)}
                    placeholder={bpm.bruto_bpm ? String(Math.round(bpm.bruto_bpm)) : '827'}
                    className="w-full border-2 border-purple-300 rounded-lg pl-7 pr-3 py-2 text-sm font-bold focus:border-purple-500 focus:outline-none bg-white"
                    data-testid="terugreken-bruto-bpm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-purple-800 block mb-1">Nieuwprijs incl. opties <span className="text-zinc-400 font-normal">(uit AutoTelex)</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-400">€</span>
                  <input
                    type="number"
                    value={terugrekenNieuw}
                    onChange={e => setTerugrekenNieuw(e.target.value)}
                    placeholder={form.consumentenprijs ? String(form.consumentenprijs) : '7298'}
                    className="w-full border-2 border-purple-300 rounded-lg pl-7 pr-3 py-2 text-sm font-bold focus:border-purple-500 focus:outline-none bg-white"
                    data-testid="terugreken-nieuwprijs"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-purple-800 block mb-1">Gewenste rest-BPM</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-400">€</span>
                  <input
                    type="number"
                    value={terugrekenTarget}
                    onChange={e => setTerugrekenTarget(e.target.value)}
                    placeholder="25"
                    className="w-full border-2 border-purple-500 rounded-lg pl-7 pr-3 py-2 text-sm font-bold focus:border-purple-700 focus:outline-none bg-white"
                    data-testid="terugreken-target-bpm"
                  />
                </div>
              </div>
            </div>

            {terugrekenResult && (
              <div className="bg-white rounded-xl border-2 border-purple-200 p-4" data-testid="terugreken-result">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-purple-100">
                  <div>
                    <p className="text-xs text-zinc-500">Benodigde Taxatiewaarde totaal</p>
                    <p className="text-3xl font-bold text-purple-700">{fmtEur(terugrekenResult.taxatiewaarde)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Afschrijvingspercentage</p>
                    <p className="text-xl font-bold text-purple-700">{fmtPct(terugrekenResult.afschrijving)}</p>
                  </div>
                </div>

                {/* AutoTelex Invul Helper */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-300 rounded-xl p-4 mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-1">AutoTelex Invul Helper</p>
                  <p className="text-xs text-zinc-600 mb-3">
                    Vul jouw <b>inkoopprijs</b> in (van factuur) — het systeem berekent precies wat je in AutoTelex moet invullen om op {fmtEur(Number(terugrekenTarget) || 0)} rest-BPM uit te komen.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 block mb-1">Inkoopprijs (uit factuur)</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">€</span>
                        <input type="number" placeholder="9000" value={terugrekenInkoop}
                          onChange={(e) => setTerugrekenInkoop(e.target.value)}
                          className="w-full border-2 border-blue-400 rounded-lg pl-7 pr-2 py-1.5 text-sm font-bold focus:border-blue-600 focus:outline-none bg-white"
                          data-testid="terugreken-inkoop" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 block mb-1">Overig waardevermindering</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">€</span>
                        <input type="number" placeholder="0" value={terugrekenOverig}
                          onChange={(e) => setTerugrekenOverig(e.target.value)}
                          className="w-full border-2 border-blue-400 rounded-lg pl-7 pr-2 py-1.5 text-sm font-bold focus:border-blue-600 focus:outline-none bg-white"
                          data-testid="terugreken-overig" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 block mb-1">Percentage (AutoTelex)</label>
                      <div className="relative">
                        <input type="number" min="1" max="100" value={terugrekenPct}
                          onChange={(e) => setTerugrekenPct(e.target.value)}
                          className="w-full border-2 border-blue-400 rounded-lg px-2 py-1.5 pr-6 text-sm font-bold focus:border-blue-600 focus:outline-none bg-white"
                          data-testid="terugreken-pct" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">%</span>
                      </div>
                    </div>
                  </div>

                  {terugrekenResult.autotelex && terugrekenResult.autotelex.valid && (
                    <div className="bg-white rounded-lg border-2 border-blue-500 overflow-hidden" data-testid="autotelex-helper-result">
                      <div className="bg-blue-600 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                        <span>Vul deze waarden in AutoTelex in:</span>
                        <span className="text-blue-100 font-mono">→ Rest-BPM {fmtEur(Number(terugrekenTarget) || 0)}</span>
                      </div>
                      <table className="w-full text-sm">
                        <tbody>
                          <tr className="border-b border-blue-100">
                            <td className="px-4 py-2 text-zinc-700">Handelsinkoopwaarde in onbeschadigde staat</td>
                            <td className="px-4 py-2 text-right font-mono font-bold text-blue-700" data-testid="atx-handel">€ {terugrekenResult.autotelex.handel.toLocaleString('nl-NL')}</td>
                          </tr>
                          <tr className="border-b border-blue-100 bg-blue-50">
                            <td className="px-4 py-2 text-zinc-700">Schadebedrag</td>
                            <td className="px-4 py-2 text-right font-mono font-bold text-blue-700" data-testid="atx-schade">€ {terugrekenResult.autotelex.schade.toLocaleString('nl-NL')}</td>
                          </tr>
                          <tr className="border-b border-blue-100">
                            <td className="px-4 py-2 text-zinc-700">Percentage</td>
                            <td className="px-4 py-2 text-right font-mono font-bold text-blue-700" data-testid="atx-pct">{terugrekenResult.autotelex.percentage}%</td>
                          </tr>
                          <tr className="border-b border-blue-100 bg-blue-50">
                            <td className="px-4 py-2 text-zinc-700">Overig waardeverminderingsbedrag</td>
                            <td className="px-4 py-2 text-right font-mono font-bold text-blue-700" data-testid="atx-overig">€ {terugrekenResult.autotelex.overig.toLocaleString('nl-NL')}</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2 text-zinc-500 text-xs italic">→ Gecorrigeerd schadebedrag</td>
                            <td className="px-4 py-2 text-right font-mono text-zinc-500 text-xs italic">€ {terugrekenResult.autotelex.gecorrigeerd.toLocaleString('nl-NL')}</td>
                          </tr>
                          <tr className="bg-green-50 border-t-2 border-green-300">
                            <td className="px-4 py-2 font-bold text-green-700">→ Taxatiewaarde totaal (uitkomst)</td>
                            <td className="px-4 py-2 text-right font-mono font-bold text-green-700">€ {terugrekenResult.autotelex.taxatiewaarde_calc.toLocaleString('nl-NL')}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="bg-blue-50 px-4 py-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const txt = `Handelsinkoopwaarde: € ${terugrekenResult.autotelex.handel.toLocaleString('nl-NL')}\nSchadebedrag: € ${terugrekenResult.autotelex.schade.toLocaleString('nl-NL')}\nPercentage: ${terugrekenResult.autotelex.percentage}%\nOverig waardevermindering: € ${terugrekenResult.autotelex.overig.toLocaleString('nl-NL')}`;
                            navigator.clipboard.writeText(txt);
                            toast.success('Gekopieerd naar klembord');
                          }}
                          className="text-xs font-bold text-blue-700 hover:text-blue-900 underline"
                          data-testid="copy-atx-btn"
                        >
                          Kopieer waarden
                        </button>
                      </div>
                    </div>
                  )}
                  {terugrekenResult.autotelex && !terugrekenResult.autotelex.valid && (
                    <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      ⚠️ Met deze inkoopprijs en overige bedragen is de gewenste rest-BPM niet haalbaar. Verlaag de inkoopprijs of het overig waardeverminderingsbedrag.
                    </p>
                  )}
                  {!terugrekenResult.autotelex && (
                    <p className="text-xs text-zinc-500 italic">Vul jouw inkoopprijs in om de AutoTelex velden te berekenen.</p>
                  )}
                </div>

                <p className="text-xs text-amber-700 mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠️ <strong>Let op:</strong> de Belastingdienst kan bewijs vragen. Zorg dat je schaderapport / fotos het schadebedrag onderbouwen.
                </p>
              </div>
            )}
          </div>

          {/* BPM Gegevens */}
          <div className="bg-white rounded-2xl border-2 border-red-200 p-6">
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2 text-red-700"><Calculator className="w-5 h-5" />BPM Berekening — Methode Overzicht</h2>
            <p className="text-xs text-zinc-500 mb-4">De voordeligste methode wordt automatisch gekozen op basis van de ingevoerde AutoTelex gegevens.</p>
            
            <div className="bg-zinc-50 rounded-xl p-4 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Methode 1: Forfaitaire Tabel (automatisch)</h3>
              <div className="flex items-center gap-4 text-sm">
                <p>Leeftijd: <strong>{bpm.months_age} maanden</strong></p>
                <p>Afschrijving: <strong className="text-green-700">{fmtPct(bpm.forfaitair_percentage)}</strong></p>
                <p>BPM: <strong>{fmtEur(bpm.forfaitair_bpm)}</strong></p>
              </div>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Methode 2: Koerslijst</h3>
              <div className="flex items-center gap-4 text-sm">
                {form.koerslijst_waarde > 0 ? (
                  <p>Afschrijving: <strong className="text-green-700">{fmtPct(bpm.koerslijst_percentage)}</strong> | BPM: <strong>{fmtEur(bpm.koerslijst_bpm)}</strong></p>
                ) : (
                  <p className="text-zinc-400">Vul koerslijstwaarde in bij AutoTelex gegevens</p>
                )}
              </div>
            </div>
            <div className="bg-zinc-50 rounded-xl p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">Methode 3: Taxatierapport</h3>
              <div className="flex items-center gap-4 text-sm">
                {form.taxatie_inruil_waarde > 0 ? (
                  <p>Afschrijving: <strong className="text-green-700">{fmtPct(bpm.taxatie_percentage)}</strong> | BPM: <strong>{fmtEur(bpm.taxatie_bpm)}</strong></p>
                ) : (
                  <p className="text-zinc-400">Vul taxatie inruilwaarde in bij AutoTelex gegevens</p>
                )}
              </div>
            </div>
          </div>

          {/* Schade & Herstelkosten - SNEL AANPASSEN */}
          <div className="bg-white rounded-2xl border-2 border-amber-200 p-6">
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2 text-amber-700"><Wrench className="w-5 h-5" />Schade & Herstelkosten</h2>
            <p className="text-xs text-zinc-500 mb-4">Pas het schadebedrag aan om de rest-BPM te verlagen. 31% wordt afgetrokken (Belastingdienst norm).</p>
            
            {/* ── SNEL AANPASSEN TOOLS ── */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-5 mb-5 space-y-4" data-testid="quick-damage-tools">
              
              {/* Direct schadebedrag invoer */}
              <div>
                <label className="text-xs font-bold text-amber-800 block mb-2">Totaal schadebedrag (herstelkosten)</label>
                <div className="flex gap-3 items-center">
                  <span className="text-sm font-bold text-zinc-500">€</span>
                  <input
                    type="number"
                    value={currentDamageAmount || ''}
                    onChange={e => {
                      const v = e.target.value === '' ? 0 : Number(e.target.value);
                      setManualDamageAmount(v);
                      setTargetBpm('');
                    }}
                    placeholder="Voer schadebedrag in..."
                    min="0"
                    step="100"
                    className="flex-1 border-2 border-amber-300 rounded-lg px-3 py-2.5 text-lg font-bold focus:border-amber-500 focus:outline-none bg-white"
                    data-testid="quick-damage-input"
                  />
                  <div className="text-right min-w-[120px]">
                    <p className="text-xs text-zinc-500">BPM-aftrek (31%)</p>
                    <p className="text-lg font-black text-green-700">- {fmtEur(currentDamageAmount * 0.31)}</p>
                  </div>
                </div>
              </div>
              
              {/* Slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-amber-800">Snel aanpassen</label>
                  <span className="text-xs text-zinc-500">€0 — €{sliderMax.toLocaleString('nl-NL')}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={sliderMax}
                  step="100"
                  value={currentDamageAmount}
                  onChange={e => {
                    setManualDamageAmount(Number(e.target.value));
                    setTargetBpm('');
                  }}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-amber-600"
                  style={{
                    background: `linear-gradient(to right, #d97706 0%, #d97706 ${(currentDamageAmount / sliderMax) * 100}%, #e5e7eb ${(currentDamageAmount / sliderMax) * 100}%, #e5e7eb 100%)`
                  }}
                  data-testid="damage-slider"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                  <span>Min schade</span>
                  <span>Rest-BPM: <strong className="text-red-600">{fmtEur(bpm.netto_bpm)}</strong></span>
                  <span>Max schade</span>
                </div>
              </div>
              
              {/* Gewenste rest-BPM terugrekenen */}
              <div className="bg-white/70 rounded-lg border border-amber-200 p-3">
                <label className="text-xs font-bold text-amber-800 block mb-2">Gewenste rest-BPM (terugrekenen)</label>
                <div className="flex gap-3 items-center">
                  <span className="text-sm font-bold text-zinc-500">€</span>
                  <input
                    type="number"
                    value={targetBpm}
                    onChange={e => handleTargetBpmChange(e.target.value)}
                    placeholder={`Max: ${fmtEur(bpm.bpm_voor_aftrek)}`}
                    min="0"
                    max={bpm.bpm_voor_aftrek}
                    step="10"
                    className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm focus:border-amber-500 focus:outline-none bg-white"
                    data-testid="target-bpm-input"
                  />
                  {targetBpm && (
                    <div className="text-right min-w-[140px]">
                      <p className="text-xs text-zinc-500">Benodigd schadebedrag</p>
                      <p className="text-sm font-bold text-amber-700">{fmtEur(currentDamageAmount)}</p>
                    </div>
                  )}
                </div>
                {targetBpm && Number(targetBpm) >= 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Om op {fmtEur(Number(targetBpm))} rest-BPM uit te komen is {fmtEur(currentDamageAmount)} aan herstelkosten nodig (31% = {fmtEur(currentDamageAmount * 0.31)} aftrek)
                  </p>
                )}
                {/* Auto-tick + AI uitleg */}
                {targetBpm && Number(targetBpm) >= 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-amber-200">
                    <button
                      type="button"
                      onClick={() => autoTickDamage(targetBpm)}
                      className="px-3 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center gap-1.5 transition-colors"
                      data-testid="auto-tick-damage-btn"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      Auto-vink schadepunten
                    </button>
                    <button
                      type="button"
                      onClick={generateOnderbouwing}
                      disabled={generatingText}
                      className="px-3 py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      data-testid="generate-onderbouwing-btn"
                    >
                      {generatingText
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI schrijft...</>
                        : <><Sparkles className="w-3.5 h-3.5" /> Genereer unieke onderbouwing (AI)</>
                      }
                    </button>
                  </div>
                )}
              </div>

              {/* Quick preset buttons */}
              <div className="flex flex-wrap gap-2">
                {[1000, 2500, 5000, 7500, 10000, 15000, 20000].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { setManualDamageAmount(v); setTargetBpm(''); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currentDamageAmount === v ? 'bg-amber-600 text-white' : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-100'}`}
                    data-testid={`preset-${v}`}
                  >
                    €{v.toLocaleString('nl-NL')}
                  </button>
                ))}
                {manualDamageAmount !== null && (
                  <button
                    type="button"
                    onClick={() => { setManualDamageAmount(null); setTargetBpm(''); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    data-testid="reset-to-checklist"
                  >
                    Terug naar checklist
                  </button>
                )}
              </div>
              
              {manualDamageAmount !== null && bpm.checklistTotal > 0 && manualDamageAmount !== bpm.checklistTotal && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Handmatig bedrag ({fmtEur(manualDamageAmount)}) wijkt af van checklist totaal ({fmtEur(bpm.checklistTotal)})
                </p>
              )}
            </div>

            {/* ── CHECKLIST (uitklapbaar) ── */}
            <div className="border border-zinc-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowChecklist(!showChecklist)}
                className="w-full flex items-center justify-between p-4 bg-zinc-50 hover:bg-zinc-100 transition-colors text-left"
                data-testid="toggle-checklist"
              >
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-zinc-500" />
                  <span className="font-bold text-sm text-zinc-700">Schadechecklist (26 punten)</span>
                  {bpm.checklistTotal > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                      {form.damage_items.filter(i => i.checked).length} items = {fmtEur(bpm.checklistTotal)}
                    </span>
                  )}
                </div>
                <span className={`text-zinc-400 transition-transform ${showChecklist ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {showChecklist && (
                <div className="p-4 border-t border-zinc-200">
                  <p className="text-xs text-zinc-500 mb-3">Onderbouwing: vink beschadigde onderdelen aan en vul de geschatte herstelkosten in.</p>
                  <DamageChecklist 
                    items={form.damage_items} 
                    onChange={items => {
                      updateField('damage_items', items);
                      // When checklist changes and we're not in manual mode, update
                      if (manualDamageAmount === null) {
                        setTargetBpm('');
                      }
                    }} 
                  />
                  {bpm.checklistTotal > 0 && manualDamageAmount === null && (
                    <div className="mt-3 text-center">
                      <p className="text-xs text-green-700 font-bold">Checklist totaal: {fmtEur(bpm.checklistTotal)} → BPM-aftrek: - {fmtEur(bpm.checklistTotal * 0.31)}</p>
                    </div>
                  )}
                  {bpm.checklistTotal > 0 && manualDamageAmount !== null && (
                    <div className="mt-3 text-center">
                      <button type="button" onClick={() => { setManualDamageAmount(null); setTargetBpm(''); }}
                        className="text-xs text-amber-700 underline hover:text-amber-900">
                        Gebruik checklist totaal ({fmtEur(bpm.checklistTotal)}) als schadebedrag
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="text-xs font-bold text-zinc-600 block mb-1">Toelichting schade</label>
              <textarea value={form.damage_notes} onChange={e => updateField('damage_notes', e.target.value)} placeholder="Extra toelichting bij de schade..."
                rows={2} className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none" data-testid="damage-notes" />
            </div>
          </div>

          {/* Klantgegevens */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><User className="w-5 h-5 text-red-600" />Klant / Eigenaar</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { k: 'customer_name', l: 'Naam', p: 'Jan Jansen' },
                { k: 'customer_phone', l: 'Telefoon', p: '+31612345678' },
                { k: 'customer_email', l: 'Email', p: 'jan@email.nl' },
                { k: 'customer_address', l: 'Adres', p: 'Straatnaam 1, 1234AB Stad' },
              ].map(f => (
                <div key={f.k}>
                  <label className="text-xs font-bold text-zinc-600 block mb-1">{f.l}</label>
                  <input type="text" value={form[f.k]} onChange={e => updateField(f.k, e.target.value)} placeholder={f.p}
                    className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none" data-testid={`field-${f.k}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Technische Inspectie */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Star className="w-5 h-5 text-red-600" />Technische Inspectie</h2>
            <p className="text-xs text-zinc-500 mb-4">Beoordeel elk onderdeel van 1 (slecht) tot 5 (uitstekend)</p>
            <div className="space-y-3">
              {INSPECTION_ITEMS.map(item => (
                <div key={item.key} className="flex items-start gap-4 p-3 rounded-lg bg-zinc-50">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{item.label}</p>
                    <p className="text-xs text-zinc-500">{item.desc}</p>
                  </div>
                  <ScoreSelector value={form[`score_${item.key}`]} onChange={v => updateField(`score_${item.key}`, v)} testId={`score-${item.key}`} />
                  {['engine', 'frame', 'paint', 'tires', 'brakes', 'electrics', 'general'].includes(item.key) && (
                    <input type="text" value={form[`notes_${item.key}`] || ''} onChange={e => updateField(`notes_${item.key}`, e.target.value)}
                      placeholder="Opmerking..." className="w-48 border border-zinc-300 rounded-lg px-2 py-1.5 text-xs focus:border-red-500 focus:outline-none" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Foto's */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Camera className="w-5 h-5 text-red-600" />Foto's</h2>
            <div className="flex flex-wrap gap-3 mb-3">
              {form.photos.map((p, i) => (
                <div key={i} className="relative w-28 h-28 rounded-lg overflow-hidden border group">
                  <img src={p} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setForm(f => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                </div>
              ))}
              <label className="w-28 h-28 rounded-lg border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center cursor-pointer hover:border-red-400 transition-colors" data-testid="photo-upload">
                {uploadingPhotos ? <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" /> : <><Camera className="w-6 h-6 text-zinc-400" /><span className="text-xs text-zinc-400 mt-1">Toevoegen</span></>}
                <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhotos} />
              </label>
            </div>
          </div>

          {/* Opmerkingen */}
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-lg font-bold mb-4">Opmerkingen</h2>
            <textarea value={form.notes} onChange={e => updateField('notes', e.target.value)} placeholder="Overige opmerkingen..." rows={3}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none" data-testid="notes" />
          </div>

          <div className="flex justify-end gap-3 pb-8">
            <Button variant="outline" onClick={resetForm}>Annuleren</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white" data-testid="save-bpm-btn-bottom">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Opslaan
            </Button>
          </div>
        </div>

        {/* AutoTelex search modal */}
        {atxOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setAtxOpen(false)} data-testid="atx-modal">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b flex items-center justify-between bg-blue-50">
                <div>
                  <h3 className="font-bold text-lg text-blue-900">AutoTelex resultaten</h3>
                  <p className="text-xs text-blue-700">{form.brand} • {form.first_registration_date} {form.model && `• filter: "${form.model}"`}</p>
                </div>
                <button onClick={() => setAtxOpen(false)} className="text-zinc-400 hover:text-zinc-700" data-testid="atx-close-btn"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 overflow-y-auto flex-1">
                {atxLoading && (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                    <p className="text-sm text-zinc-600">Bezig met inloggen op AutoTelex en ophalen resultaten — dit kan 10-15 seconden duren...</p>
                  </div>
                )}
                {!atxLoading && atxResults && atxResults.length === 0 && (
                  <div className="text-center py-12 text-zinc-500">
                    <p>Geen resultaten gevonden voor <strong>{form.brand}</strong> op {form.first_registration_date}.</p>
                    <p className="text-xs mt-2">Controleer of de datum klopt — AutoTelex hanteert vaak de datum dat het model op de markt kwam.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => window.open('https://autotelexpro.nl/Default.aspx', '_blank')}
                      data-testid="atx-fallback-open"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" /> Open AutoTelex PRO handmatig
                    </Button>
                  </div>
                )}
                {!atxLoading && atxResults && atxResults.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="atx-results-table">
                      <thead className="bg-zinc-50 text-zinc-600 text-xs uppercase">
                        <tr>
                          <th className="text-left p-2">Model</th>
                          <th className="text-right p-2">CC</th>
                          <th className="text-right p-2">kW/pk</th>
                          <th className="text-right p-2">BPM</th>
                          <th className="text-right p-2">Prijs</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {atxResults.map((r, idx) => (
                          <tr key={idx} className="border-t hover:bg-blue-50">
                            <td className="p-2 font-semibold text-zinc-900">{r.execution}</td>
                            <td className="p-2 text-right text-zinc-600">{r.cc || '-'}</td>
                            <td className="p-2 text-right text-zinc-600">{r.kw_pk || '-'}</td>
                            <td className="p-2 text-right text-zinc-700">{r.bpm ? `€${r.bpm.toLocaleString('nl-NL')}` : '-'}</td>
                            <td className="p-2 text-right font-bold text-blue-700">{r.prijs ? `€${r.prijs.toLocaleString('nl-NL')}` : '-'}</td>
                            <td className="p-2 text-right">
                              <Button
                                size="sm"
                                onClick={() => applyAtxResult(r)}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                data-testid={`atx-apply-${idx}`}
                              >
                                Overnemen
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* AI Onderbouwing — bewerk modal */}
        {aiModalOpen && (
          <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setAiModalOpen(false)}
            data-testid="ai-onderbouwing-modal"
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 bg-gradient-to-r from-purple-50 to-fuchsia-50">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-black text-zinc-900">AI Onderbouwing — Bewerk voor opslaan</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setAiModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
                  data-testid="ai-modal-close-btn"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              <div className="px-5 py-4 overflow-y-auto flex-1">
                <p className="text-xs text-zinc-500 mb-3">
                  De AI heeft onderstaande tekst gegenereerd. Pas aan waar nodig &mdash; deze tekst verschijnt op de pagina <b>&quot;Toelichting taxateur&quot;</b> in de PDF en wordt persoonlijk ondertekend.
                </p>
                <textarea
                  value={aiTextDraft}
                  onChange={(e) => setAiTextDraft(e.target.value)}
                  className="w-full min-h-[400px] border border-zinc-300 rounded-lg px-3 py-2 text-sm leading-relaxed focus:border-purple-500 focus:outline-none font-serif"
                  data-testid="ai-text-draft-textarea"
                />
                <p className="text-[10px] text-zinc-400 mt-2">
                  {aiTextDraft.length} tekens / ~{Math.ceil(aiTextDraft.split(/\s+/).filter(Boolean).length)} woorden
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-200 bg-zinc-50">
                <button
                  type="button"
                  onClick={() => setAiModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-zinc-300 hover:bg-zinc-100 transition-colors"
                  data-testid="ai-modal-cancel-btn"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={generateOnderbouwing}
                  disabled={generatingText}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-purple-300 text-purple-700 hover:bg-purple-50 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                  data-testid="ai-modal-regenerate-btn"
                >
                  {generatingText
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI schrijft...</>
                    : <><Sparkles className="w-3.5 h-3.5" /> Opnieuw genereren</>
                  }
                </button>
                <button
                  type="button"
                  onClick={saveAiText}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white inline-flex items-center gap-1.5 transition-colors"
                  data-testid="ai-modal-save-btn"
                >
                  <Save className="w-3.5 h-3.5" />
                  Opslaan in rapport
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    );
  }

  /* ══ LIST VIEW ══ */
  return (
    <Layout>
      <div className="space-y-6" data-testid="bpm-taxatie-programma">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <Shield className="w-7 h-7 text-red-600" />BPM Vermindering
            </h1>
            <p className="text-zinc-500 mt-1">Taxatieprogramma voor motorfiets BPM-berekening</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => window.open('https://www.autotelex.nl', '_blank')} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" data-testid="autotelex-list-btn">
              <ExternalLink className="w-4 h-4 mr-2" />AutoTelex
            </Button>
            <Button onClick={() => window.open('https://ovi.rdw.nl/', '_blank')} variant="outline" className="border-teal-300 text-teal-700 hover:bg-teal-50">
              <ExternalLink className="w-4 h-4 mr-2" />RDW
            </Button>
            <Button onClick={() => { setForm({ ...EMPTY_FORM, damage_items: DEFAULT_DAMAGE_ITEMS.map(d => ({ ...d })) }); setEditingId(null); setView('form'); }} className="bg-red-600 hover:bg-red-700 text-white" data-testid="new-bpm-taxatie-btn">
              <Plus className="w-4 h-4 mr-2" />Nieuwe BPM Taxatie
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Zoek op merk, model of klant..."
            className="w-full pl-10 pr-4 py-3 border border-zinc-300 rounded-xl text-sm focus:border-red-500 focus:outline-none" data-testid="search-bpm-taxatie" />
        </div>

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

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border p-10 text-center text-zinc-400">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Geen BPM taxaties gevonden</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => {
              const dmgCount = (t.damage_items || []).filter(d => d.checked).length;
              return (
                <div key={t.id} className="bg-white rounded-2xl border hover:border-zinc-300 transition-colors overflow-hidden" data-testid={`taxatie-${t.id}`}>
                  <div className="p-5 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-zinc-100 flex items-center justify-center flex-shrink-0">
                      {t.photos?.[0] ? <img src={t.photos[0]} alt="" className="w-full h-full object-cover rounded-xl" /> : <Bike className="w-8 h-8 text-zinc-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-lg">{t.brand} {t.model}</h3>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${t.status === 'definitief' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {t.status === 'definitief' ? 'Definitief' : 'Concept'}
                        </span>
                        {dmgCount > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{dmgCount} schade</span>}
                      </div>
                      <p className="text-sm text-zinc-500">{t.vin_number && <span className="font-mono">{t.vin_number}</span>}{t.vin_number && ' · '}{t.bouwjaar ? new Date(t.bouwjaar).toLocaleDateString('nl-NL') : ''}{(t.bouwjaar && t.mileage) ? ' · ' : ''}{t.mileage ? `${t.mileage.toLocaleString('nl-NL')} km` : ''}</p>
                      <p className="text-xs text-zinc-400">{t.taxatie_nummer}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-zinc-400">BPM te betalen</p>
                      <p className="text-xl font-black text-red-600" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{fmtEur(t.netto_bpm)}</p>
                      <p className="text-xs text-green-600 font-bold">- {fmtEur(t.bpm_vermindering)} vermindering</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setSelectedTaxatie(t)} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500" title="Rapport" data-testid={`view-${t.id}`}><Eye className="w-4 h-4" /></button>
                      <button onClick={() => handleEdit(t)} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500" title="Bewerken" data-testid={`edit-${t.id}`}><Edit2 className="w-4 h-4" /></button>
                      {t.status === 'concept' && <button onClick={() => handleFinalize(t.id)} className="p-2 rounded-lg hover:bg-green-100 text-green-600" title="Definitief maken" data-testid={`finalize-${t.id}`}><FileCheck className="w-4 h-4" /></button>}
                      <button onClick={() => handleDelete(t.id)} className="p-2 rounded-lg hover:bg-red-100 text-red-500" title="Verwijderen" data-testid={`delete-${t.id}`}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
