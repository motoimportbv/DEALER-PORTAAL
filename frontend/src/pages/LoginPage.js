import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Bike, Mail, Lock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success('Succesvol ingelogd!');
      navigate(user.role === 'admin' ? '/admin' : '/dealer');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Inloggen mislukt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div 
        className="auth-hero hidden md:flex"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1579509554181-545d7cee73fb?crop=entropy&cs=srgb&fm=jpg&q=85)'
        }}
      >
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <h1 className="font-barlow text-5xl font-bold uppercase tracking-tight mb-4">
            Moto Import Portal
          </h1>
          <p className="text-lg text-zinc-300 max-w-md mb-8">
            Exclusieve motorfietsen voor uw dealer netwerk. Bekijk, bestel en beheer uw voorraad.
          </p>
          <div className="text-sm text-zinc-400 space-y-1">
            <p className="font-semibold text-zinc-300">Moto Import B.V.</p>
            <p>Horsterhoekweg 11</p>
            <p>7433 SV Schalkhaar</p>
            <p>Tel: +31 6 81792660</p>
          </div>
        </div>
      </div>
      
      <div className="auth-form-container">
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
              <Bike className="w-7 h-7 text-white" />
            </div>
            <span className="font-barlow text-2xl font-bold uppercase tracking-tight">Moto Import</span>
          </div>
          <h2 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
            Welkom terug
          </h2>
          <p className="text-zinc-500 mt-2">Log in om toegang te krijgen tot uw account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="uw@email.nl"
                className="pl-11 h-12"
                data-testid="login-email-input"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
              Wachtwoord
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-11 h-12"
                data-testid="login-password-input"
                required
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide font-semibold"
            disabled={loading}
            data-testid="login-submit-btn"
          >
            {loading ? 'Bezig...' : 'Inloggen'}
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </form>

        <p className="mt-8 text-center text-zinc-500">
          Nog geen account?{' '}
          <Link to="/register" className="text-red-600 hover:text-red-700 font-semibold" data-testid="register-link">
            Registreren
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
