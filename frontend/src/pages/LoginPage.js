import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Bike, Mail, Lock, ArrowRight, FileText, Globe, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import LanguageSelector from '../components/LanguageSelector';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Simple encoding for stored credentials (not secure encryption, but obfuscates plain text)
const encodeCredentials = (email, password) => {
  return btoa(JSON.stringify({ e: email, p: password }));
};

const decodeCredentials = (encoded) => {
  try {
    const decoded = JSON.parse(atob(encoded));
    return { email: decoded.e, password: decoded.p };
  } catch {
    return null;
  }
};

// Storage helpers - use both cookie AND localStorage for maximum compatibility
const setRememberCredentials = (value) => {
  // Set cookie with proper settings for cross-context sharing
  const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
  // Try with Secure flag for HTTPS sites
  document.cookie = `moto_remember=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=None; Secure`;
  // Also set without Secure as fallback
  document.cookie = `moto_remember_backup=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  
  // Also store in localStorage as additional fallback
  try {
    localStorage.setItem('moto_remember', value);
  } catch (e) {
    console.log('Could not store in localStorage');
  }
};

const getRememberCredentials = () => {
  // Try cookie first
  const cookies = `; ${document.cookie}`;
  
  // Try main cookie
  let parts = cookies.split(`; moto_remember=`);
  if (parts.length === 2) {
    const value = decodeURIComponent(parts.pop().split(';').shift());
    if (value) return value;
  }
  
  // Try backup cookie
  parts = cookies.split(`; moto_remember_backup=`);
  if (parts.length === 2) {
    const value = decodeURIComponent(parts.pop().split(';').shift());
    if (value) return value;
  }
  
  // Try localStorage as fallback
  try {
    const localValue = localStorage.getItem('moto_remember');
    if (localValue) return localValue;
  } catch (e) {
    console.log('Could not read from localStorage');
  }
  
  return null;
};

const deleteRememberCredentials = () => {
  // Clear all storage locations
  document.cookie = `moto_remember=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  document.cookie = `moto_remember_backup=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  try {
    localStorage.removeItem('moto_remember');
  } catch (e) {
    // Ignore
  }
};

const LoginPage = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true); // Default AAN voor betere UX
  const [loading, setLoading] = useState(false);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  const [shortCodeLoading, setShortCodeLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const autoLoginRef = useRef(false);
  const shortCodeRef = useRef(false);

  // Check for redirect URL from notification click or other source
  const [redirectAfterLogin, setRedirectAfterLogin] = useState(null);

  // Handle short code auto-login (from ?code= parameter)
  useEffect(() => {
    if (shortCodeRef.current) return;
    
    const params = new URLSearchParams(location.search);
    const shortCode = params.get('code');
    
    if (shortCode && shortCode.length >= 6) {
      shortCodeRef.current = true;
      setShortCodeLoading(true);
      
      console.log('[Login] Short code detected:', shortCode);
      
      // Perform short code login
      const performShortCodeLogin = async () => {
        try {
          // Verify and login with short code
          const response = await axios.post(`${API}/auth/shortcode-login`, { code: shortCode });
          
          if (response.data.token && response.data.user) {
            console.log('[Login] Short code login successful');
            
            // Clear old auth data
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            // Store new credentials
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            
            // Set cookies for PWA compatibility
            const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
            document.cookie = `moto_token=${encodeURIComponent(response.data.token)}; expires=${expires}; path=/; SameSite=Lax`;
            document.cookie = `moto_user=${encodeURIComponent(JSON.stringify(response.data.user))}; expires=${expires}; path=/; SameSite=Lax`;
            
            // Set axios header
            axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
            
            // Determine redirect
            const role = response.data.user.role;
            const isForeignDealer = response.data.user.is_foreign_dealer;
            let redirectUrl = '/dealer';
            
            if (role === 'admin') {
              redirectUrl = '/admin';
            } else if (isForeignDealer) {
              redirectUrl = '/foreign-dealer';
            }
            
            // Force full reload to ensure fresh state
            window.location.replace(redirectUrl);
          }
        } catch (err) {
          console.error('[Login] Short code login failed:', err);
          toast.error('Automatisch inloggen mislukt. Gebruik uw email en wachtwoord.');
          setShortCodeLoading(false);
          
          // Remove code from URL
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }
      };
      
      performShortCodeLogin();
    }
  }, [location.search]);

  useEffect(() => {
    // Check if there's a stored redirect URL (from notification click)
    const storedRedirect = sessionStorage.getItem('redirectAfterLogin');
    if (storedRedirect) {
      setRedirectAfterLogin(storedRedirect);
    }
    
    // Also check URL params for redirect
    const params = new URLSearchParams(location.search);
    const redirectParam = params.get('redirect');
    if (redirectParam) {
      setRedirectAfterLogin(redirectParam);
      sessionStorage.setItem('redirectAfterLogin', redirectParam);
    }
  }, [location]);

  // Check for remembered credentials and pre-fill form OR auto-login
  useEffect(() => {
    if (autoLoginRef.current || autoLoginAttempted || user) return;
    
    const remembered = getRememberCredentials();
    console.log('[Login] Checking remembered credentials:', remembered ? 'FOUND' : 'NOT FOUND');
    
    if (remembered) {
      const creds = decodeCredentials(remembered);
      console.log('[Login] Decoded credentials:', creds ? 'SUCCESS' : 'FAILED');
      
      if (creds && creds.email && creds.password) {
        autoLoginRef.current = true;
        setAutoLoginAttempted(true);
        
        // Pre-fill the form
        setEmail(creds.email);
        setPassword(creds.password);
        setRememberMe(true);
        
        // Show message that we found saved credentials
        toast.info('Opgeslagen inloggegevens gevonden. Even geduld...');
        
        // Perform auto-login after a short delay
        setTimeout(() => {
          performLogin(creds.email, creds.password, true);
        }, 500);
      }
    }
  }, [user, autoLoginAttempted]);

  const performLogin = async (loginEmail, loginPassword, isAutoLogin = false) => {
    setLoading(true);
    try {
      const loggedInUser = await login(loginEmail, loginPassword);
      
      if (!isAutoLogin) {
        toast.success(t('messages.successSaved'));
      }
      
      // Save credentials if remember me is checked
      if (rememberMe || isAutoLogin) {
        const encoded = encodeCredentials(loginEmail, loginPassword);
        setRememberCredentials(encoded);
      } else {
        deleteRememberCredentials();
      }
      
      // Clear stored redirect
      sessionStorage.removeItem('redirectAfterLogin');
      
      // Check for stored redirect URL first
      if (redirectAfterLogin && redirectAfterLogin.startsWith('/')) {
        navigate(redirectAfterLogin);
        return;
      }
      
      // Determine redirect based on user type
      let redirectPath = '/dealer';
      if (loggedInUser.role === 'admin') {
        redirectPath = '/admin';
      } else if (loggedInUser.is_foreign_dealer) {
        redirectPath = '/foreign-dealer';
      }
      
      navigate(redirectPath);
    } catch (error) {
      // If auto-login fails, clear saved credentials
      if (isAutoLogin) {
        deleteRememberCredentials();
        setAutoLoginAttempted(true);
        autoLoginRef.current = false;
      }
      
      const errorMessage = error.response?.data?.detail || t('messages.errorOccurred');
      
      // Check if it's a pending approval error
      if (error.response?.status === 403 && errorMessage.includes('goedkeuring')) {
        toast.info(errorMessage, { duration: 5000 });
      } else if (!isAutoLogin) {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await performLogin(email, password, false);
  };

  // Show loading screen when short code login is in progress
  if (shortCodeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center p-8 max-w-md">
          <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bike className="w-10 h-10 text-white" />
          </div>
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="font-barlow text-xl font-bold uppercase tracking-tight text-zinc-900 mb-2">
            Even geduld...
          </h2>
          <p className="text-zinc-500">U wordt automatisch ingelogd</p>
        </div>
      </div>
    );
  }

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
            <p>Tel: +31 6 24264861</p>
            <p>Motoimportbv@gmail.com</p>
            <p>www.motoimportbv.nl</p>
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
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-11 pr-11 h-12"
                data-testid="login-password-input"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Remember me checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="rememberMe" 
              checked={rememberMe}
              onCheckedChange={setRememberMe}
              data-testid="remember-me-checkbox"
            />
            <Label 
              htmlFor="rememberMe" 
              className="text-sm font-medium text-zinc-700 cursor-pointer"
            >
              Onthoud mijn inloggegevens
            </Label>
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

        {/* Buitenlandse Leverancier Registratie - Opvallend & Meertalig */}
        <div className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-2xl">🇨🇭🇩🇪🇮🇹🇫🇷🇧🇪</span>
            </div>
            <h3 className="font-barlow font-bold text-amber-800 uppercase tracking-wide mb-1 text-lg">
              Foreign Supplier? / Ausländischer Lieferant?
            </h3>
            <p className="text-sm text-amber-700 mb-1">
              🇬🇧 Sell your motorcycles to Dutch dealers
            </p>
            <p className="text-sm text-amber-700 mb-1">
              🇩🇪 Verkaufen Sie Ihre Motorräder an niederländische Händler
            </p>
            <p className="text-sm text-amber-700 mb-1">
              🇫🇷 Vendez vos motos aux revendeurs néerlandais
            </p>
            <p className="text-sm text-amber-700 mb-3">
              🇮🇹 Vendete le vostre moto ai rivenditori olandesi
            </p>
            <Link 
              to="/register/supplier"
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition-colors shadow-lg hover:shadow-xl"
              data-testid="supplier-register-link"
            >
              <Globe className="w-5 h-5" />
              Register / Registrieren / S'inscrire / Registrati
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-xs text-amber-600 mt-2">
              Schweiz • Deutschland • Italia • France • België • Österreich
            </p>
          </div>
        </div>

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
