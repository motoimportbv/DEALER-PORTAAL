import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Bike, Lock, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Geen geldige reset link. Vraag een nieuwe aan.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Wachtwoorden komen niet overeen');
      return;
    }

    if (password.length < 6) {
      toast.error('Wachtwoord moet minimaal 6 tekens zijn');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/api/auth/reset-password`, {
        token,
        new_password: password
      });
      
      // Clear any old login data to force fresh login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      setSuccess(true);
      toast.success('Wachtwoord succesvol gewijzigd!');
    } catch (error) {
      const message = error.response?.data?.detail || 'Er ging iets mis. Probeer het later opnieuw.';
      toast.error(message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (error && !token) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="font-barlow text-2xl font-bold uppercase tracking-tight text-zinc-900 mb-4">
            Ongeldige Link
          </h2>
          <p className="text-zinc-600 mb-6">{error}</p>
          <Link to="/forgot-password">
            <Button className="w-full bg-red-600 hover:bg-red-700">
              Nieuwe Reset Link Aanvragen
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="font-barlow text-2xl font-bold uppercase tracking-tight text-zinc-900 mb-4">
            Wachtwoord Gewijzigd!
          </h2>
          <p className="text-zinc-600 mb-6">
            Uw wachtwoord is succesvol gewijzigd. U kunt nu inloggen met uw nieuwe wachtwoord.
          </p>
          <Link to="/login">
            <Button className="w-full bg-red-600 hover:bg-red-700">
              Naar Inloggen
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
              <Bike className="w-7 h-7 text-white" />
            </div>
            <span className="font-barlow text-2xl font-bold uppercase tracking-tight">Moto Import</span>
          </div>
          <h2 className="font-barlow text-2xl font-bold uppercase tracking-tight text-zinc-900">
            Nieuw Wachtwoord
          </h2>
          <p className="text-zinc-500 mt-2">
            Voer uw nieuwe wachtwoord in
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="password" className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
              Nieuw Wachtwoord
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
                data-testid="reset-password-input"
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
              Bevestig Wachtwoord
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Herhaal wachtwoord"
                className="pl-11 h-12"
                data-testid="reset-confirm-input"
                required
              />
            </div>
          </div>

          {password && confirmPassword && password !== confirmPassword && (
            <p className="text-sm text-red-600">Wachtwoorden komen niet overeen</p>
          )}

          <Button 
            type="submit" 
            className="w-full h-12 bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide font-semibold"
            disabled={loading || password !== confirmPassword}
            data-testid="reset-submit-btn"
          >
            {loading ? 'Bezig...' : 'Wachtwoord Wijzigen'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-zinc-500 hover:text-zinc-700 text-sm inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Terug naar Inloggen
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
