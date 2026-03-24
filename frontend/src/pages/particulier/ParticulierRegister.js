import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Bike, ArrowRight, User, Mail, Lock, Phone, MapPin } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ParticulierRegister() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', city: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password) {
      setError('Vul alle verplichte velden in');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/private-listings/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Registratie mislukt');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/particulier');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const fields = [
    { name: 'name', label: 'Naam *', type: 'text', icon: User, placeholder: 'Uw volledige naam' },
    { name: 'email', label: 'E-mail *', type: 'email', icon: Mail, placeholder: 'email@voorbeeld.nl' },
    { name: 'password', label: 'Wachtwoord *', type: 'password', icon: Lock, placeholder: 'Minimaal 6 tekens' },
    { name: 'phone', label: 'Telefoonnummer', type: 'tel', icon: Phone, placeholder: '06-12345678' },
    { name: 'city', label: 'Woonplaats', type: 'text', icon: MapPin, placeholder: 'Amsterdam' },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-red-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Bike className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Motor verkopen?</h1>
          <p className="text-zinc-400 text-sm">Bied uw motor aan bij 100+ dealers voor slechts &euro;4,95 per week</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-zinc-900/80 border border-zinc-800/60 rounded-2xl p-6 space-y-4" data-testid="particulier-register-form">
          {fields.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.name}>
                <label className="block text-sm font-medium text-zinc-400 mb-1">{f.label}</label>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    data-testid={`register-${f.name}`}
                    type={f.type}
                    value={form[f.name]}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    placeholder={f.placeholder}
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50"
                  />
                </div>
              </div>
            );
          })}

          {error && <p className="text-red-400 text-sm" data-testid="register-error">{error}</p>}

          <Button
            type="submit"
            disabled={loading}
            data-testid="register-submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-medium"
          >
            {loading ? 'Even geduld...' : 'Account aanmaken'} <ArrowRight className="ml-2 w-4 h-4" />
          </Button>

          <p className="text-center text-sm text-zinc-500">
            Al een account? <Link to="/login" className="text-red-400 hover:text-red-300">Inloggen</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
