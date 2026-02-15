import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Bike, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/api/auth/forgot-password`, { email });
      setSent(true);
      toast.success('E-mail verstuurd!');
    } catch (error) {
      toast.error('Er ging iets mis. Probeer het later opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="font-barlow text-2xl font-bold uppercase tracking-tight text-zinc-900 mb-4">
            E-mail Verstuurd!
          </h2>
          <p className="text-zinc-600 mb-6">
            Als het e-mailadres <strong>{email}</strong> bij ons bekend is, ontvangt u binnen enkele minuten een e-mail met instructies om uw wachtwoord te resetten.
          </p>
          <p className="text-sm text-zinc-500 mb-6">
            Controleer ook uw spam/ongewenste mail folder.
          </p>
          <Link to="/login">
            <Button className="w-full bg-red-600 hover:bg-red-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Terug naar Inloggen
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
            Wachtwoord Vergeten?
          </h2>
          <p className="text-zinc-500 mt-2">
            Geen probleem! Voer uw e-mailadres in en we sturen u een link om uw wachtwoord te resetten.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
              E-mailadres
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
                data-testid="forgot-email-input"
                required
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide font-semibold"
            disabled={loading}
            data-testid="forgot-submit-btn"
          >
            {loading ? 'Bezig met versturen...' : 'Verstuur Reset Link'}
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

export default ForgotPasswordPage;
