import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Sidebar';
import ChatWidget from './ChatWidget';
import { AlertCircle, RefreshCw } from 'lucide-react';
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
        {children}
      </main>
      {/* Chat widget for dealers */}
      {user.role === 'dealer' && <ChatWidget isAdmin={false} />}
    </div>
  );
};

export default Layout;
