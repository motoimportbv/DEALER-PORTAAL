import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Bike, Mail, Lock, Building, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('dealer');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Wachtwoord moet minimaal 6 tekens bevatten');
      return;
    }
    setLoading(true);
    try {
      const user = await register(email, password, companyName, role);
      toast.success('Account succesvol aangemaakt!');
      navigate(user.role === 'admin' ? '/admin' : '/dealer');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registratie mislukt');
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
            Moto Dealer Portal
          </h1>
          <p className="text-lg text-zinc-300 max-w-md">
            Word onderdeel van ons exclusieve dealer netwerk en krijg toegang tot premium motorfietsen.
          </p>
        </div>
      </div>
      
      <div className="auth-form-container">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
              <Bike className="w-7 h-7 text-white" />
            </div>
            <span className="font-barlow text-2xl font-bold uppercase tracking-tight">MotoDealer</span>
          </div>
          <h2 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
            Account aanmaken
          </h2>
          <p className="text-zinc-500 mt-2">Maak een account aan om te beginnen</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="company" className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
              Bedrijfsnaam
            </Label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <Input
                id="company"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Uw bedrijfsnaam"
                className="pl-11 h-12"
                data-testid="register-company-input"
                required
              />
            </div>
          </div>

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
                data-testid="register-email-input"
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
                placeholder="Minimaal 6 tekens"
                className="pl-11 h-12"
                data-testid="register-password-input"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
              Account type
            </Label>
            <Select value={role} onValueChange={setRole} data-testid="register-role-select">
              <SelectTrigger className="h-12" data-testid="register-role-trigger">
                <SelectValue placeholder="Selecteer type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dealer" data-testid="role-dealer">Dealer</SelectItem>
                <SelectItem value="admin" data-testid="role-admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide font-semibold"
            disabled={loading}
            data-testid="register-submit-btn"
          >
            {loading ? 'Bezig...' : 'Registreren'}
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </form>

        <p className="mt-8 text-center text-zinc-500">
          Heeft u al een account?{' '}
          <Link to="/login" className="text-red-600 hover:text-red-700 font-semibold" data-testid="login-link">
            Inloggen
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
