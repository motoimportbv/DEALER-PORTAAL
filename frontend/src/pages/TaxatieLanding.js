import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import {
  ArrowRight, Award, CheckCircle, Clock, FileText, Image as ImageIcon,
  Loader2, Phone, ShieldCheck, Upload, X, Mail, Bike, Sparkles,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FIXED_SLOTS = [
  { key: 'foto_voorwiel', label: 'Hele voorwiel', icon: '🛞' },
  { key: 'foto_achterwiel', label: 'Hele achterwiel', icon: '🛞' },
  { key: 'foto_km_stand', label: 'Kilometerstand', icon: '📊' },
  { key: 'foto_chassisnummer', label: 'Chassisnummer', icon: '🔢' },
  { key: 'foto_motorfiets_links', label: 'Motorfiets links', icon: '🏍️' },
  { key: 'foto_motorfiets_rechts', label: 'Motorfiets rechts', icon: '🏍️' },
  { key: 'foto_inkoop_verklaring', label: 'Inkoopverklaring', icon: '📄' },
  { key: 'foto_kenteken_voor', label: 'Kentekenpapier voor', icon: '📋' },
  { key: 'foto_kenteken_achter', label: 'Kentekenpapier achter', icon: '📋' },
];

export default function TaxatieLanding() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [refNr, setRefNr] = useState('');
  const formRef = useRef(null);
  const [form, setForm] = useState({
    bedrijfsnaam: '', contactpersoon: '', email: '', telefoon: '',
    adres: '', woonplaats: '', rsin: '', opmerking: '',
  });
  const [files, setFiles] = useState({});  // {foto_voorwiel: File, ...}
  const [details, setDetails] = useState([]);  // File[]

  // Track page view (1× per browser-sessie om spam te voorkomen)
  useEffect(() => {
    const KEY = 'taxatie_view_tracked';
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, '1');
    axios.post(`${API}/public/taxatie-view`, { referrer: document.referrer || '' })
      .catch(() => { /* niet kritisch */ });
  }, []);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setFile = (k, f) => setFiles(prev => ({ ...prev, [k]: f }));
  const addDetails = (newFiles) => {
    const arr = Array.from(newFiles);
    const total = details.length + arr.length;
    if (total > 20) {
      toast.error('Maximaal 20 detailfoto\'s'); return;
    }
    setDetails(d => [...d, ...arr]);
  };

  const submit = async (e) => {
    e.preventDefault();
    // Validate
    const missing = FIXED_SLOTS.filter(s => !files[s.key]);
    if (missing.length > 0) {
      toast.error(`Foto's ontbreken: ${missing.map(m => m.label).join(', ')}`);
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      FIXED_SLOTS.forEach(s => fd.append(s.key, files[s.key]));
      details.forEach(d => fd.append('detail_fotos', d));
      const res = await axios.post(`${API}/public/taxatie-aanvraag`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setRefNr(res.data?.ref_nr || '');
      toast.success(res.data.message);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast.error('Aanvraag mislukt: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <Helmet>
        <title>Taxatieverslag motorfiets — Moto Import B.V.</title>
        <meta name="description" content="Officiële taxatieverslagen voor motorfietsen. Gespecialiseerd in BPM-aangiftes. Dealers kunnen zich gratis aanmelden." />
      </Helmet>

      {/* HERO */}
      <section className="relative bg-gradient-to-br from-zinc-950 via-red-950 to-zinc-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,0,0,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,100,0,0.2) 0%, transparent 50%)' }} />
        {/* Topbar met dealer-login */}
        <div className="relative max-w-6xl mx-auto px-6 pt-5 flex items-center justify-end gap-3 text-sm">
          <a href="/taxatie-dealer/login" className="text-red-200 hover:text-white font-bold transition-colors" data-testid="nav-dealer-login">Dealer inloggen</a>
          <span className="text-red-400/50">·</span>
          <a href="/taxatie-dealer/register" className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-3 py-1 text-white font-bold transition-colors" data-testid="nav-dealer-register">Word dealer →</a>
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-20 lg:py-32">
          <div className="inline-flex items-center gap-2 bg-red-500/20 border border-red-400/40 rounded-full px-4 py-1.5 mb-6">
            <Sparkles className="w-4 h-4 text-red-300" />
            <span className="text-sm font-bold text-red-100">100% gespecialiseerd in motorfietsen</span>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.95] mb-6" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Taxatieverslagen<br />
            <span className="text-red-400">voor motorfietsen.</span><br />
            Snel. Betrouwbaar. Belastingdienst-proof.
          </h1>
          <p className="text-lg lg:text-xl text-zinc-300 max-w-2xl mb-8 leading-relaxed">
            Moto Import is dé taxateur voor motoren in Nederland. Wij maken officiële taxatieverslagen voor uw BPM-aangiftes — sneller, voordeliger en met meer kennis van de markt dan generieke taxatiebureaus.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={scrollToForm} className="bg-red-600 hover:bg-red-700 text-white text-base font-bold px-8 py-6 rounded-xl" data-testid="hero-cta-aanmelden">
              Direct aanmelden <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button asChild variant="outline" className="border-white/30 text-white hover:bg-white/10 text-base font-bold px-8 py-6 rounded-xl">
              <a href="tel:+31624264861"><Phone className="w-5 h-5 mr-2" />06-24264861</a>
            </Button>
          </div>
        </div>
      </section>

      {/* USP'S */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Bike, title: 'Alleen motoren', desc: 'Wij doen geen auto-taxaties. 100% focus op motorfietsen — dat scheelt fouten.' },
            { icon: ShieldCheck, title: 'Belastingdienst-proof', desc: 'Onze rapporten voldoen aan alle eisen voor BPM-aangifte vermindering.' },
            { icon: Clock, title: 'Binnen 48 uur', desc: 'Doorgaans heeft u uw taxatieverslag binnen 2 werkdagen in uw inbox.' },
            { icon: Award, title: 'Ervaren team', desc: 'Honderden taxaties per jaar — we kennen de prijslijsten en koerslijsten van binnenuit.' },
          ].map((u, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-zinc-200 hover:border-red-300 hover:shadow-lg transition-all">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
                <u.icon className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="font-black text-lg text-zinc-900 mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{u.title}</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">{u.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOE HET WERKT */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-4xl sm:text-5xl font-black text-zinc-900 mb-3 text-center" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Hoe het werkt
          </h2>
          <p className="text-center text-zinc-600 mb-12 max-w-xl mx-auto">Drie stappen van aanmelding tot getekend taxatieverslag.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: '01', title: 'Meld u aan', desc: 'Vul onderaan dit formulier in: uw bedrijfsgegevens en upload 9 vaste foto\'s van de motorfiets + eventueel detailfoto\'s van schade.', icon: Upload },
              { n: '02', title: 'Wij taxeren', desc: 'Onze taxateur beoordeelt de foto\'s, checkt koerslijst + prijsmodellen en stelt het verslag op volgens Belastingdienst-richtlijnen.', icon: FileText },
              { n: '03', title: 'Verslag in uw mailbox', desc: 'Binnen 48 uur ontvangt u het ondertekende taxatieverslag (PDF) plus de BPM-berekening — direct te gebruiken voor uw aangifte.', icon: CheckCircle },
            ].map((s, i) => (
              <div key={i} className="relative">
                <div className="absolute -top-3 -left-3 text-7xl font-black text-red-50 select-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{s.n}</div>
                <div className="relative bg-white border-2 border-zinc-100 rounded-2xl p-6 hover:border-red-200 transition-colors">
                  <s.icon className="w-8 h-8 text-red-600 mb-3" />
                  <h3 className="font-black text-xl text-zinc-900 mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{s.title}</h3>
                  <p className="text-sm text-zinc-600 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AANMELDFORMULIER */}
      <section ref={formRef} className="bg-zinc-100 py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-4xl sm:text-5xl font-black text-zinc-900 mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Vraag een taxatie aan
          </h2>
          <p className="text-zinc-600 mb-8">Vul het formulier in en wij nemen binnen 24 uur contact met u op.</p>

          {submitted ? (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-8 text-center" data-testid="aanvraag-success">
              <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
              <h3 className="text-2xl font-black text-emerald-900 mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Bedankt voor uw aanvraag!</h3>
              {refNr && (
                <div className="inline-block bg-white border-2 border-emerald-400 rounded-xl px-5 py-3 mb-4" data-testid="aanvraag-ref-nr">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Uw referentienummer</p>
                  <p className="text-2xl font-black text-emerald-900 tracking-wider" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{refNr}</p>
                </div>
              )}
              <p className="text-emerald-700 mb-2">We hebben uw aanvraag goed ontvangen. U ontvangt direct een bevestigingsmail op <strong>{form.email}</strong>.</p>
              <p className="text-emerald-700 mb-6 text-sm">Onze taxateur stuurt u het taxatieverslag binnen 48 uur.</p>
              <Button onClick={() => { setSubmitted(false); setRefNr(''); setForm({ bedrijfsnaam: '', contactpersoon: '', email: '', telefoon: '', adres: '', woonplaats: '', rsin: '', opmerking: '' }); setFiles({}); setDetails([]); }} variant="outline">Nog een aanvraag</Button>
            </div>
          ) : (
          <form onSubmit={submit} className="bg-white rounded-2xl border border-zinc-200 p-6 lg:p-8 space-y-6">
            {/* Bedrijfsgegevens */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-700 mb-4 pb-2 border-b">Bedrijfsgegevens</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { k: 'bedrijfsnaam', l: 'Bedrijfsnaam *', req: true, full: true },
                  { k: 'contactpersoon', l: 'Contactpersoon' },
                  { k: 'email', l: 'E-mailadres *', type: 'email', req: true },
                  { k: 'telefoon', l: 'Telefoon' },
                  { k: 'rsin', l: 'RSIN / BSN *', req: true },
                  { k: 'adres', l: 'Adres *', req: true },
                  { k: 'woonplaats', l: 'Woonplaats *', req: true },
                ].map(f => (
                  <div key={f.k} className={f.full ? 'sm:col-span-2' : ''}>
                    <label className="text-xs font-semibold text-zinc-600 block mb-1">{f.l}</label>
                    <input
                      type={f.type || 'text'}
                      required={f.req}
                      value={form[f.k]}
                      onChange={e => setField(f.k, e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      data-testid={`aanvraag-${f.k}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Vereiste foto's */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-700 mb-1 pb-2 border-b">Vereiste foto's <span className="text-red-600">*</span></h3>
              <p className="text-xs text-zinc-500 mb-4">9 standaard foto's. Allemaal verplicht.</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {FIXED_SLOTS.map(s => (
                  <FileSlot key={s.key} slot={s} file={files[s.key]} onChange={(f) => setFile(s.key, f)} />
                ))}
              </div>
            </div>

            {/* Detail-foto's */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-700 mb-1 pb-2 border-b">Detailfoto's van schade <span className="text-zinc-400 font-normal normal-case text-xs">(optioneel — max 20)</span></h3>
              <p className="text-xs text-zinc-500 mb-3">Close-up foto's van plekjes, krassen, deuken of andere zichtbare schade. {details.length}/20 geüpload.</p>
              <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-zinc-300 rounded-lg cursor-pointer hover:border-red-400 hover:bg-red-50 transition-colors">
                <ImageIcon className="w-5 h-5 text-zinc-400" />
                <span className="text-sm font-semibold text-zinc-700">Selecteer foto's (max 20)</span>
                <input type="file" accept="image/*" multiple hidden
                  onChange={(e) => addDetails(e.target.files)}
                  disabled={details.length >= 20}
                  data-testid="aanvraag-details-upload" />
              </label>
              {details.length > 0 && (
                <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {details.map((f, i) => (
                    <div key={i} className="relative aspect-square bg-zinc-100 rounded-lg overflow-hidden">
                      <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setDetails(d => d.filter((_, j) => j !== i))} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-red-600">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Opmerking */}
            <div>
              <label className="text-xs font-semibold text-zinc-600 block mb-1">Opmerking (optioneel)</label>
              <textarea
                rows={3}
                value={form.opmerking}
                onChange={e => setField('opmerking', e.target.value)}
                placeholder="Bijzonderheden, schade, gewenste leverdatum, etc."
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                data-testid="aanvraag-opmerking"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-6 text-base flex-1 rounded-xl" data-testid="aanvraag-submit">
                {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <ArrowRight className="w-5 h-5 mr-2" />}
                Aanvraag versturen
              </Button>
            </div>
            <p className="text-xs text-zinc-500">Door te versturen gaat u akkoord met onze {' '}<a href="/algemene-voorwaarden" className="text-red-600 underline">algemene voorwaarden</a>. Uw foto's worden uitsluitend gebruikt voor de taxatie.</p>
          </form>
          )}
        </div>
      </section>

      {/* CONTACT FOOTER */}
      <section className="bg-zinc-900 text-white py-12">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h3 className="text-3xl font-black mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Vragen? Bel of mail ons.</h3>
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <a href="tel:+31624264861" className="inline-flex items-center gap-2 px-5 py-3 bg-red-600 rounded-xl font-bold hover:bg-red-700"><Phone className="w-4 h-4" />06-24264861</a>
            <a href="mailto:motoimportbv@gmail.com" className="inline-flex items-center gap-2 px-5 py-3 bg-white/10 rounded-xl font-bold hover:bg-white/20"><Mail className="w-4 h-4" />motoimportbv@gmail.com</a>
          </div>
        </div>
      </section>
    </div>
  );
}

function FileSlot({ slot, file, onChange }) {
  return (
    <label className={`relative flex flex-col items-center gap-1 px-3 py-3 border-2 rounded-lg cursor-pointer transition-colors text-center ${file ? 'border-emerald-400 bg-emerald-50' : 'border-zinc-300 hover:border-red-400 hover:bg-red-50'}`} data-testid={`slot-${slot.key}`}>
      <div className="text-xl">{slot.icon}</div>
      <span className="text-xs font-semibold text-zinc-700 leading-tight">{slot.label}</span>
      {file ? (
        <span className="text-[10px] text-emerald-700 font-bold truncate max-w-full">✓ {file.name.slice(0, 22)}{file.name.length > 22 ? '…' : ''}</span>
      ) : (
        <span className="text-[10px] text-zinc-400">Tik om te uploaden</span>
      )}
      <input type="file" accept="image/*" hidden onChange={e => onChange(e.target.files?.[0] || null)} />
    </label>
  );
}
