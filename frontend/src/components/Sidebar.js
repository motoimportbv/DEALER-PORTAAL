import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import LanguageSelector from './LanguageSelector';
import { 
  Bike, 
  LayoutDashboard, 
  ShoppingCart, 
  Plus, 
  LogOut,
  Package,
  Globe,
  Wrench,
  ClipboardList,
  CreditCard,
  Bell,
  UserPlus,
  KeyRound
} from 'lucide-react';

const Sidebar = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const adminNavItems = [
    { path: '/admin', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/admin/motorcycles', icon: Bike, label: t('nav.motorcycles') },
    { path: '/admin/motorcycles/new', icon: Plus, label: t('motorcycle.addMotorcycle') },
    { path: '/admin/pending-foreign', icon: Globe, label: t('nav.pendingListings') },
    { path: '/admin/orders', icon: ShoppingCart, label: t('nav.orders') },
    { path: '/admin/license-plates', icon: CreditCard, label: t('nav.licensePlates') || 'Kentekens' },
    { path: '/admin/push-status', icon: Bell, label: 'Push Status' },
    { path: '/admin/parts', icon: Wrench, label: t('nav.partsManagement') },
    { path: '/admin/part-orders', icon: ClipboardList, label: t('nav.partOrders') },
    { path: '/admin/dealers', icon: Package, label: t('nav.dealers') },
    { path: '/admin/create-admin', icon: UserPlus, label: 'Admin Aanmaken' },
    { path: '/admin/reset-password', icon: KeyRound, label: 'Wachtwoord Reset' },
  ];

  const dealerNavItems = [
    { path: '/dealer', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/dealer/parts', icon: Wrench, label: t('nav.partsShop') },
    { path: '/dealer/my-listings', icon: Bike, label: t('nav.myMotorcycles') },
    { path: '/dealer/sell', icon: Plus, label: t('nav.sellMotorcycle') },
    { path: '/dealer/orders', icon: ShoppingCart, label: t('nav.myOrders') },
    { path: '/dealer/license-plates', icon: CreditCard, label: t('nav.licensePlates') || 'Mijn Kentekens' },
  ];

  const foreignDealerNavItems = [
    { path: '/foreign-dealer', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/foreign-dealer/add', icon: Plus, label: t('foreignDealer.addMotorcycle') },
  ];

  // Determine nav items based on user type
  let navItems = dealerNavItems;
  let dashboardPath = '/dealer';
  
  if (user?.role === 'admin') {
    navItems = adminNavItems;
    dashboardPath = '/admin';
  } else if (user?.is_foreign_dealer) {
    navItems = foreignDealerNavItems;
    dashboardPath = '/foreign-dealer';
  }

  return (
    <aside className="sidebar sidebar-texture">
      <div className="sidebar-header">
        <div className="flex items-center justify-between">
          <Link to={dashboardPath} className="flex items-center gap-3">
            <div className={`w-10 h-10 ${user?.is_foreign_dealer ? 'bg-purple-600' : 'bg-red-600'} rounded-lg flex items-center justify-center`}>
              {user?.is_foreign_dealer ? <Globe className="w-6 h-6 text-white" /> : <Bike className="w-6 h-6 text-white" />}
            </div>
            <span className="font-barlow text-xl font-bold uppercase tracking-tight text-white">
              Moto Import
            </span>
          </Link>
          {user?.role === 'dealer' && <NotificationBell />}
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`sidebar-nav-item ${isActive(item.path) ? 'active' : ''}`}
            data-testid={`nav-${item.path.split('/').pop()}`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="mb-4 px-1 pb-4 border-b border-zinc-800">
          <p className="font-barlow uppercase tracking-wider text-xs text-zinc-500 mb-1">{t('auth.loginTitle')}</p>
          <p className="text-white font-semibold truncate">{user?.company_name}</p>
          <p className="text-zinc-400 text-sm truncate">{user?.email}</p>
        </div>
        <div className="mb-4 px-1 text-xs text-zinc-500">
          <p className="font-semibold text-zinc-400">Moto Import B.V.</p>
          <p>Horsterhoekweg 11, 7433 SV Schalkhaar</p>
          <p>+31 6 81792660</p>
          <p>Motoimportbv@gmail.com</p>
        </div>
        
        {/* Language Selector */}
        <div className="mb-4 px-1">
          <LanguageSelector />
        </div>
        
        <button
          onClick={handleLogout}
          className="sidebar-nav-item w-full text-left hover:text-red-400"
          data-testid="logout-btn"
        >
          <LogOut className="w-5 h-5" />
          <span>{t('common.logout')}</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
