import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Bike, Mail, Lock, Building, ArrowRight, MapPin, Phone, User, FileText, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const RegisterPage = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    company_name: '',
    kvk_number: '',
    address: '',
    postal_code: '',
    city: '',
    phone: '',
    contact_person: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
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
    if (formData.password !== formData.confirmPassword) {
      toast.error('Wachtwoorden komen niet overeen');
      return;
    }
    if (!formData.kvk_number) {
      toast.error(t('register.kvkRequired'));
      return;
    }
    setLoading(true);
    try {
      const user = await register(
        formData.email, 
        formData.password, 
        formData.company_name, 
        'dealer',
        formData.kvk_number,
        formData.address,
        formData.postal_code,
        formData.city,
        formData.phone,
        formData.contact_person
      );
      toast.success(t('register.success'));
      navigate('/dealer');
    } catch (error) {
      toast.error(error.response?.data?.detail || t('register.failed'));
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
            {t('register.heroText')}
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
      
      <div className="auth-form-container overflow-y-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
              <Bike className="w-7 h-7 text-white" />
            </div>
            <span className="font-barlow text-2xl font-bold uppercase tracking-tight">Moto Import</span>
          </div>
          <h2 className="font-barlow text-3xl font-bold uppercase tracking-tight text-zinc-900">
            {t('auth.registerTitle')}
          </h2>
          <p className="text-zinc-500 mt-2">{t('register.fillDetails')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bedrijfsgegevens */}
          <div className="p-4 bg-zinc-50 rounded-lg space-y-4">
            <h3 className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
              {t('register.companyDetails')}
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="company" className="text-xs text-zinc-500">{t('auth.companyName')} *</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    id="company"
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => handleChange('company_name', e.target.value)}
                    placeholder={t('register.companyPlaceholder')}
                    className="pl-10 h-11"
                    data-testid="register-company-input"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="kvk" className="text-xs text-zinc-500">{t('auth.kvkNumber')} *</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    id="kvk"
                    type="text"
                    value={formData.kvk_number}
                    onChange={(e) => handleChange('kvk_number', e.target.value)}
                    placeholder="12345678"
                    className="pl-10 h-11"
                    data-testid="register-kvk-input"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs text-zinc-500">{t('auth.phone')}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+31 6 12345678"
                    className="pl-10 h-11"
                    data-testid="register-phone-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Adresgegevens */}
          <div className="p-4 bg-zinc-50 rounded-lg space-y-4">
            <h3 className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
              {t('register.addressDetails')}
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="address" className="text-xs text-zinc-500">{t('register.streetAddress')}</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  id="address"
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder={t('register.streetPlaceholder')}
                  className="pl-10 h-11"
                  data-testid="register-address-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postal" className="text-xs text-zinc-500">{t('register.postalCode')}</Label>
                <Input
                  id="postal"
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => handleChange('postal_code', e.target.value)}
                  placeholder="1234 AB"
                  className="h-11"
                  data-testid="register-postal-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city" className="text-xs text-zinc-500">{t('register.city')}</Label>
                <Input
                  id="city"
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder={t('register.cityPlaceholder')}
                  className="h-11"
                  data-testid="register-city-input"
                />
              </div>
            </div>
          </div>

          {/* Contactpersoon & Account */}
          <div className="p-4 bg-zinc-50 rounded-lg space-y-4">
            <h3 className="font-barlow uppercase tracking-wider text-xs font-semibold text-zinc-500">
              {t('register.accountDetails')}
            </h3>

            <div className="space-y-2">
              <Label htmlFor="contact" className="text-xs text-zinc-500">{t('register.contactPerson')}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  id="contact"
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => handleChange('contact_person', e.target.value)}
                  placeholder={t('register.contactPlaceholder')}
                  className="pl-10 h-11"
                  data-testid="register-contact-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs text-zinc-500">{t('auth.email')} *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder={t('register.emailPlaceholder')}
                  className="pl-10 h-11"
                  data-testid="register-email-input"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs text-zinc-500">{t('auth.password')} *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder={t('register.passwordPlaceholder')}
                  className="pl-10 pr-10 h-11"
                  data-testid="register-password-input"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-zinc-400">Minimaal 6 tekens</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-xs text-zinc-500">Bevestig wachtwoord *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  placeholder="Herhaal uw wachtwoord"
                  className={`pl-10 pr-10 h-11 ${
                    formData.confirmPassword && formData.password !== formData.confirmPassword 
                      ? 'border-red-500 focus:border-red-500' 
                      : formData.confirmPassword && formData.password === formData.confirmPassword
                      ? 'border-green-500 focus:border-green-500'
                      : ''
                  }`}
                  data-testid="register-confirm-password-input"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-xs text-red-500">Wachtwoorden komen niet overeen</p>
              )}
              {formData.confirmPassword && formData.password === formData.confirmPassword && (
                <p className="text-xs text-green-500">Wachtwoorden komen overeen ✓</p>
              )}
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 bg-red-600 hover:bg-red-700 font-barlow uppercase tracking-wide font-semibold"
            disabled={loading}
            data-testid="register-submit-btn"
          >
            {loading ? t('common.loading') : t('register.createAccount')}
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </form>

        <p className="mt-6 text-center text-zinc-500">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="text-red-600 hover:text-red-700 font-semibold" data-testid="login-link">
            {t('common.login')}
          </Link>
        </p>

        <p className="mt-3 text-center text-zinc-500">
          {t('register.supplierLink')}{' '}
          <Link to="/register/supplier" className="text-purple-600 hover:text-purple-700 font-semibold" data-testid="supplier-register-link">
            {t('register.supplierRegister')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
