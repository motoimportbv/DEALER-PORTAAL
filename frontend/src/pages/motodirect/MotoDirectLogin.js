import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import MotoDirectLayout from './MotoDirectLayout';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MotoDirectLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/motodirect/login`, form);
      localStorage.setItem('motodirect_token', res.data.token);
      localStorage.setItem('motodirect_user', JSON.stringify(res.data.user));
      toast.success('Welkom terug!');

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
      toast.error(e2?.response?.data?.detail || 'Login mislukt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MotoDirectLayout>
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="text-xs uppercase tracking-widest text-[#0047FF] mb-2 text-center">Welkom terug</div>
        <h1 className="heading text-4xl font-bold text-white leading-tight text-center mb-10">
          Log in op MotoDirect
        </h1>
        <div className="bg-white text-black p-8" data-testid="login-form">
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-neutral-500 font-semibold mb-1.5 block">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                data-testid="input-email"
                className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-3 text-sm outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-neutral-500 font-semibold mb-1.5 block">Wachtwoord</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                data-testid="input-password"
                className="w-full border border-neutral-300 focus:border-black bg-white px-3 py-3 text-sm outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              data-testid="submit-login"
              className="w-full bg-[#0047FF] hover:bg-[#0033CC] text-white font-semibold py-4 transition-all hover:-translate-y-0.5 disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Inloggen'}
            </button>
            <div className="text-center text-sm text-neutral-600 pt-2">
              Nog geen account? <Link to="/motodirect/register" className="text-[#0047FF] font-semibold" data-testid="switch-to-register">Registreer nu</Link>
            </div>
          </form>
        </div>
      </div>
    </MotoDirectLayout>
  );
}
