import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import AdminActivityBell from './AdminActivityBell';
import LanguageSelector from './LanguageSelector';
import ChangePasswordModal from './ChangePasswordModal';
import axios from 'axios';
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
  KeyRound,
  TrendingUp,
  Mail,
  MessageCircle,
  MessageSquare,
  BadgeEuro,
  Search,
  Printer,
  FileText
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Sidebar = () => {
  const { t } = useTranslation();
  const { user, logout, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingProposals, setPendingProposals] = useState(0);
  const [pendingWantedRequests, setPendingWantedRequests] = useState(0);

  // Fetch pending proposals count for admin
  useEffect(() => {
    if (user?.role === 'admin' && token) {
      const fetchCounts = async () => {
        try {
          // Fetch proposals count
          const proposalsRes = await axios.get(`${API}/price-proposals/count`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setPendingProposals(proposalsRes.data.count);
          
          // Fetch wanted requests count
          const wantedRes = await axios.get(`${API}/wanted-requests/pending-count`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setPendingWantedRequests(wantedRes.data.count);
        } catch (error) {
          console.error('Failed to fetch counts');
        }
      };
      fetchCounts();
      // Refresh every 60 seconds
      const interval = setInterval(fetchCounts, 60000);
      return () => clearInterval(interval);
    }
  }, [user, token]);

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
    { path: '/admin/parts', icon: Wrench, label: t('nav.partsManagement') },
    { path: '/admin/part-orders', icon: ClipboardList, label: t('nav.partOrders') },
    { path: '/admin/dealers', icon: Package, label: t('nav.dealers') },
    { path: '/admin/price-proposals', icon: BadgeEuro, label: '💰 Prijsvoorstellen', badge: pendingProposals },
    { path: '/admin/wanted-requests', icon: Search, label: '🔍 Zoekertjes', badge: pendingWantedRequests },
    { path: '/admin/create-admin', icon: UserPlus, label: 'Admin Aanmaken' },
    { path: '/admin/reset-password', icon: KeyRound, label: 'Wachtwoord Reset' },
    { path: '/admin/exchange-rate', icon: TrendingUp, label: 'Wisselkoers' },
    { path: '/admin/bulk-email', icon: Mail, label: 'Marketing E-mails' },
    { path: '/admin/sms', icon: MessageSquare, label: '📱 SMS Broadcast' },
    { path: '/admin/whatsapp', icon: MessageCircle, label: 'WhatsApp Broadcast' },
    // Taxatie - only for info@motoimportbv.nl (filtered below)
    ...(user?.email?.toLowerCase() === 'motoimportbv@gmail.com' ? [
      { path: '/admin/taxatie', icon: FileText, label: 'Taxatie Facturen' },
      { path: '/admin/google-motors', icon: Globe, label: 'Google Motoren' },
    ] : []),
  ];

  const dealerNavItems = [
    { path: '/dealer', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/dealer/parts', icon: Wrench, label: t('nav.partsShop') },
    { path: '/dealer/my-listings', icon: Bike, label: t('nav.myMotorcycles') },
    { path: '/dealer/sell', icon: Plus, label: t('nav.sellMotorcycle') },
    { path: '/dealer/orders', icon: ShoppingCart, label: t('nav.myOrders') },
    { path: '/dealer/license-plates', icon: CreditCard, label: t('nav.licensePlates') || 'Mijn Kentekens' },
    { path: '/dealer/wanted-requests', icon: Search, label: '🔍 Motor Zoekertje' },
    { path: '/dealer/google-motors', icon: Globe, label: 'Google Motoren' },
  ];

  const foreignDealerNavItems = [
    { path: '/foreign-dealer', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/foreign-dealer/add', icon: Plus, label: t('foreignDealer.addMotorcycle') },
  ];

  const pakbonNavItems = [
    { path: '/pakbonnen', icon: Printer, label: 'Pakbonnen' },
  ];

  // Determine nav items based on user type
  let navItems = dealerNavItems;
  let dashboardPath = '/dealer';
  
  if (user?.role === 'admin') {
    navItems = adminNavItems;
    dashboardPath = '/admin';
  } else if (user?.role === 'pakbon') {
    navItems = pakbonNavItems;
    dashboardPath = '/pakbonnen';
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
          {user?.role === 'admin' && <AdminActivityBell />}
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
            <span className="flex-1">{item.label}</span>
            {item.badge > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="mb-2 px-1 pb-2 border-b border-zinc-800">
          <p className="text-white font-semibold truncate text-sm">{user?.company_name}</p>
          <p className="text-zinc-400 text-xs truncate">{user?.email}</p>
        </div>
        
        {/* Language Selector - only for dealers */}
        {user?.role !== 'admin' && (
          <div className="mb-2 px-1">
            <LanguageSelector />
          </div>
        )}
        
        {/* Change Password Button */}
        <button
          onClick={() => setShowPasswordModal(true)}
          className="sidebar-nav-item w-full text-left hover:text-yellow-400 mb-1 py-2"
          data-testid="change-password-btn"
        >
          <KeyRound className="w-4 h-4" />
          <span className="text-sm">Wachtwoord Wijzigen</span>
        </button>
        
        <button
          onClick={handleLogout}
          className="sidebar-nav-item w-full text-left hover:text-red-400 py-2"
          data-testid="logout-btn"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">{t('common.logout')}</span>
        </button>
      </div>
      
      {/* Change Password Modal */}
      <ChangePasswordModal 
        open={showPasswordModal} 
        onClose={() => setShowPasswordModal(false)} 
      />
    </aside>
  );
};

export default Sidebar;
