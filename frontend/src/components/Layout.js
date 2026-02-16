import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Sidebar';
import WhatsAppButton from './WhatsAppButton';
import LanguageSelector from './LanguageSelector';
import { AlertCircle, RefreshCw, Bike } from 'lucide-react';
import { Button } from './ui/button';

const Layout = ({ children, requiredRole }) => {
  const { user, loading, error } = useAuth();

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

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dealer'} replace />;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {/* Mobile header with language selector - always visible on mobile */}
        {/* Uses safe-area-inset for iPhone notch */}
        <div 
          className="md:hidden sticky top-0 z-50 bg-white border-b shadow-sm"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 10px)' }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center">
                <Bike className="w-5 h-5 text-white" />
              </div>
              <span className="font-barlow text-lg font-bold uppercase tracking-tight text-zinc-900">
                Moto Import
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => window.location.reload()}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                title="Verversen"
              >
                <RefreshCw className="w-4 h-4 text-zinc-700" />
                <span className="text-sm font-medium text-zinc-700">Ververs</span>
              </button>
              <LanguageSelector variant="light" />
            </div>
          </div>
        </div>
        {children}
      </main>
      {/* WhatsApp button for dealers */}
      {user.role === 'dealer' && <WhatsAppButton />}
    </div>
  );
};

export default Layout;
