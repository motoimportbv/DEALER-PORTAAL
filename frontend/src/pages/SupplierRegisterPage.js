import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Globe, Mail, Lock, Building, ArrowRight, Phone, User, ChevronDown, MapPin, Users, Truck, Wallet, FileCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Language order for foreign dealers: German first, then Italian, French, Dutch
const foreignDealerLanguages = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' }
];

const SupplierRegisterPage = () => {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  // Set German as default language for foreign dealers, or use URL param
  useEffect(() => {
    const urlLang = searchParams.get('lang');
    if (urlLang && ['de', 'it', 'fr', 'nl'].includes(urlLang)) {
      i18n.changeLanguage(urlLang);
      localStorage.setItem('i18nextLng', urlLang);
    } else if (!localStorage.getItem('supplierLangSet')) {
      // Only set German on first visit to supplier page
      i18n.changeLanguage('de');
      localStorage.setItem('i18nextLng', 'de');
      localStorage.setItem('supplierLangSet', 'true');
    }
  }, [i18n, searchParams]);

  const handleLanguageChange = (langCode) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('i18nextLng', langCode);
    setLangMenuOpen(false);
  };

  const currentLang = foreignDealerLanguages.find(l => l.code === i18n.language) || foreignDealerLanguages[0];
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    company_name: '',
    country: '',
    contact_person: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    iban: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password.length < 6) {
      toast.error(t('register.passwordMinLength'));
      return;
    }
    if (!formData.country) {
      toast.error(t('supplierRegister.countryRequired'));
      return;
    }
    if (!formData.company_name) {
      toast.error(t('supplierRegister.companyRequired'));
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/api/auth/register-supplier`, formData);
      localStorage.setItem('token', response.data.token);
      toast.success(t('supplierRegister.success'));
      navigate('/foreign-dealer');
    } catch (error) {
      toast.error(error.response?.data?.detail || t('register.failed'));
    } finally {
      setLoading(false);
    }
  };

  const countries = [
    { value: 'switzerland', label: '🇨🇭 Schweiz / Zwitserland' },
    { value: 'germany', label: '🇩🇪 Deutschland / Duitsland' },
    { value: 'italy', label: '🇮🇹 Italia / Italië' },
    { value: 'france', label: '🇫🇷 France / Frankrijk' },
    { value: 'belgium', label: '🇧🇪 Belgique / België' },
    { value: 'austria', label: '🇦🇹 Österreich / Oostenrijk' },
    { value: 'spain', label: '🇪🇸 España / Spanje' },
    { value: 'poland', label: '🇵🇱 Polska / Polen' },
    { value: 'other', label: '🌍 Other / Anders' }
  ];

  return (
    <div className="auth-layout">
      <div 
        className="auth-hero hidden md:flex"
        style={{
          backgroundImage: 'url(https://customer-assets.emergentagent.com/job_dealer-moto-portal/artifacts/338sojwi_Screenshot_20260124_144156_ChatGPT.jpg)'
        }}
      >
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <div className="inline-flex items-center gap-2 bg-purple-600/90 text-white px-4 py-2 rounded-full text-sm font-medium mb-4 w-fit">
            <Globe className="w-4 h-4" />
            {t('supplierRegister.badge')}
          </div>
          <h1 className="font-barlow text-5xl font-bold uppercase tracking-tight mb-4">
            Moto Import Portal
          </h1>
          <p className="text-lg text-zinc-300 max-w-md mb-8">
            {t('supplierRegister.heroText')}
          </p>
          <div className="text-sm text-zinc-400 space-y-1">
            <p>Moto Import B.V.</p>
            <p>Horstenhoekweg 11, 7433 SV</p>
            <p>Schalkhaar</p>
          </div>
        </div>
      </div>

      <div className="auth-form">
        {/* Language Selector for Foreign Dealers - German first */}
        <div className="absolute top-4 right-4 z-50">
          <div className="relative">
            <button
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium shadow-md"
              data-testid="supplier-language-selector"
            >
              <Globe className="w-4 h-4" />
              <span className="text-lg">{currentLang.flag}</span>
              <span className="hidden xs:inline">{currentLang.name}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${langMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {langMenuOpen && (
              <div className="absolute right-0 top-full mt-2 bg-white border-2 border-zinc-200 rounded-xl overflow-hidden min-w-[180px] shadow-xl">
                {foreignDealerLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-base text-left transition-colors ${
                      i18n.language === lang.code 
                        ? 'bg-purple-50 text-purple-700' 
                        : 'hover:bg-zinc-100 text-zinc-700'
                    }`}
                    data-testid={`supplier-lang-${lang.code}`}
                  >
                    <span className="text-2xl">{lang.flag}</span>
                    <span className="font-medium">{lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <span className="font-barlow text-2xl font-bold text-zinc-900 uppercase">
              Moto Import
            </span>
          </div>

          <h2 className="font-barlow text-3xl font-bold text-zinc-900 uppercase mb-2">
            {t('supplierRegister.title')}
          </h2>
          <p className="text-zinc-500 mb-6">
            {t('supplierRegister.subtitle')}
          </p>

          {/* Voordelen-blok — krachtig en kort */}
          <div className="bg-gradient-to-br from-purple-50 to-zinc-50 border-2 border-purple-200 rounded-2xl p-5 mb-8" data-testid="benefits-block">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-zinc-900 text-base">{t('supplierRegister.benefitsTitle')}</h3>
            </div>
            <p className="text-xs text-zinc-600 mb-4">{t('supplierRegister.benefitsSubtitle')}</p>
            <ul className="space-y-3">
              {[
                { Icon: Users,     title: t('supplierRegister.benefit1Title'), text: t('supplierRegister.benefit1Text') },
                { Icon: Building,  title: t('supplierRegister.benefit2Title'), text: t('supplierRegister.benefit2Text') },
                { Icon: Wallet,    title: t('supplierRegister.benefit3Title'), text: t('supplierRegister.benefit3Text') },
                { Icon: Truck,     title: t('supplierRegister.benefit4Title'), text: t('supplierRegister.benefit4Text') },
                { Icon: FileCheck, title: t('supplierRegister.benefit5Title'), text: t('supplierRegister.benefit5Text') },
              ].map(({ Icon, title, text }, idx) => (
                <li key={idx} className="flex gap-3" data-testid={`benefit-item-${idx}`}>
                  <div className="flex-shrink-0 w-9 h-9 bg-white border-2 border-purple-200 rounded-lg flex items-center justify-center">
                    <Icon className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-900 leading-tight">{title}</p>
                    <p className="text-xs text-zinc-600 leading-snug mt-0.5">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                {t('supplierRegister.companyDetails')}
              </p>
              
              <div>
                <Label htmlFor="company_name">{t('auth.companyName')} *</Label>
                <div className="relative mt-1.5">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => handleChange('company_name', e.target.value)}
                    className="pl-10"
                    placeholder={t('supplierRegister.companyPlaceholder')}
                    required
                    data-testid="supplier-company-input"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="country">{t('supplierRegister.country')} *</Label>
                <Select 
                  value={formData.country} 
                  onValueChange={(value) => handleChange('country', value)}
                >
                  <SelectTrigger className="mt-1.5" data-testid="supplier-country-select">
                    <Globe className="w-4 h-4 text-zinc-400 mr-2" />
                    <SelectValue placeholder={t('supplierRegister.selectCountry')} />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map(country => (
                      <SelectItem key={country.value} value={country.value}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="contact_person">{t('register.contactPerson')}</Label>
                <div className="relative mt-1.5">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => handleChange('contact_person', e.target.value)}
                    className="pl-10"
                    placeholder={t('register.contactPlaceholder')}
                    data-testid="supplier-contact-input"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="phone">{t('auth.phone')}</Label>
                <div className="relative mt-1.5">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="pl-10"
                    placeholder="+49 123 456789"
                    data-testid="supplier-phone-input"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="address">{t('register.address') || 'Adres / Address'}</Label>
                <div className="relative mt-1.5">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    className="pl-10"
                    placeholder="Musterstraße 123"
                    data-testid="supplier-address-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="postal_code">{t('register.postalCode') || 'PLZ / Postal Code'}</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={(e) => handleChange('postal_code', e.target.value)}
                    className="mt-1.5"
                    placeholder="12345"
                    data-testid="supplier-postal-input"
                  />
                </div>
                <div>
                  <Label htmlFor="city">{t('register.city') || 'Stadt / City'}</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    className="mt-1.5"
                    placeholder="Berlin"
                    data-testid="supplier-city-input"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="iban">IBAN / {t('register.bankAccount') || 'Bankrekening'}</Label>
                <div className="relative mt-1.5">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    id="iban"
                    value={formData.iban}
                    onChange={(e) => handleChange('iban', e.target.value.toUpperCase())}
                    className="pl-10 font-mono"
                    placeholder="CH93 0076 2011 6238 5295 7"
                    data-testid="supplier-iban-input"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                {t('register.accountDetails')}
              </p>
              
              <div>
                <Label htmlFor="email">{t('auth.email')} *</Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="pl-10"
                    placeholder="email@company.com"
                    required
                    data-testid="supplier-email-input"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password">{t('auth.password')} *</Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    className="pl-10"
                    placeholder="••••••••"
                    required
                    data-testid="supplier-password-input"
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-1">{t('register.passwordHint')}</p>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-purple-600 hover:bg-purple-700"
              disabled={loading}
              data-testid="supplier-register-button"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {t('supplierRegister.submit')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>

            <p className="text-center text-sm text-zinc-500">
              {t('auth.hasAccount')}{' '}
              <Link to="/login" className="text-purple-600 hover:underline font-medium">
                {t('common.login')}
              </Link>
            </p>

            <p className="text-center text-sm text-zinc-500">
              {t('supplierRegister.dealerLink')}{' '}
              <Link to="/register" className="text-red-600 hover:underline font-medium">
                {t('supplierRegister.dealerRegister')}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SupplierRegisterPage;
