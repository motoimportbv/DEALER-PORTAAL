import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, ArrowRight, Lock } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function formatErr(d) {
  if (!d) return 'Inloggen mislukt';
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map(e => e?.msg || JSON.stringify(e)).join(' ');
  return String(d);
}

export default function TaxatieDealerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/login`, { email, password });
      if (data.user?.role !== 'taxatie_dealer') {
        toast.error('Dit is een dealer-login. Gebruik je dealer-account.');
        setLoading(false);
        return;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast.success(`Welkom terug, ${data.user.company_name || data.user.email}`);
      window.location.href = '/taxatie-dealer/dashboard';
    } catch (err) {
      toast.error(formatErr(err.response?.data?.detail) || err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4" data-testid="dealer-login-page">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-black tracking-tight text-zinc-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            MOTO IMPORT B.V.
          </Link>
          <p className="text-xs font-bold uppercase text-red-600 tracking-wider mt-2">Dealer Login</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl border p-8 space-y-5 shadow-sm" data-testid="dealer-login-form">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-zinc-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Inloggen</h1>
              <p className="text-xs text-zinc-500">Toegang tot uw taxatie-dashboard</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">E-mailadres</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              data-testid="login-email"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-zinc-700">Wachtwoord</label>
              <Link to="/taxatie-dealer/forgot" className="text-xs text-red-600 font-bold hover:underline" data-testid="forgot-link">Vergeten?</Link>
            </div>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              data-testid="login-password"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2"
            data-testid="login-submit"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Inloggen<ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-600 mt-4">
          Nog geen account? <Link to="/taxatie-dealer/register" className="text-red-600 font-bold hover:underline">Registreren</Link>
        </p>
      </div>
    </div>
  );
}
