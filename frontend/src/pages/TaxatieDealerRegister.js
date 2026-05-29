import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, ArrowRight, ShieldCheck, FileText, Eye } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function formatErr(detail) {
  if (!detail) return 'Er ging iets mis. Probeer opnieuw.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(e => e?.msg || JSON.stringify(e)).join(' ');
  return String(detail);
}

export default function TaxatieDealerRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    bedrijfsnaam: '', contactpersoon: '', email: '', password: '', password2: '',
    telefoon: '', kvk: '', rsin: '',
    adres: '', postcode: '', woonplaats: '',
    art8_vergunning: false, art8_nummer: '',
  });
  const [loading, setLoading] = useState(false);

  // Track view (zelfde anti-spam pattern als /taxatie)
  useEffect(() => {
    const KEY = 'dealer_register_view';
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, '1');
    axios.post(`${API}/public/taxatie-view`, { referrer: 'dealer-register' }).catch(() => {});
  }, []);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.password2) {
      toast.error('Wachtwoorden komen niet overeen');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Wachtwoord moet minstens 8 tekens zijn');
      return;
    }
    if (!form.kvk && !form.rsin) {
      toast.error('Vul minimaal KVK of RSIN in');
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/public/taxatie-dealer-register`, form);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast.success(`Welkom, ${data.user.company_name}! Uw account is direct actief.`);
      window.location.href = '/taxatie-dealer/dashboard';
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail) || err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50" data-testid="dealer-register-page">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="text-xl font-black tracking-tight text-zinc-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            MOTO IMPORT B.V.
          </Link>
          <Link to="/taxatie-dealer/login" className="text-sm text-zinc-600 hover:text-red-600 font-bold">
            Al een account? Inloggen →
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* USP side */}
          <aside className="md:col-span-1 space-y-6">
            <div>
              <p className="text-xs font-bold uppercase text-red-600 tracking-wider mb-2">Voor motorzaken</p>
              <h1 className="text-3xl font-black leading-tight text-zinc-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                Word taxatie-dealer.
              </h1>
              <p className="text-sm text-zinc-600 mt-3">
                Eigen dashboard, alle aanvragen op één plek, statussen real-time. Direct actief na registratie.
              </p>
            </div>
            <div className="space-y-4">
              <Usp icon={ShieldCheck} title="Direct toegang" desc="Geen goedkeuring nodig — meteen aan de slag" />
              <Usp icon={FileText} title="€60 introductietarief" desc="Eerste taxatieverslag voor introductietarief" />
              <Usp icon={Eye} title="Status in real-time" desc="Volg uw aanvragen vanuit één dashboard" />
            </div>
          </aside>

          {/* Form */}
          <form onSubmit={submit} className="md:col-span-2 bg-white rounded-2xl border p-6 sm:p-8 space-y-5" data-testid="dealer-register-form">
            <h2 className="text-xl font-black text-zinc-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Account aanmaken</h2>

            <Section title="Bedrijfsgegevens">
              <Field label="Bedrijfsnaam *" value={form.bedrijfsnaam} onChange={(v) => setF('bedrijfsnaam', v)} testid="bedrijfsnaam" />
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="KVK-nummer" value={form.kvk} onChange={(v) => setF('kvk', v)} testid="kvk" />
                <Field label="RSIN / BSN" value={form.rsin} onChange={(v) => setF('rsin', v)} testid="rsin" />
              </div>
              <p className="text-xs text-zinc-500 -mt-1">Vul minimaal één van bovenstaande in.</p>
            </Section>

            <Section title="Contactpersoon">
              <Field label="Naam contactpersoon" value={form.contactpersoon} onChange={(v) => setF('contactpersoon', v)} testid="contactpersoon" />
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Telefoonnummer *" value={form.telefoon} onChange={(v) => setF('telefoon', v)} testid="telefoon" />
                <Field label="E-mailadres *" type="email" value={form.email} onChange={(v) => setF('email', v)} testid="email" />
              </div>
            </Section>

            <Section title="Adres">
              <Field label="Adres + huisnummer" value={form.adres} onChange={(v) => setF('adres', v)} testid="adres" />
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Postcode" value={form.postcode} onChange={(v) => setF('postcode', v)} testid="postcode" />
                <Field label="Woonplaats" value={form.woonplaats} onChange={(v) => setF('woonplaats', v)} testid="woonplaats" />
              </div>
            </Section>

            <Section title="Artikel 8-vergunning (optioneel)">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.art8_vergunning}
                  onChange={(e) => setF('art8_vergunning', e.target.checked)}
                  className="w-4 h-4 accent-red-600"
                  data-testid="art8-toggle"
                />
                <span className="font-semibold">Ik heb een artikel 8-vergunning</span>
              </label>
              {form.art8_vergunning && (
                <Field label="Art.8 vergunning-nummer" value={form.art8_nummer} onChange={(v) => setF('art8_nummer', v)} testid="art8-nummer" placeholder="bv. 810691103BPM01" />
              )}
            </Section>

            <Section title="Wachtwoord">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Wachtwoord *" type="password" value={form.password} onChange={(v) => setF('password', v)} testid="password" />
                <Field label="Herhaal wachtwoord *" type="password" value={form.password2} onChange={(v) => setF('password2', v)} testid="password2" />
              </div>
              <p className="text-xs text-zinc-500 -mt-1">Minimaal 8 tekens.</p>
            </Section>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              data-testid="submit-register-btn"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Account aanmaken<ArrowRight className="w-4 h-4" /></>}
            </button>
            <p className="text-xs text-zinc-500 text-center">
              Door te registreren ga je akkoord met onze voorwaarden voor taxatieverslagen.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-3 border-t first:border-t-0 pt-5 first:pt-0">
      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, testid }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
        data-testid={`field-${testid}`}
        required={label.includes('*')}
      />
    </div>
  );
}

function Usp({ icon: Icon, title, desc }) {
  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="font-bold text-sm text-zinc-900">{title}</p>
        <p className="text-xs text-zinc-600 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
