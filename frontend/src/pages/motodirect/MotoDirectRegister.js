import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import MotoDirectLayout from './MotoDirectLayout';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MotoDirectRegister() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    postal_code: '',
    city: '',
    bsn: '',
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/motodirect/register`, form);
      localStorage.setItem('motodirect_token', res.data.token);
      localStorage.setItem('motodirect_user', JSON.stringify(res.data.user));
      toast.success('Account aangemaakt!');

      // Check pending intent (from motor detail "Reserveer nu")
      const intentRaw = localStorage.getItem('motodirect_intent');
      if (intentRaw) {
        const intent = JSON.parse(intentRaw);
        localStorage.removeItem('motodirect_intent');
        if (intent.action === 'reserve' && intent.motorcycle_id) {
          navigate(`/motodirect/motor/${intent.motorcycle_id}`);
          return;
        }
      }
      navigate('/motodirect/account');
    } catch (e2) {
      toast.error(e2?.response?.data?.detail || 'Registratie mislukt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MotoDirectLayout>
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-12 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-16 items-start">
        {/* Left: pitch */}
        <div className="hidden lg:block sticky top-24">
          <div className="text-xs uppercase tracking-widest text-[#0047FF] mb-4">Account aanmaken</div>
          <h1 className="heading text-5xl font-bold text-white leading-tight mb-6">
            Krijg toegang tot<br />
            <span className="text-[#0047FF]">dealerprijzen.</span>
          </h1>
          <p className="text-neutral-400 text-lg leading-relaxed mb-8">
            Maak in 2 minuten een account aan. Je NAW-gegevens en BSN gebruiken wij uitsluitend voor RDW-registratie na aankoop.
          </p>
          <div className="border border-[#1c1c1c] p-6 flex gap-4">
            <Shield className="w-6 h-6 text-[#00FF66] flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <div className="text-white font-semibold text-sm mb-1">GDPR-veilig opgeslagen</div>
              <div className="text-neutral-400 text-xs leading-relaxed">Jouw gegevens worden versleuteld bewaard en uitsluitend gebruikt voor jouw aankoop en registratie bij de RDW.</div>
            </div>
          </div>
        </div>

        {/* Right: form */}
        <div className="bg-white text-black p-8 lg:p-10" data-testid="register-form">
          <div className="lg:hidden mb-6">
            <h1 className="heading text-3xl font-bold leading-tight">Account aanmaken</h1>
            <p className="text-neutral-600 text-sm mt-2">Krijg toegang tot dealerprijzen.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Volledige naam *" value={form.name} onChange={set('name')} testId="input-name" required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Email *" type="email" value={form.email} onChange={set('email')} testId="input-email" required />
              <Field label="Wachtwoord *" type="password" value={form.password} onChange={set('password')} testId="input-password" required minLength={6} />
            </div>
            <Field label="Telefoonnummer *" value={form.phone} onChange={set('phone')} testId="input-phone" required />
            <Field label="Adres (straat + huisnummer) *" value={form.address} onChange={set('address')} testId="input-address" required />
            <div className="grid grid-cols-[1fr_2fr] gap-4">
              <Field label="Postcode *" value={form.postal_code} onChange={set('postal_code')} testId="input-postal-code" required />
              <Field label="Woonplaats *" value={form.city} onChange={set('city')} testId="input-city" required />
            </div>
            <Field label="BSN * (voor RDW-registratie)" value={form.bsn} onChange={set('bsn')} testId="input-bsn" required maxLength={9} />

            <div className="text-xs text-neutral-500 leading-relaxed">
              Door te registreren ga je akkoord met onze voorwaarden en privacybeleid. Jouw BSN wordt uitsluitend gebruikt voor de kentekenregistratie bij de RDW na aankoop.
            </div>

            <button
              type="submit"
              disabled={loading}
              data-testid="submit-register"
              className="w-full bg-[#0047FF] hover:bg-[#0033CC] text-white font-semibold py-4 transition-all hover:-translate-y-0.5 disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Account aanmaken'}
            </button>

            <div className="text-center text-sm text-neutral-600 pt-2">
              Al een account? <Link to="/motodirect/login" className="text-[#0047FF] font-semibold" data-testid="switch-to-login">Log in</Link>
            </div>
          </form>
        </div>
      </div>
    </MotoDirectLayout>
  );
}

function Field({ label, testId, ...props }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-neutral-500 font-semibold mb-1.5 block">{label}</span>
      <input
        {...props}
        data-testid={testId}
        className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-3 text-sm outline-none"
      />
    </label>
  );
}
