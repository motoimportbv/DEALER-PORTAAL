import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Bike, 
  LayoutDashboard, 
  ShoppingCart, 
  Plus, 
  LogOut,
  Package
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const adminNavItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/motorcycles', icon: Bike, label: 'Motorfietsen' },
    { path: '/admin/motorcycles/new', icon: Plus, label: 'Nieuwe Motor' },
    { path: '/admin/orders', icon: ShoppingCart, label: 'Bestellingen' },
  ];

  const dealerNavItems = [
    { path: '/dealer', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/dealer/orders', icon: ShoppingCart, label: 'Mijn Bestellingen' },
  ];

  const navItems = user?.role === 'admin' ? adminNavItems : dealerNavItems;

  return (
    <aside className="sidebar sidebar-texture">
      <div className="sidebar-header">
        <Link to={user?.role === 'admin' ? '/admin' : '/dealer'} className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
            <Bike className="w-6 h-6 text-white" />
          </div>
          <span className="font-barlow text-xl font-bold uppercase tracking-tight text-white">
            MotoDealer
          </span>
        </Link>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`sidebar-nav-item ${isActive(item.path) ? 'active' : ''}`}
            data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="mb-4 px-1">
          <p className="font-barlow uppercase tracking-wider text-xs text-zinc-500 mb-1">Ingelogd als</p>
          <p className="text-white font-semibold truncate">{user?.company_name}</p>
          <p className="text-zinc-400 text-sm truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="sidebar-nav-item w-full text-left hover:text-red-400"
          data-testid="logout-btn"
        >
          <LogOut className="w-5 h-5" />
          <span>Uitloggen</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
