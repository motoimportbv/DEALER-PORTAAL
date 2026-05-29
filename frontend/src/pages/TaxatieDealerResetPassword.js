import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, KeyRound, ArrowRight } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function TaxatieDealerResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== password2) {
      toast.error('Wachtwoorden komen niet overeen');
      return;
    }
    if (password.length < 8) {
      toast.error('Wachtwoord moet minstens 8 tekens zijn');
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/public/taxatie-dealer-reset-password`, { token, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast.success('Wachtwoord gewijzigd. Welkom terug!');
      navigate('/taxatie-dealer/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Reset mislukt');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4" data-testid="dealer-reset-page">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-black tracking-tight text-zinc-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            MOTO IMPORT B.V.
          </Link>
          <p className="text-xs font-bold uppercase text-red-600 tracking-wider mt-2">Nieuw wachtwoord instellen</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl border p-8 space-y-5 shadow-sm" data-testid="reset-form">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-zinc-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Kies een nieuw wachtwoord</h1>
              <p className="text-xs text-zinc-500">Minimaal 8 tekens</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">Nieuw wachtwoord</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              data-testid="reset-password"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">Herhaal wachtwoord</label>
            <input
              type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required
              className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              data-testid="reset-password2"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2"
            data-testid="reset-submit"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Wachtwoord opslaan<ArrowRight className="w-4 h-4" /></>}
          </button>

          <p className="text-center text-sm text-zinc-600 pt-2">
            <Link to="/taxatie-dealer/login" className="text-red-600 font-bold hover:underline">← Terug naar inloggen</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
