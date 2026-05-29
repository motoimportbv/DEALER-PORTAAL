import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Mail, ArrowRight, CheckCircle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function TaxatieDealerForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/public/taxatie-dealer-forgot-password`, { email });
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Er ging iets mis');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4" data-testid="dealer-forgot-page">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-black tracking-tight text-zinc-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            MOTO IMPORT B.V.
          </Link>
          <p className="text-xs font-bold uppercase text-red-600 tracking-wider mt-2">Wachtwoord vergeten</p>
        </div>

        {sent ? (
          <div className="bg-white rounded-2xl border p-8 text-center" data-testid="forgot-sent-block">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-emerald-600" />
            </div>
            <h1 className="text-xl font-black text-zinc-900 mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Check uw e-mail</h1>
            <p className="text-sm text-zinc-600 mb-6">
              Als <strong>{email}</strong> bij ons bekend is, ontvangt u binnen enkele minuten een link om uw wachtwoord te resetten.
            </p>
            <p className="text-xs text-zinc-400 mb-5">De link is 60 minuten geldig.</p>
            <Link to="/taxatie-dealer/login" className="text-sm font-bold text-red-600 hover:underline">← Terug naar inloggen</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white rounded-2xl border p-8 space-y-5 shadow-sm" data-testid="forgot-form">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-zinc-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Wachtwoord vergeten?</h1>
                <p className="text-xs text-zinc-500">We sturen u een reset-link per e-mail</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">E-mailadres</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                data-testid="forgot-email"
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2"
              data-testid="forgot-submit"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verstuur reset-link<ArrowRight className="w-4 h-4" /></>}
            </button>

            <p className="text-center text-sm text-zinc-600 pt-2">
              <Link to="/taxatie-dealer/login" className="text-red-600 font-bold hover:underline">← Terug naar inloggen</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
