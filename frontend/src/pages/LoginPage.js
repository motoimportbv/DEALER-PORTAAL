import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Bike, Mail, Lock, ArrowRight, FileText, Globe } from 'lucide-react';
import { toast } from 'sonner';
import LanguageSelector from '../components/LanguageSelector';

const LoginPage = () => {
  const { t } = useTranslation();
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
      toast.success(t('messages.successSaved'));
      
      // Determine redirect based on user type
      let redirectPath = '/dealer';
      if (user.role === 'admin') {
        redirectPath = '/admin';
      } else if (user.is_foreign_dealer) {
        redirectPath = '/foreign-dealer';
      }
      
      navigate(redirectPath);
    } catch (error) {
      const errorMessage = error.response?.data?.detail || t('messages.errorOccurred');
      
      // Check if it's a pending approval error
      if (error.response?.status === 403 && errorMessage.includes('goedkeuring')) {
        toast.info(errorMessage, { duration: 5000 });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div 
        className="auth-hero hidden md:flex"
        style={{
          backgroundImage: 'url(https://customer-assets.emergentagent.com/job_dealer-moto-portal/artifacts/338sojwi_Screenshot_20260124_144156_ChatGPT.jpg)'
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
            <p>Motoimportbv@gmail.com</p>
          </div>
        </div>
      </div>
      
      <div className="auth-form-container">
        {/* Language Selector in top right */}
        <div className="absolute top-4 right-4">
          <LanguageSelector />
        </div>

        <div className="mb-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
              <Bike className="w-7 h-7 text-white" />
            </div>
            <span className="font-barlow text-2xl font-bold uppercase tracking-tight">Moto Import</span>
          </div>
          <h2 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
            {t('auth.loginTitle')}
          </h2>
          <p className="text-zinc-500 mt-2">{t('auth.registerSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
              {t('auth.email')}
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="pl-11 h-12"
                data-testid="login-email-input"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
                {t('auth.password')}
              </Label>
              <Link to="/forgot-password" className="text-xs text-red-600 hover:text-red-700 font-medium" data-testid="forgot-password-link">
                {t('auth.forgotPassword')}
              </Link>
            </div>
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
            {loading ? t('common.loading') : t('common.login')}
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </form>

        <p className="mt-8 text-center text-zinc-500">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-red-600 hover:text-red-700 font-semibold" data-testid="register-link">
            {t('common.register')}
          </Link>
        </p>

        {/* Handleidingen sectie */}
        <div className="mt-8 pt-6 border-t border-zinc-200">
          <p className="text-center text-sm font-semibold text-zinc-600 mb-4">
            {t('guides.title')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <a 
              href="/guides/dealer-handleiding-nl.pdf" 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-red-50 hover:bg-red-100 rounded-lg text-red-700 transition-colors"
              data-testid="dealer-guide-link"
            >
              <FileText className="w-5 h-5" />
              <span className="text-sm font-medium">{t('guides.dealerGuide')}</span>
            </a>
            <a 
              href="/guides/leverancier-handleiding-nl.pdf" 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg text-purple-700 transition-colors"
              data-testid="supplier-guide-link"
            >
              <Globe className="w-5 h-5" />
              <span className="text-sm font-medium">{t('guides.supplierGuide')}</span>
            </a>
          </div>
          <div className="mt-3 flex justify-center gap-4 text-xs text-zinc-500">
            <Link to="/dealer-guide" className="hover:text-red-600">{t('guides.viewOnline')}</Link>
            <span>|</span>
            <Link to="/supplier-guide" className="hover:text-purple-600">{t('guides.supplierOnline')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
