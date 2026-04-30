import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getBranding } from '../../utils/branding';
import Layout from '../../components/Layout';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Plus, Search, Printer, Trash2, Eye, Edit2, ExternalLink, Download,
  Star, Camera, Save, FileCheck, X, Loader2, Bike, Phone, MapPin, User, Mail,
  Calculator, AlertTriangle, ArrowLeft, Shield, Wrench, Check, CheckSquare, Sparkles, RefreshCw, Send, Inbox
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmtEur = (p) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(p || 0);
const fmtPct = (p) => `${(p || 0).toFixed(1)}%`;

const CONDITION_LABELS = { 1: 'Slecht', 2: 'Matig', 3: 'Redelijk', 4: 'Goed', 5: 'Uitstekend' };
const CONDITION_COLORS = { 1: 'bg-red-500', 2: 'bg-orange-500', 3: 'bg-yellow-500', 4: 'bg-green-500', 5: 'bg-emerald-600' };

const INSPECTION_ITEMS_MOTOR = [
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

const INSPECTION_ITEMS_AUTO = [
  { key: 'engine', label: 'Motorblok', desc: 'Geluid, olielekkage, vermogen, koeling' },
  { key: 'frame', label: 'Carrosserie & Chassis', desc: 'Roest, deuken, scheuren, structurele staat' },
  { key: 'paint', label: 'Lak & Optisch', desc: 'Lakschade, krassen, deuken, kleurverschil' },
  { key: 'glass', label: 'Ruiten & Optiek', desc: 'Voorruit, zijruiten, koplampen, achterlichten' },
  { key: 'tires', label: 'Banden & Velgen', desc: 'Profieldiepte, leeftijd, velgschade' },
  { key: 'brakes', label: 'Remsysteem', desc: 'Remschijven, remblokken, remvloeistof, ABS' },
  { key: 'electrics', label: 'Elektra & Multimedia', desc: 'Accu, dashboard, infotainment, sensoren' },
  { key: 'exhaust', label: 'Uitlaat & Emissie', desc: 'Roest, lekkage, katalysator, EGR' },
  { key: 'suspension', label: 'Onderstel & Stuurinrichting', desc: 'Schokdempers, fuseekogels, stabilisator' },
  { key: 'chain_drive', label: 'Aandrijflijn', desc: 'Koppeling, versnellingsbak, distributie, aandrijfas' },
  { key: 'climate', label: 'Airco & Klimaatregeling', desc: 'Koeling, verwarming, lekkage' },
  { key: 'interior', label: 'Interieur & Bekleding', desc: 'Stoelen, dashboard, vloermatten, slijtage' },
  { key: 'general', label: 'Algemene Staat', desc: 'Totaalindruk, netheid, onderhoudshistorie' },
];

const getInspectionItemsForUser = (user) => {
  const vt = (user?.vehicle_type || 'motorfiets').toLowerCase();
  return vt === 'auto' ? INSPECTION_ITEMS_AUTO : INSPECTION_ITEMS_MOTOR;
};

// Backward compatibility
const INSPECTION_ITEMS = INSPECTION_ITEMS_MOTOR;

// Realistische opmerkingen per inspectie-onderdeel per score (1-4).
// Wordt door `autoTickDamage` gebruikt om de technische inspectie-tabel te variëren.
const INSPECTION_NOTES = {
  engine: {
    2: ['Lichte olieafzetting bij carterpakking', 'Draait stationair iets onregelmatig', 'Koelvloeistofpeil net onder minimum', 'Geringe rookontwikkeling bij koude start'],
    3: ['Start goed, draait zonder bijgeluiden', 'Normale gebruikssporen zichtbaar', 'Onderhoudsbeurt op korte termijn gewenst', 'Compressie binnen tolerantie'],
    4: ['Motor loopt soepel en rustig', 'Olie schoon, geen lekkages vastgesteld', 'Koelsysteem op peil', 'Goede algehele indruk'],
  },
  frame: {
    2: ['Beginnende oppervlakteroest op framewerk', 'Lichte transportsporen aan onderzijde', 'Stuurkoplagering voelt iets stram', 'Deuken in onderkuipsteun'],
    3: ['Geen structurele schade, kleine gebruikssporen', 'Licht opgesnoeide lak op framewerk', 'Normale staat voor bouwjaar', 'Lasnaden intact'],
    4: ['Frame recht en ongeschonden', 'Geen roest of vervorming zichtbaar', 'Structureel in prima staat', 'Lakwerk frame onbeschadigd'],
  },
  paint: {
    2: ['Diverse steenslag op voorzijde', 'Krassen op tank en zijpanelen', 'Kleurverschil op gespoten paneel', 'Doffe plekken op heldere lak'],
    3: ['Normale gebruikssporen en lichte krassen', 'Lakglans nog acceptabel', 'Enkele matte plekken zichtbaar', 'Oppervlakkige chips bij neus'],
    4: ['Lak in verzorgde staat, glans aanwezig', 'Minimale gebruikssporen', 'Geen kleurverschillen waarneembaar', 'Net gepoetst en geconserveerd'],
  },
  glass: {
    2: ['Steenslag op voorruit in zichtveld', 'Matheid op koplampen, polijsten advies', 'Kras op zijruit rechts', 'Condensvorming in achterlicht'],
    3: ['Koplampen licht verkleurd, nog helder genoeg', 'Ruiten zonder scheuren', 'Achterlichten intact', 'Geen barsten zichtbaar'],
    4: ['Helder glaswerk, geen beschadigingen', 'Koplampen helder en krasvrij', 'Alle ruiten in goede staat', 'Glasafdichtingen soepel'],
  },
  tires: {
    2: ['Profieldiepte onder 3 mm, vervanging advies', 'Banden ouder dan 5 jaar (DOT)', 'Lichte scheuren in zijwand', 'Ongelijkmatige slijtage'],
    3: ['Profiel voldoende, leeftijd acceptabel', 'Normale slijtage zichtbaar', 'Geschikt voor nog één seizoen', 'Banden goed op spanning'],
    4: ['Banden recent vervangen, profiel ruim voldoende', 'Geen slijtage, goed profiel', 'Nog voor meerdere seizoenen bruikbaar', 'Fabrikantenset zonder reparaties'],
  },
  brakes: {
    2: ['Remblokken op vervangingsgrens', 'Remvloeistof licht vervuild / verkleurd', 'Lichte roestvorming op schijfranden', 'Zachte pedaalgang'],
    3: ['Remwerking goed, blokken nog voldoende', 'Schijven binnen tolerantie', 'Normale staat', 'Remvloeistof op niveau'],
    4: ['Remmen in uitstekende staat', 'Blokken en schijven ruim voldoende', 'Direct bruikbaar', 'Recent onderhoud verricht'],
  },
  electrics: {
    2: ['Dashboardverlichting intermitterend', 'Accu levert grenswaarde', 'Eén knipperlicht traag', 'Losse connector bij achterlicht'],
    3: ['Alle verlichting functioneel', 'Accuspanning binnen norm', 'Geen storingscodes aanwezig', 'Dashboard werkt correct'],
    4: ['Elektrisch systeem probleemloos', 'Accu en laadsysteem uitstekend', 'Alle functies werken correct', 'Recent doorgemeten'],
  },
  exhaust: {
    2: ['Oppervlakteroest op demper', 'Lichte lekkage bij flens', 'Iets luider dan origineel', 'Beschadigd hitteschild'],
    3: ['Normale staat, kleine roestvorming', 'Geen lekkage vastgesteld', 'Geluidsniveau binnen norm', 'Bevestigingsbeugels intact'],
    4: ['Uitlaat zonder roest of lekkage', 'Originele specificatie', 'In prima staat', 'Alle lassen gaaf'],
  },
  suspension: {
    2: ['Voorvork vertoont olieafzetting op stofkappen', 'Achterdemper veert ongelijkmatig', 'Rubbers verouderd, vervanging gewenst', 'Lichte lekkage bij keerring'],
    3: ['Vering functioneel, normale slijtage', 'Geen duidelijke lekkage', 'Demping binnen tolerantie', 'Voorvork recht'],
    4: ['Vering soepel en lekvrij', 'Demping zonder op- of aftrekking', 'In uitstekende staat', 'Recent gereviseerd'],
  },
  chain_drive: {
    2: ['Ketting uitgerekt, spanning onregelmatig', 'Tandwielen vertonen hooktail-slijtage', 'Smering vereist', 'Kettinggeleider versleten'],
    3: ['Ketting binnen spanning, normale slijtage', 'Aandrijving functioneel', 'Onderhoud recent uitgevoerd', 'Nog geen vervanging nodig'],
    4: ['Ketting en tandwielen recent vernieuwd', 'Aandrijflijn probleemloos', 'Uitstekend onderhouden', 'O-ring ketting intact'],
  },
  climate: {
    2: ['Airco koelt verminderd', 'Lichte geur bij verwarming', 'Bijvulbeurt advies', 'Ventilatorlagers rammelen licht'],
    3: ['Airco functioneel, laatste service > 1 jaar', 'Verwarming werkt naar behoren', 'Geen lekkage vastgesteld', 'Filters acceptabel'],
    4: ['Airco koelt direct, service recent', 'Klimaatregeling volledig functioneel', 'In prima staat', 'Filters recent vervangen'],
  },
  interior: {
    2: ['Stoelbekleding vertoont slijtageplekken', 'Dashboard met lichte krassen', 'Vloermatten versleten', 'Bestuurderszijde zitting ingezakt'],
    3: ['Normale gebruikssporen in interieur', 'Stoelen in acceptabele staat', 'Bekleding compleet', 'Stuurwiel toont lichte slijtage'],
    4: ['Interieur verzorgd en netjes', 'Stoelen zonder schade', 'Dashboard ongeschonden', 'Rookvrij en nette geur'],
  },
  general: {
    2: ['Achterstallig onderhoud zichtbaar', 'Diverse kleine gebreken gecombineerd', 'Totaalindruk matig', 'Rijklaar maken vereist'],
    3: ['Normale staat voor bouwjaar en km-stand', 'Regelmatig gebruik, verzorgde indruk', 'Compleet en rijklaar', 'Onderhoudshistorie deels bekend'],
    4: ['Verzorgd exemplaar met aantoonbaar onderhoud', 'Totaalindruk boven gemiddeld', 'Nette staat', 'Volledige onderhoudshistorie'],
  },
};

// Pick een gewogen score op basis van `intensity` (0 = weinig schade, 1 = veel schade).
// Hoe hoger de intensity, hoe groter de kans op score 2; lage intensity geeft vaker score 4.
const pickInspectionScore = (intensity) => {
  const r = Math.random();
  if (intensity > 0.7) {
    if (r < 0.55) return 2;
    if (r < 0.92) return 3;
    return 4;
  }
  if (intensity > 0.4) {
    if (r < 0.25) return 2;
    if (r < 0.8) return 3;
    return 4;
  }
  if (r < 0.1) return 2;
  if (r < 0.5) return 3;
  return 4;
};



const DAMAGE_ITEMS_MOTOR = [
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

// Auto-specifieke schade items (personenauto's)
const DAMAGE_ITEMS_AUTO = [
  { name: 'Lakwerk / Spuitwerk (krassen, deuken)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Bumper voor (deuken / krassen)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Bumper achter (deuken / krassen)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Voorruit (sterretje / barst)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Zijruiten / Achterruit', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Koplampen (mat / beschadigd)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Achterlichten / Mistlamp', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Spiegels (elektrisch / behuizing)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Velgen (krassen / kromme rand)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Banden (profiel / leeftijd)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Remschijven / Remblokken voor', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Remschijven / Remblokken achter', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Schokdempers voor', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Schokdempers achter', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Stuurinrichting / Fuseekogels', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Wiellagers', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Aandrijfas / Stofhoezen', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Distributieriem / -ketting', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Koppeling (slipt / versleten)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Versnellingsbak / Olielekkage', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Uitlaat (roest / lek / katalysator)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Accu', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Airco (geen koeling / lek)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Ruitenwissers / Sproeiers', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Interieur / Bekleding (slijtage / scheuren)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Dashboard / Multimedia', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Centrale vergrendeling / Sleutels', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Koelvloeistof systeem / Radiateur', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Olieverlies (motor / versnellingsbak)', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Foutcodes / ECU diagnose', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Roest / Corrosie onderzijde', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'APK gebreken / Verwacht herstel', checked: false, cost: 0, hours: 0, material_cost: 0 },
  { name: 'Overig', checked: false, cost: 0, hours: 0, material_cost: 0 },
];

const getDamageItemsForUser = (user) => {
  const vt = (user?.vehicle_type || 'motorfiets').toLowerCase();
  return vt === 'auto' ? DAMAGE_ITEMS_AUTO : DAMAGE_ITEMS_MOTOR;
};

// Backward compatibility — kept for existing references
const DEFAULT_DAMAGE_ITEMS = DAMAGE_ITEMS_MOTOR;

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
  const { user } = useAuth();
  const cb = getBranding(user);
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
          <Button onClick={() => {
            const token = localStorage.getItem('token');
            const xhr = new XMLHttpRequest();
            xhr.open('GET', `${process.env.REACT_APP_BACKEND_URL}/api/taxatie-programma/${taxatie.id}/bundle-pdf`, true);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.responseType = 'blob';
            xhr.onload = function() {
              if (xhr.status === 200) {
                const blob = xhr.response;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Taxatie_Compleet_${taxatie.brand}_${taxatie.model}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } else {
                alert('Fout bij bundel-PDF: server fout ' + xhr.status);
              }
            };
            xhr.onerror = function() { alert('Fout bij bundel-PDF: netwerk fout'); };
            xhr.send();
          }} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="download-bundle-pdf-btn">
            <Download className="w-4 h-4 mr-2" />Rapport + Taxatieverslag
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
              <p className="text-zinc-400 mt-1">Taxatierapport {cb.vehicleLabel.charAt(0).toUpperCase() + cb.vehicleLabel.slice(1)}</p>
              <p className="text-zinc-500 text-sm mt-1">{cb.name}{cb.kvk ? ` | KVK: ${cb.kvk}` : ''}</p>
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
            {taxatie.damage_notes && (
              <p className="text-xs text-zinc-400 italic mb-4 print:hidden">
                Toelichting taxateur is opgenomen op een aparte pagina in het Taxatieverslag PDF.
              </p>
            )}

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
                {getInspectionItemsForUser(user).map(item => {
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
              <p className="text-xs text-zinc-500">
                Datum:{' '}
                <span className="font-medium text-zinc-700">
                  {taxatie.report_date
                    ? new Date(taxatie.report_date).toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' })
                    : new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-zinc-500 mb-12">Handtekening Eigenaar</p>
              <div className="border-b border-zinc-300 mb-2" />
              <p className="text-xs text-zinc-500">
                Datum:{' '}
                <span className="font-medium text-zinc-700">
                  {taxatie.report_date
                    ? new Date(taxatie.report_date).toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' })
                    : new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
              </p>
            </div>
          </div>

          <div className="text-center text-xs text-zinc-400 pt-6 border-t">
            <p>{cb.name}{cb.kvk ? ` | KVK: ${cb.kvk}` : ''}{cb.phone ? ` | ${cb.phone}` : ''}{cb.email ? ` | ${cb.email}` : ''}</p>
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
  const cb = getBranding(user);
  const userDamageItems = getDamageItemsForUser(user);
  const [taxaties, setTaxaties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [editingId, setEditingId] = useState(null);
  const [selectedTaxatie, setSelectedTaxatie] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, damage_items: userDamageItems.map(d => ({ ...d })) });
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
  const [finalizeModal, setFinalizeModal] = useState(null); // { id, brand, model } or null
  const [finalizeDate, setFinalizeDate] = useState('');

  // ===== Auto-vink schadepunten op basis van gewenste BPM =====
  // ===== Cost tables / tier-systems — verschillend voor auto's en motoren =====
  const isAuto = (cb.vehicleType || 'motorfiets') === 'auto';

  const DAMAGE_COST_TABLE_MOTOR = {
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

  const DAMAGE_COST_TABLE_AUTO = {
    'Lakwerk / Spuitwerk (krassen, deuken)': 750,
    'Bumper voor (deuken / krassen)': 480,
    'Bumper achter (deuken / krassen)': 450,
    'Voorruit (sterretje / barst)': 420,
    'Zijruiten / Achterruit': 320,
    'Koplampen (mat / beschadigd)': 280,
    'Achterlichten / Mistlamp': 180,
    'Spiegels (elektrisch / behuizing)': 220,
    'Velgen (krassen / kromme rand)': 350,
    'Banden (profiel / leeftijd)': 480,
    'Remschijven / Remblokken voor': 280,
    'Remschijven / Remblokken achter': 240,
    'Schokdempers voor': 380,
    'Schokdempers achter': 360,
    'Stuurinrichting / Fuseekogels': 320,
    'Wiellagers': 220,
    'Aandrijfas / Stofhoezen': 380,
    'Distributieriem / -ketting': 680,
    'Koppeling (slipt / versleten)': 850,
    'Versnellingsbak / Olielekkage': 420,
    'Uitlaat (roest / lek / katalysator)': 580,
    'Accu': 180,
    'Airco (geen koeling / lek)': 320,
    'Ruitenwissers / Sproeiers': 95,
    'Interieur / Bekleding (slijtage / scheuren)': 380,
    'Dashboard / Multimedia': 320,
    'Centrale vergrendeling / Sleutels': 240,
    'Koelvloeistof systeem / Radiateur': 380,
    'Olieverlies (motor / versnellingsbak)': 280,
    'Foutcodes / ECU diagnose': 180,
    'Roest / Corrosie onderzijde': 480,
    'APK gebreken / Verwacht herstel': 320,
    'Overig': 280,
  };

  const DAMAGE_COST_TABLE = isAuto ? DAMAGE_COST_TABLE_AUTO : DAMAGE_COST_TABLE_MOTOR;

  const DAMAGE_TIERS_MOTOR = [
    { prob: 0.9, items: ['Banden (versleten / oud)', 'Accu', 'Lak / Spuitwerk', 'Ketting / Tandwielen', 'Remschijven / Remblokken'] },
    { prob: 0.6, items: ['Kuipdelen / Stroomlijnkappen', 'Tank (deuken / krassen)', 'Spiegels', 'Voorvork (lekkage / krom)', 'Verlichting (koplamp / achterlicht)', 'Uitlaat (roest / lek)'] },
    { prob: 0.35, items: ['Achterdemper (lek / versleten)', 'Stuurlagers', 'Wiellagers', 'Koppeling (versleten)', 'Zadel (gescheurd / versleten)', 'Windscherm', 'Knipperlichten / Richtingaanwijzers'] },
    { prob: 0.15, items: ['Voetsteunen / Schakelpedaal', 'Koelvloeistof systeem', 'Remvloeistof / Remleidingen', 'Dashboard / Instrumenten', 'Corrosie / Roest algemeen'] },
  ];

  const DAMAGE_TIERS_AUTO = [
    // Tier 1 (90%): bijna altijd
    { prob: 0.9, items: [
      'Banden (profiel / leeftijd)',
      'Remschijven / Remblokken voor',
      'Lakwerk / Spuitwerk (krassen, deuken)',
      'Accu',
      'Ruitenwissers / Sproeiers',
    ]},
    // Tier 2 (60%): vaak voorkomend
    { prob: 0.6, items: [
      'Bumper voor (deuken / krassen)',
      'Bumper achter (deuken / krassen)',
      'Remschijven / Remblokken achter',
      'Velgen (krassen / kromme rand)',
      'Voorruit (sterretje / barst)',
      'Schokdempers voor',
      'Uitlaat (roest / lek / katalysator)',
      'Spiegels (elektrisch / behuizing)',
    ]},
    // Tier 3 (35%): occasioneel
    { prob: 0.35, items: [
      'Schokdempers achter',
      'Stuurinrichting / Fuseekogels',
      'Wiellagers',
      'Koplampen (mat / beschadigd)',
      'Achterlichten / Mistlamp',
      'Aandrijfas / Stofhoezen',
      'Interieur / Bekleding (slijtage / scheuren)',
      'Olieverlies (motor / versnellingsbak)',
    ]},
    // Tier 4 (15%): zelden
    { prob: 0.15, items: [
      'Distributieriem / -ketting',
      'Koppeling (slipt / versleten)',
      'Versnellingsbak / Olielekkage',
      'Airco (geen koeling / lek)',
      'Centrale vergrendeling / Sleutels',
      'Koelvloeistof systeem / Radiateur',
      'Foutcodes / ECU diagnose',
      'Roest / Corrosie onderzijde',
      'Dashboard / Multimedia',
      'APK gebreken / Verwacht herstel',
    ]},
  ];

  const DAMAGE_TIERS = isAuto ? DAMAGE_TIERS_AUTO : DAMAGE_TIERS_MOTOR;

  // Merk-specifieke bias: +0.25 boost (vaker), -0.25 dampen (zelden) — per kentekens van bekende zwakheden
  const BRAND_BIASES_MOTOR = {
    'bmw':       { 'Stuurlagers': 0.25, 'Wiellagers': 0.25, 'Dashboard / Instrumenten': 0.20, 'Achterdemper (lek / versleten)': 0.20 },
    'ktm':       { 'Koppeling (versleten)': 0.30, 'Uitlaat (roest / lek)': 0.25, 'Voorvork (lekkage / krom)': 0.20, 'Lak / Spuitwerk': 0.15 },
    'husqvarna': { 'Koppeling (versleten)': 0.30, 'Uitlaat (roest / lek)': 0.25, 'Banden (versleten / oud)': 0.20 },
    'ducati':    { 'Koppeling (versleten)': 0.35, 'Voorvork (lekkage / krom)': 0.20, 'Lak / Spuitwerk': 0.15, 'Achterdemper (lek / versleten)': 0.20 },
    'aprilia':   { 'Voorvork (lekkage / krom)': 0.25, 'Stuurlagers': 0.20, 'Lak / Spuitwerk': 0.20 },
    'mv agusta': { 'Lak / Spuitwerk': 0.25, 'Voorvork (lekkage / krom)': 0.20, 'Koppeling (versleten)': 0.20 },
    'yamaha':    { 'Ketting / Tandwielen': 0.20, 'Knipperlichten / Richtingaanwijzers': 0.20, 'Lak / Spuitwerk': 0.15 },
    'honda':     { 'Banden (versleten / oud)': 0.15, 'Accu': 0.15, 'Lak / Spuitwerk': 0.10, 'Uitlaat (roest / lek)': -0.20, 'Koppeling (versleten)': -0.15 },
    'suzuki':    { 'Corrosie / Roest algemeen': 0.25, 'Verlichting (koplamp / achterlicht)': 0.20, 'Accu': 0.15 },
    'kawasaki':  { 'Lak / Spuitwerk': 0.20, 'Uitlaat (roest / lek)': 0.20, 'Ketting / Tandwielen': 0.20 },
    'triumph':   { 'Corrosie / Roest algemeen': 0.25, 'Dashboard / Instrumenten': 0.20, 'Lak / Spuitwerk': 0.15 },
    'vespa':     { 'Lak / Spuitwerk': 0.30, 'Corrosie / Roest algemeen': 0.30, 'Spiegels': 0.20, 'Verlichting (koplamp / achterlicht)': 0.20, 'Banden (versleten / oud)': -0.10 },
    'piaggio':   { 'Lak / Spuitwerk': 0.25, 'Corrosie / Roest algemeen': 0.25, 'Verlichting (koplamp / achterlicht)': 0.20 },
    'harley-davidson': { 'Lak / Spuitwerk': 0.25, 'Accu': 0.20, 'Corrosie / Roest algemeen': 0.20, 'Knipperlichten / Richtingaanwijzers': 0.20 },
    'indian':    { 'Lak / Spuitwerk': 0.25, 'Accu': 0.20, 'Corrosie / Roest algemeen': 0.20 },
    'royal enfield': { 'Corrosie / Roest algemeen': 0.30, 'Verlichting (koplamp / achterlicht)': 0.20, 'Accu': 0.20 },
  };

  const BRAND_BIASES_AUTO = {
    'volkswagen': { 'Distributieriem / -ketting': 0.25, 'Koppeling (slipt / versleten)': 0.20, 'Foutcodes / ECU diagnose': 0.20 },
    'vw':         { 'Distributieriem / -ketting': 0.25, 'Koppeling (slipt / versleten)': 0.20, 'Foutcodes / ECU diagnose': 0.20 },
    'audi':       { 'Distributieriem / -ketting': 0.25, 'Versnellingsbak / Olielekkage': 0.20, 'Olieverlies (motor / versnellingsbak)': 0.20, 'Foutcodes / ECU diagnose': 0.20 },
    'bmw':        { 'Olieverlies (motor / versnellingsbak)': 0.25, 'Koelvloeistof systeem / Radiateur': 0.25, 'Versnellingsbak / Olielekkage': 0.20, 'Foutcodes / ECU diagnose': 0.20 },
    'mercedes':   { 'Olieverlies (motor / versnellingsbak)': 0.20, 'Roest / Corrosie onderzijde': 0.25, 'Airco (geen koeling / lek)': 0.20 },
    'mercedes-benz': { 'Olieverlies (motor / versnellingsbak)': 0.20, 'Roest / Corrosie onderzijde': 0.25, 'Airco (geen koeling / lek)': 0.20 },
    'opel':       { 'Roest / Corrosie onderzijde': 0.25, 'Olieverlies (motor / versnellingsbak)': 0.20, 'Distributieriem / -ketting': 0.20 },
    'ford':       { 'Distributieriem / -ketting': 0.25, 'Koppeling (slipt / versleten)': 0.20, 'Lakwerk / Spuitwerk (krassen, deuken)': 0.15 },
    'renault':    { 'Foutcodes / ECU diagnose': 0.25, 'Centrale vergrendeling / Sleutels': 0.20, 'Distributieriem / -ketting': 0.20, 'Olieverlies (motor / versnellingsbak)': 0.20 },
    'peugeot':    { 'Foutcodes / ECU diagnose': 0.25, 'Distributieriem / -ketting': 0.25, 'Olieverlies (motor / versnellingsbak)': 0.20 },
    'citroen':    { 'Foutcodes / ECU diagnose': 0.25, 'Distributieriem / -ketting': 0.25, 'Olieverlies (motor / versnellingsbak)': 0.20 },
    'citroën':    { 'Foutcodes / ECU diagnose': 0.25, 'Distributieriem / -ketting': 0.25, 'Olieverlies (motor / versnellingsbak)': 0.20 },
    'fiat':       { 'Roest / Corrosie onderzijde': 0.25, 'Lakwerk / Spuitwerk (krassen, deuken)': 0.20, 'Foutcodes / ECU diagnose': 0.20 },
    'alfa romeo': { 'Foutcodes / ECU diagnose': 0.25, 'Olieverlies (motor / versnellingsbak)': 0.25, 'Distributieriem / -ketting': 0.20 },
    'toyota':     { 'Banden (profiel / leeftijd)': 0.15, 'Accu': 0.15, 'Olieverlies (motor / versnellingsbak)': -0.20, 'Distributieriem / -ketting': -0.15 },
    'lexus':      { 'Banden (profiel / leeftijd)': 0.15, 'Lakwerk / Spuitwerk (krassen, deuken)': 0.10, 'Olieverlies (motor / versnellingsbak)': -0.20 },
    'honda':      { 'Banden (profiel / leeftijd)': 0.15, 'Accu': 0.15, 'Olieverlies (motor / versnellingsbak)': -0.20 },
    'nissan':     { 'Versnellingsbak / Olielekkage': 0.25, 'Foutcodes / ECU diagnose': 0.20 },
    'mazda':      { 'Roest / Corrosie onderzijde': 0.25, 'Banden (profiel / leeftijd)': 0.15 },
    'hyundai':    { 'Distributieriem / -ketting': 0.20, 'Foutcodes / ECU diagnose': 0.15, 'Olieverlies (motor / versnellingsbak)': 0.15 },
    'kia':        { 'Distributieriem / -ketting': 0.20, 'Foutcodes / ECU diagnose': 0.15 },
    'volvo':      { 'Olieverlies (motor / versnellingsbak)': 0.20, 'Schokdempers voor': 0.20, 'Schokdempers achter': 0.20 },
    'saab':       { 'Olieverlies (motor / versnellingsbak)': 0.25, 'Foutcodes / ECU diagnose': 0.25 },
    'skoda':      { 'Distributieriem / -ketting': 0.20, 'Koppeling (slipt / versleten)': 0.20 },
    'seat':       { 'Distributieriem / -ketting': 0.20, 'Koppeling (slipt / versleten)': 0.20, 'Foutcodes / ECU diagnose': 0.20 },
    'mini':       { 'Olieverlies (motor / versnellingsbak)': 0.25, 'Distributieriem / -ketting': 0.20, 'Koppeling (slipt / versleten)': 0.20 },
    'tesla':      { 'Banden (profiel / leeftijd)': 0.30, 'Schokdempers voor': 0.20, 'Schokdempers achter': 0.20, 'Foutcodes / ECU diagnose': 0.15, 'Distributieriem / -ketting': -0.30, 'Uitlaat (roest / lek / katalysator)': -0.30, 'Versnellingsbak / Olielekkage': -0.30 },
    'porsche':    { 'Banden (profiel / leeftijd)': 0.20, 'Lakwerk / Spuitwerk (krassen, deuken)': 0.15, 'Olieverlies (motor / versnellingsbak)': 0.15 },
  };

  const BRAND_BIASES = isAuto ? BRAND_BIASES_AUTO : BRAND_BIASES_MOTOR;

  const shuffleArr = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

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
    const newItems = form.damage_items.map(d => ({ ...d, checked: false, cost: 0, hours: 0, material_cost: 0 }));

    // Merk-bias ophalen voor deze taxatie
    const brandKey = (form.brand || '').toLowerCase().trim();
    const bias = BRAND_BIASES[brandKey] || {};

    // Build randomized selection: shuffle elke tier en voeg toe op basis van kans (+ merk-bias)
    const selectionOrder = [];
    for (const tier of DAMAGE_TIERS) {
      const shuffled = shuffleArr(tier.items);
      for (const itemName of shuffled) {
        const adjustedProb = Math.max(0.05, Math.min(0.99, tier.prob + (bias[itemName] || 0)));
        if (Math.random() <= adjustedProb) {
          selectionOrder.push(itemName);
        }
      }
    }

    // Bepaal hoeveel items we willen aanvinken op basis van budget — meer is realistischer
    // Richtlijn: ~€150-€350 per item gemiddeld
    const targetItemCount = Math.max(8, Math.min(20, Math.round(neededHerstel / 220)));

    // Vul aan met willekeurige extra items uit alle tiers tot we minimaal targetItemCount items hebben
    if (selectionOrder.length < targetItemCount) {
      const allItems = DAMAGE_TIERS.flatMap(t => t.items).filter(i => !selectionOrder.includes(i));
      const extras = shuffleArr(allItems);
      for (const itemName of extras) {
        if (selectionOrder.length >= targetItemCount) break;
        selectionOrder.push(itemName);
      }
    }

    // Fallback voor minimum tier-1 items
    if (selectionOrder.length < 3) {
      for (const itemName of shuffleArr(DAMAGE_TIERS[0].items)) {
        if (!selectionOrder.includes(itemName)) selectionOrder.push(itemName);
        if (selectionOrder.length >= 5) break;
      }
    }

    // ===== BUDGET VERDELEN OVER ALLE GESELECTEERDE ITEMS =====
    // Bereken voor elk item een gewogen "share" op basis van basiskost
    // Daarna schaal alle bedragen zodat de som == neededHerstel
    const itemList = selectionOrder
      .map(itemName => {
        const idx = newItems.findIndex(d => d.name === itemName);
        if (idx === -1) return null;
        const baseCost = DAMAGE_COST_TABLE[itemName] || 200;
        // Random gewicht ±30% per item voor unieke verdeling
        const weight = baseCost * (0.7 + Math.random() * 0.6);
        return { itemName, idx, weight };
      })
      .filter(Boolean);

    if (itemList.length === 0) {
      toast.error('Geen schadeposten beschikbaar');
      return;
    }

    const totalWeight = itemList.reduce((s, it) => s + it.weight, 0);
    let allocated = 0;
    const ticked = new Set();
    itemList.forEach((it, i) => {
      let cost;
      if (i === itemList.length - 1) {
        // Laatste item: vul exact bij tot het totaal klopt
        cost = Math.round(neededHerstel - allocated);
      } else {
        cost = Math.round((it.weight / totalWeight) * neededHerstel / 5) * 5;
      }
      if (cost < 25) cost = Math.max(25, cost); // minimum realistische post
      allocated += cost;
      // Variabele labor/material split (35-50% labor)
      const laborRatio = 0.35 + Math.random() * 0.15;
      const hours = Math.max(0.5, Math.round((cost * laborRatio / LABOR_RATE) * 2) / 2);
      const laborCost = Math.round(hours * LABOR_RATE);
      const material_cost = Math.max(0, cost - laborCost);
      newItems[it.idx] = { ...newItems[it.idx], checked: true, cost, hours, material_cost };
      ticked.add(it.itemName);
    });

    setForm(f => {
      // Technische inspectie: gevarieerde scores + realistische opmerkingen
      const intensity = Math.min(1, neededHerstel / 3500);
      const inspectionItems = getInspectionItemsForUser(user);
      const inspectionUpdates = {};
      inspectionItems.forEach(it => {
        const sc = pickInspectionScore(intensity);
        inspectionUpdates[`score_${it.key}`] = sc;
        const pool = INSPECTION_NOTES[it.key]?.[sc] || [];
        if (pool.length > 0) {
          inspectionUpdates[`notes_${it.key}`] = pool[Math.floor(Math.random() * pool.length)];
        }
      });
      return { ...f, damage_items: newItems, ...inspectionUpdates };
    });
    setManualDamageAmount(null); // clear override so checklist sum is used
    setShowChecklist(true); // open the checklist so user sees the ticked items
    const brandLabel = bias && Object.keys(bias).length > 0 ? ` (${form.brand}-profiel)` : '';
    toast.success(`${ticked.size} schadeposten + technische inspectie ingevuld${brandLabel} \u2014 totaal \u20ac${Math.round(neededHerstel).toLocaleString('nl-NL')}`);
  };

  // ===== AI onderbouwing genereren =====
  const [generatingText, setGeneratingText] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiTextDraft, setAiTextDraft] = useState('');
  const generateOnderbouwing = async () => {
    setGeneratingText(true);
    try {
      const bpmCalc = calcBpmLocal(form, manualDamageAmount);
      // Stap 1: start background task — retourneert direct een task_id
      const startRes = await axios.post(`${API}/admin/bpm/generate-onderbouwing`, {
        brand: form.brand,
        model: form.model,
        year: form.bouwjaar || (form.first_registration_date || '').slice(0, 4),
        mileage: form.mileage,
        damage_items: form.damage_items,
        total_herstelkosten: bpmCalc?.herstelkosten || 0,
        bruto_bpm: bpmCalc?.bruto_bpm || 0,
        target_bpm: bpmCalc?.netto_bpm || 0,
      }, { timeout: 15000 });
      const taskId = startRes.data?.task_id;
      if (!taskId) throw new Error('Geen task_id ontvangen');

      // Stap 2: poll status elke 2.5s, max 90s totaal
      const maxAttempts = 36;
      let attempts = 0;
      let text = '';
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2500));
        attempts += 1;
        try {
          const statusRes = await axios.get(`${API}/admin/bpm/onderbouwing-status/${taskId}`, { timeout: 10000 });
          const status = statusRes.data?.status;
          if (status === 'done') {
            text = (statusRes.data?.onderbouwing || '').trim();
            break;
          }
          if (status === 'failed') {
            throw new Error(statusRes.data?.error || 'AI generatie mislukt');
          }
        } catch (pollErr) {
          // Bij netwerkglitch tijdens poll: gewoon doorgaan
          if (pollErr.response?.status === 404 || pollErr.response?.status === 403) {
            throw pollErr;
          }
        }
      }
      if (!text) throw new Error('Time-out: AI generatie duurde langer dan 90 seconden');

      const dateStr = form.report_date
        ? new Date(form.report_date).toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' });
      // Bepaal taxateur-naam + bedrijf dynamisch op basis van ingelogde user
      const buildSignature = () => {
        const fn = (user?.full_name || '').trim();
        let naam;
        if (fn) {
          const parts = fn.split(/\s+/);
          naam = parts.length >= 2 ? `${parts[0][0].toUpperCase()}. ${parts[parts.length - 1]}` : fn;
        } else if ((user?.email || '').toLowerCase() === 'motoimportbv@gmail.com') {
          naam = 'S. Milone';
        } else {
          naam = user?.username || 'taxateur';
        }
        const bedrijf = (user?.company_name || '').trim()
          || ((user?.email || '').toLowerCase() === 'motoimportbv@gmail.com' ? 'Moto Import B.V.' : '');
        return bedrijf
          ? `Vastgesteld door taxateur ${naam} namens ${bedrijf} op ${dateStr}.`
          : `Vastgesteld door taxateur ${naam} op ${dateStr}.`;
      };
      const signed = `${text}\n\n${buildSignature()}`;
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


  const isAllowed = user?.email?.toLowerCase() === 'motoimportbv@gmail.com' || user?.role === 'admin' || user?.role === 'taxateur';
  const headers = { Authorization: `Bearer ${token}` };

  const fetchTaxaties = useCallback(async () => {
    if (!isAllowed) { setLoading(false); return; }
    try { const res = await axios.get(`${API}/taxatie-programma`, { headers }); setTaxaties(res.data); }
    catch (e) { console.error(e); }
    setLoading(false);
  }, [token, isAllowed]);

  useEffect(() => { fetchTaxaties(); }, [fetchTaxaties]);

  // ===== Verzending reminders (>5 dagen na post zonder BPM-ontvangst) =====
  const [reminders, setReminders] = useState({ count: 0, items: [] });
  const fetchReminders = useCallback(async () => {
    if (!isAllowed) return;
    try {
      const res = await axios.get(`${API}/taxatie-programma-reminders`, { headers });
      setReminders(res.data || { count: 0, items: [] });
    } catch (e) { console.error('reminders', e); }
  }, [token, isAllowed]);
  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  // ===== Mark posted modal =====
  const [postModal, setPostModal] = useState(null); // { id, brand, model, taxatie_nummer }
  const [postDate, setPostDate] = useState('');
  const submitPostMark = async () => {
    if (!postModal) return;
    try {
      const body = postDate ? { posted_at: postDate } : {};
      await axios.post(`${API}/taxatie-programma/${postModal.id}/mark-posted`, body, { headers });
      toast.success('Verzending geregistreerd \u2014 reminder over 5 dagen');
      setPostModal(null);
      setPostDate('');
      fetchTaxaties();
      fetchReminders();
    } catch (e) {
      toast.error('Mislukt: ' + (e.response?.data?.detail || e.message));
    }
  };

  // ===== Mark BPM received modal =====
  const [bpmModal, setBpmModal] = useState(null);
  const [bpmMeldcode, setBpmMeldcode] = useState('');
  const [bpmAmount, setBpmAmount] = useState('');
  const [bpmReceivedDate, setBpmReceivedDate] = useState('');
  const submitBpmReceived = async () => {
    if (!bpmModal) return;
    if (!bpmMeldcode.trim()) { toast.error('Meldcode is verplicht'); return; }
    try {
      const body = {
        bpm_meldcode: bpmMeldcode.trim(),
      };
      if (bpmAmount) body.bpm_amount_received = Number(bpmAmount);
      if (bpmReceivedDate) body.received_at = bpmReceivedDate;
      await axios.post(`${API}/taxatie-programma/${bpmModal.id}/mark-bpm-received`, body, { headers });
      toast.success('BPM-ontvangst geregistreerd');
      setBpmModal(null); setBpmMeldcode(''); setBpmAmount(''); setBpmReceivedDate('');
      fetchTaxaties();
      fetchReminders();
    } catch (e) {
      toast.error('Mislukt: ' + (e.response?.data?.detail || e.message));
    }
  };

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
      setView('list'); setEditingId(null); setForm({ ...EMPTY_FORM, damage_items: userDamageItems.map(d => ({ ...d })) }); 
      setManualDamageAmount(null); setTargetBpm(''); setShowChecklist(false);
      fetchTaxaties();
    } catch (e) { toast.error(e.response?.data?.detail || 'Fout bij opslaan'); }
    setSaving(false);
  };

  const handleEdit = (t) => {
    const items = t.damage_items?.length ? t.damage_items : userDamageItems.map(d => ({ ...d }));
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

  const openFinalizeModal = (t) => {
    setFinalizeModal({ id: t.id, brand: t.brand, model: t.model });
    // Default = today in YYYY-MM-DD
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setFinalizeDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleFinalize = async (overrideDate) => {
    if (!finalizeModal) return;
    try {
      await axios.post(`${API}/taxatie-programma/${finalizeModal.id}/finalize`,
        overrideDate !== undefined ? { report_date: overrideDate } : { report_date: finalizeDate },
        { headers });
      toast.success('Taxatie definitief gemaakt');
      setFinalizeModal(null);
      fetchTaxaties();
    } catch {
      toast.error('Fout bij definitief maken');
    }
  };

  const resetForm = () => { setView('list'); setEditingId(null); setForm({ ...EMPTY_FORM, damage_items: userDamageItems.map(d => ({ ...d })) }); setManualDamageAmount(null); setTargetBpm(''); setShowChecklist(false); };

  const handleRevertToConcept = async (id) => {
    if (!window.confirm('Wilt u dit rapport terugzetten naar concept? De datum en inhoud worden weer aanpasbaar.')) return;
    try {
      await axios.post(`${API}/taxatie-programma/${id}/revert-to-concept`, {}, { headers });
      toast.success('Rapport teruggezet naar concept');
      fetchTaxaties();
    } catch {
      toast.error('Fout bij terugzetten naar concept');
    }
  };

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
              {getInspectionItemsForUser(user).map(item => (
                <div key={item.key} className="flex items-start gap-4 p-3 rounded-lg bg-zinc-50">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{item.label}</p>
                    <p className="text-xs text-zinc-500">{item.desc}</p>
                  </div>
                  <ScoreSelector value={form[`score_${item.key}`]} onChange={v => updateField(`score_${item.key}`, v)} testId={`score-${item.key}`} />
                  <input type="text" value={form[`notes_${item.key}`] || ''} onChange={e => updateField(`notes_${item.key}`, e.target.value)}
                    placeholder="Opmerking..." className="w-48 border border-zinc-300 rounded-lg px-2 py-1.5 text-xs focus:border-red-500 focus:outline-none"
                    data-testid={`notes-${item.key}`} />
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
            <p className="text-zinc-500 mt-1">Taxatieprogramma voor {cb.vehicleLabel} BPM-berekening</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => window.open('https://www.autotelex.nl', '_blank')} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50" data-testid="autotelex-list-btn">
              <ExternalLink className="w-4 h-4 mr-2" />AutoTelex
            </Button>
            <Button onClick={() => window.open('https://ovi.rdw.nl/', '_blank')} variant="outline" className="border-teal-300 text-teal-700 hover:bg-teal-50">
              <ExternalLink className="w-4 h-4 mr-2" />RDW
            </Button>
            <Button onClick={() => { setForm({ ...EMPTY_FORM, damage_items: userDamageItems.map(d => ({ ...d })) }); setEditingId(null); setView('form'); }} className="bg-red-600 hover:bg-red-700 text-white" data-testid="new-bpm-taxatie-btn">
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

        {/* Reminder banner: taxaties >5 dagen op de post zonder BPM-ontvangst */}
        {reminders.count > 0 && (
          <div className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-5" data-testid="bpm-reminder-banner">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">{'\u23F0'}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-orange-900 text-base">
                  {reminders.count} taxatie{reminders.count === 1 ? '' : 's'} {'>'}5 dagen op de post \u2014 BPM ontvangen?
                </h3>
                <p className="text-xs text-orange-800 mt-1">
                  Klik op een regel hieronder om de meldcode + ontvangstbedrag in te voeren.
                </p>
                <div className="mt-3 space-y-1.5">
                  {reminders.items.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        const t = taxaties.find(x => x.id === r.id);
                        setBpmModal({ id: r.id, brand: r.brand, model: r.model, customer_name: r.customer_name, taxatie_nummer: r.taxatie_nummer });
                        setBpmReceivedDate(new Date().toISOString().slice(0, 10));
                      }}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-orange-200 hover:border-orange-400 transition-colors"
                      data-testid={`reminder-item-${r.id}`}
                    >
                      <span className="text-xs font-mono text-zinc-500">{r.taxatie_nummer}</span>
                      <span className="text-sm font-bold flex-1">{r.brand} {r.model}</span>
                      {r.customer_name && <span className="text-xs text-zinc-600">\u2014 {r.customer_name}</span>}
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-200 text-orange-900">{r.dagen_open} dagen</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

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
                        {t.posted_at && !t.bpm_received_at && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700" title={`Op de post: ${t.posted_at}`}>
                            Verzonden {new Date(t.posted_at).toLocaleDateString('nl-NL')}
                          </span>
                        )}
                        {t.bpm_received_at && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700" title={`Meldcode: ${t.bpm_meldcode || '-'}`}>
                            BPM ontvangen {t.bpm_amount_received ? `\u2014 \u20ac${Number(t.bpm_amount_received).toLocaleString('nl-NL')}` : ''}
                          </span>
                        )}
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
                      <button
                        onClick={() => {
                          const xhr = new XMLHttpRequest();
                          xhr.open('GET', `${API}/taxatie-programma/${t.id}/bundle-pdf`, true);
                          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                          xhr.responseType = 'blob';
                          xhr.onload = () => {
                            if (xhr.status === 200) {
                              const url = URL.createObjectURL(xhr.response);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `Taxatie_Compleet_${t.brand}_${t.model}.pdf`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                              toast.success('Bundel PDF gedownload');
                            } else {
                              toast.error('Bundel PDF mislukt (status ' + xhr.status + ')');
                            }
                          };
                          xhr.onerror = () => toast.error('Netwerkfout bij bundel PDF');
                          xhr.send();
                        }}
                        className="p-2 rounded-lg hover:bg-emerald-100 text-emerald-600"
                        title="Rapport + Taxatieverslag in 1 PDF"
                        data-testid={`bundle-pdf-${t.id}`}
                      ><Download className="w-4 h-4" /></button>
                      {t.status === 'concept' && <button onClick={() => openFinalizeModal(t)} className="p-2 rounded-lg hover:bg-green-100 text-green-600" title="Definitief maken" data-testid={`finalize-${t.id}`}><FileCheck className="w-4 h-4" /></button>}
                      {t.status === 'definitief' && <button onClick={() => handleRevertToConcept(t.id)} className="p-2 rounded-lg hover:bg-amber-100 text-amber-600" title="Terug naar concept (datum aanpassen)" data-testid={`revert-${t.id}`}><RefreshCw className="w-4 h-4" /></button>}
                      {t.status === 'definitief' && !t.bpm_received_at && (
                        <button
                          onClick={() => { setPostModal({ id: t.id, brand: t.brand, model: t.model, taxatie_nummer: t.taxatie_nummer }); setPostDate(new Date().toISOString().slice(0, 10)); }}
                          className="p-2 rounded-lg hover:bg-blue-100 text-blue-600"
                          title={t.posted_at ? `Op de post: ${t.posted_at} (klik om aan te passen)` : 'Op de post gedaan'}
                          data-testid={`mark-posted-${t.id}`}
                        ><Send className="w-4 h-4" /></button>
                      )}
                      {t.posted_at && !t.bpm_received_at && (
                        <button
                          onClick={() => { setBpmModal({ id: t.id, brand: t.brand, model: t.model, customer_name: t.customer_name, taxatie_nummer: t.taxatie_nummer }); setBpmReceivedDate(new Date().toISOString().slice(0, 10)); }}
                          className="p-2 rounded-lg hover:bg-emerald-100 text-emerald-600"
                          title="BPM ontvangen"
                          data-testid={`mark-received-${t.id}`}
                        ><Inbox className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => handleDelete(t.id)} className="p-2 rounded-lg hover:bg-red-100 text-red-500" title="Verwijderen" data-testid={`delete-${t.id}`}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Finalize date modal */}
        {finalizeModal && (
          <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setFinalizeModal(null)}
            data-testid="finalize-modal"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-zinc-200 bg-gradient-to-r from-green-50 to-emerald-50">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-green-600" />
                  <h2 className="text-lg font-black text-zinc-900">Taxatie definitief maken</h2>
                </div>
                <p className="text-xs text-zinc-500 mt-1">{finalizeModal.brand} {finalizeModal.model}</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-zinc-700 mb-3">Welke datum moet op het rapport komen?</p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      const t = new Date();
                      const d = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
                      handleFinalize(d);
                    }}
                    className="w-full text-left px-4 py-3 rounded-lg border-2 border-green-300 bg-green-50 hover:bg-green-100 transition-colors"
                    data-testid="finalize-today-btn"
                  >
                    <div className="font-bold text-green-700">Vandaag</div>
                    <div className="text-xs text-zinc-600">{new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </button>
                  <div className="px-4 py-3 rounded-lg border-2 border-zinc-300 bg-white">
                    <div className="font-bold text-zinc-700 mb-2">Eigen datum kiezen</div>
                    <input
                      type="date"
                      value={finalizeDate}
                      onChange={(e) => setFinalizeDate(e.target.value)}
                      className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                      data-testid="finalize-custom-date"
                    />
                    <button
                      type="button"
                      onClick={() => handleFinalize()}
                      disabled={!finalizeDate}
                      className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg disabled:opacity-50"
                      data-testid="finalize-custom-btn"
                    >
                      Bevestig met deze datum
                    </button>
                  </div>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-zinc-200 bg-zinc-50 flex justify-end">
                <button
                  type="button"
                  onClick={() => setFinalizeModal(null)}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-zinc-300 hover:bg-zinc-100"
                  data-testid="finalize-cancel-btn"
                >
                  Annuleren
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Op de post gedaan modal */}
        {postModal && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPostModal(null)} data-testid="post-modal">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-zinc-200 bg-blue-50">
                <div className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-black text-zinc-900">Op de post gedaan</h2>
                </div>
                <p className="text-xs text-zinc-500 mt-1">{postModal.brand} {postModal.model} \u2014 {postModal.taxatie_nummer}</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">Verzenddatum</label>
                  <input
                    type="date"
                    value={postDate}
                    onChange={e => setPostDate(e.target.value)}
                    className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    data-testid="post-date-input"
                  />
                  <p className="text-xs text-zinc-500 mt-2">Na 5 dagen verschijnt deze taxatie automatisch in de reminder-banner.</p>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-zinc-200 bg-zinc-50 flex justify-end gap-2">
                <button type="button" onClick={() => setPostModal(null)} className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-zinc-300 hover:bg-zinc-100" data-testid="post-cancel-btn">Annuleren</button>
                <button type="button" onClick={submitPostMark} disabled={!postDate} className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50" data-testid="post-confirm-btn">Bevestigen</button>
              </div>
            </div>
          </div>
        )}

        {/* BPM ontvangen modal */}
        {bpmModal && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setBpmModal(null)} data-testid="bpm-received-modal">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 border-b border-zinc-200 bg-emerald-50">
                <div className="flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-black text-zinc-900">BPM ontvangen</h2>
                </div>
                <p className="text-xs text-zinc-500 mt-1">{bpmModal.brand} {bpmModal.model}{bpmModal.customer_name ? ` \u2014 ${bpmModal.customer_name}` : ''}</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">Meldcode Belastingdienst <span className="text-red-500">*</span></label>
                  <input type="text" value={bpmMeldcode} onChange={e => setBpmMeldcode(e.target.value)} placeholder="bv. BD-2026-1234" className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" data-testid="bpm-meldcode-input" autoFocus />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">Ontvangen BPM-bedrag (\u20ac)</label>
                  <input type="number" step="0.01" value={bpmAmount} onChange={e => setBpmAmount(e.target.value)} placeholder="bv. 1450.00" className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" data-testid="bpm-amount-input" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">Ontvangstdatum</label>
                  <input type="date" value={bpmReceivedDate} onChange={e => setBpmReceivedDate(e.target.value)} className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" data-testid="bpm-received-date-input" />
                </div>
              </div>
              <div className="px-5 py-3 border-t border-zinc-200 bg-zinc-50 flex justify-end gap-2">
                <button type="button" onClick={() => setBpmModal(null)} className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-zinc-300 hover:bg-zinc-100" data-testid="bpm-cancel-btn">Annuleren</button>
                <button type="button" onClick={submitBpmReceived} disabled={!bpmMeldcode.trim()} className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50" data-testid="bpm-confirm-btn">Registreren</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
