import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import WhatsAppButton from './WhatsAppButton';
import LanguageSelector from './LanguageSelector';
import NotificationBell from './NotificationBell';
import AdminActivityBell from './AdminActivityBell';
import { getBranding } from '../utils/branding';
import { AlertCircle, RefreshCw, Bike, LogOut, Menu, X, LayoutDashboard, ShoppingCart, Plus, Wrench, CreditCard, Globe } from 'lucide-react';
import { Button } from './ui/button';

const Layout = ({ children, requiredRole }) => {
  const { user, loading, error, logout } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Store current URL for redirect after login (for notification clicks)
  useEffect(() => {
    if (!user && !loading) {
      // User is not logged in - store the current path for redirect after login
      const currentPath = location.pathname + location.search;
      if (currentPath && currentPath !== '/login' && currentPath !== '/') {
        sessionStorage.setItem('redirectAfterLogin', currentPath);
      }
    }
  }, [user, loading, location]);

  // Show error state with retry option
  if (error && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="font-barlow text-xl font-bold uppercase tracking-tight text-zinc-900 mb-2">
            Verbindingsprobleem
          </h2>
          <p className="text-zinc-600 mb-6">
            Kon geen verbinding maken met de server. Controleer uw internetverbinding.
          </p>
          <Button 
            onClick={() => window.location.reload()}
            className="bg-red-600 hover:bg-red-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Opnieuw proberen
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="font-barlow text-lg uppercase tracking-wide text-zinc-600">Laden...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Pakbon users can ONLY access /pakbonnen and /pakbon/ routes
  if (user.role === 'pakbon' && !location.pathname.startsWith('/pakbon')) {
    return <Navigate to="/pakbonnen" replace />;
  }

  // Taxateur users can ONLY access /admin/taxatie and /admin/taxatie-programma routes
  if (user.role === 'taxateur') {
    const allowedTaxateur = location.pathname === '/admin/taxatie' || location.pathname.startsWith('/admin/taxatie/') ||
      location.pathname === '/admin/taxatie-programma' || location.pathname.startsWith('/admin/taxatie-programma/');
    if (!allowedTaxateur) {
      return <Navigate to="/admin/taxatie" replace />;
    }
  }

  if (requiredRole && user.role !== requiredRole) {
    const roleRedirects = { admin: '/admin', pakbon: '/pakbonnen', taxateur: '/admin/taxatie', foreign_dealer: '/foreign-dealer' };
    return <Navigate to={roleRedirects[user.role] || '/dealer'} replace />;
  }

  // Mobile navigation items based on user role
  const getMobileNavItems = () => {
    if (user?.role === 'admin') {
      return [
        { path: '/admin', icon: LayoutDashboard, label: t('nav.dashboard') },
        { path: '/admin/motorcycles', icon: Bike, label: t('nav.motorcycles') },
        { path: '/admin/orders', icon: ShoppingCart, label: t('nav.orders') },
        { path: '/admin/dealers', icon: Globe, label: t('nav.dealers') },
      ];
    } else if (user?.role === 'pakbon') {
      return [
        { path: '/pakbonnen', icon: Bike, label: 'Pakbonnen' },
      ];
    } else if (user?.is_foreign_dealer) {
      return [
        { path: '/foreign-dealer', icon: LayoutDashboard, label: t('nav.dashboard') },
        { path: '/foreign-dealer/add', icon: Plus, label: t('foreignDealer.addMotorcycle') },
      ];
    } else {
      return [
        { path: '/dealer', icon: LayoutDashboard, label: t('nav.dashboard') },
        { path: '/dealer/parts', icon: Wrench, label: t('nav.partsShop') },
        { path: '/dealer/orders', icon: ShoppingCart, label: t('nav.myOrders') },
        { path: '/dealer/license-plates', icon: CreditCard, label: t('nav.licensePlates') || 'Kentekens' },
      ];
    }
  };

  const mobileNavItems = getMobileNavItems();
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {/* Mobile header with hamburger menu */}
        <div 
          className="md:hidden sticky top-0 z-50 bg-white border-b shadow-sm"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 10px)' }}
        >
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                data-testid="mobile-menu-btn"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5 text-white" />
                ) : (
                  <Menu className="w-5 h-5 text-white" />
                )}
              </button>
              <span className="font-barlow text-base font-bold uppercase tracking-tight text-zinc-900">
                {getBranding(user).shortName}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {user?.role === 'admin' && <AdminActivityBell />}
              {user?.role === 'dealer' && <NotificationBell />}
              <button 
                onClick={handleLogout}
                className="p-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                title="Uitloggen"
                data-testid="mobile-logout-btn"
              >
                <LogOut className="w-4 h-4 text-zinc-700" />
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="absolute top-full left-0 right-0 bg-white border-b shadow-lg z-[100]">
              <nav className="py-2">
                {mobileNavItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      isActive(item.path) 
                        ? 'bg-red-50 text-red-600 border-l-4 border-red-600' 
                        : 'text-zinc-700 hover:bg-zinc-50'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                ))}
                <div className="border-t my-2"></div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    window.location.reload();
                  }}
                  className="flex items-center gap-3 px-4 py-3 text-zinc-700 hover:bg-zinc-50 w-full"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span className="font-medium">Verversen</span>
                </button>
              </nav>
            </div>
          )}
        </div>
        {children}
      </main>
      {/* WhatsApp button for dealers */}
      {user.role === 'dealer' && <WhatsAppButton />}
    </div>
  );
};

export default Layout;
