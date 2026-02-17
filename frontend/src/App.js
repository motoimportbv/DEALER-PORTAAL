import React, { useEffect } from "react";
import "@/App.css";
import "./i18n"; // Initialize i18n
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { initializeNativeFeatures, isNative } from "./services/nativeService";
import InstallPrompt from "./components/InstallPrompt";

// Global navigation ref for service worker notifications
let globalNavigate = null;

// Pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import SupplierRegisterPage from "./pages/SupplierRegisterPage";
import SupplierGuide from "./pages/SupplierGuide";
import DealerGuide from "./pages/DealerGuide";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AutoLoginPage from "./pages/AutoLoginPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import MotorcycleList from "./pages/admin/MotorcycleList";
import MotorcycleForm from "./pages/admin/MotorcycleForm";
import OrderList from "./pages/admin/OrderList";
import DealerManagement from "./pages/admin/DealerManagement";
import PendingForeignListings from "./pages/admin/PendingForeignListings";
import AdminParts from "./pages/admin/AdminParts";
import AdminPartOrders from "./pages/admin/AdminPartOrders";
import AdminLicensePlates from "./pages/admin/AdminLicensePlates";
import DealerDashboard from "./pages/dealer/DealerDashboard";
import DealerOrders from "./pages/dealer/DealerOrders";
import DealerSellMotorcycle from "./pages/dealer/DealerSellMotorcycle";
import DealerMyListings from "./pages/dealer/DealerMyListings";
import DealerLicensePlates from "./pages/dealer/DealerLicensePlates";
import PartsShop from "./pages/dealer/PartsShop";
import ForeignDealerDashboard from "./pages/foreign-dealer/ForeignDealerDashboard";
import ForeignDealerAddMotorcycle from "./pages/foreign-dealer/ForeignDealerAddMotorcycle";
import MotorcycleDetail from "./pages/MotorcycleDetail";
import PaymentSuccess from "./pages/PaymentSuccess";
import Pakbon from "./pages/Pakbon";

// Helper component to handle service worker navigation
function NotificationHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Store navigate function globally for service worker messages
    globalNavigate = navigate;
    
    // Clean up the from_notification param after navigating
    const params = new URLSearchParams(location.search);
    if (params.has('from_notification')) {
      params.delete('from_notification');
      const newSearch = params.toString();
      const newUrl = location.pathname + (newSearch ? `?${newSearch}` : '');
      // Replace URL without the marker
      window.history.replaceState({}, '', newUrl);
    }
    
    return () => {
      globalNavigate = null;
    };
  }, [navigate, location]);
  
  return null;
}

function App() {
  useEffect(() => {
    // Initialize native features when running as mobile app
    if (isNative) {
      initializeNativeFeatures();
    }

    // Listen for messages from service worker (notification clicks)
    const handleServiceWorkerMessage = (event) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
        console.log('[App] Received notification click, navigating to:', event.data.url);
        
        // Use React Router navigation if available (preserves auth state)
        if (globalNavigate) {
          try {
            // Parse the URL to get just the pathname
            const targetUrl = event.data.url;
            // Handle both full URLs and relative paths
            const path = targetUrl.startsWith('http') 
              ? new URL(targetUrl).pathname 
              : targetUrl;
            
            console.log('[App] Using React Router to navigate to:', path);
            globalNavigate(path);
          } catch (e) {
            console.error('[App] Navigation error:', e);
            // Fallback: use location change but with the path only
            window.location.pathname = event.data.url;
          }
        } else {
          // Fallback if router not ready
          console.log('[App] Router not ready, using window.location');
          const url = new URL(event.data.url, window.location.origin);
          if (url.origin === window.location.origin) {
            window.location.pathname = url.pathname;
          }
        }
      }
      
      // Play motorcycle sound on push notification
      if (event.data && event.data.type === 'PLAY_NOTIFICATION_SOUND') {
        console.log('[App] Playing notification sound');
        playMotorcycleSound();
      }
    };
    
    // Function to play motorcycle sound
    const playMotorcycleSound = () => {
      try {
        const audio = new Audio('/motorcycle-sound.wav');
        audio.volume = 0.7;
        audio.play().catch(e => {
          console.log('[App] Could not play sound (user interaction required):', e);
        });
      } catch (e) {
        console.log('[App] Audio not supported:', e);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, []);

  return (
    <AuthProvider>
      <div className="App">
        <Toaster position="top-right" richColors />
        <BrowserRouter>
          <NotificationHandler />
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/register/supplier" element={<SupplierRegisterPage />} />
            <Route path="/supplier-guide" element={<SupplierGuide />} />
            <Route path="/dealer-guide" element={<DealerGuide />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/auto-login" element={<AutoLoginPage />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/motorcycles" element={<MotorcycleList />} />
            <Route path="/admin/motorcycles/new" element={<MotorcycleForm />} />
            <Route path="/admin/motorcycles/:id/edit" element={<MotorcycleForm />} />
            <Route path="/admin/orders" element={<OrderList />} />
            <Route path="/admin/dealers" element={<DealerManagement />} />
            <Route path="/admin/pending-foreign" element={<PendingForeignListings />} />
            <Route path="/admin/parts" element={<AdminParts />} />
            <Route path="/admin/part-orders" element={<AdminPartOrders />} />
            <Route path="/admin/license-plates" element={<AdminLicensePlates />} />
            
            {/* Dealer Routes */}
            <Route path="/dealer" element={<DealerDashboard />} />
            <Route path="/dealer/orders" element={<DealerOrders />} />
            <Route path="/dealer/sell" element={<DealerSellMotorcycle />} />
            <Route path="/dealer/my-listings" element={<DealerMyListings />} />
            <Route path="/dealer/parts" element={<PartsShop />} />
            <Route path="/dealer/license-plates" element={<DealerLicensePlates />} />
            
            {/* Foreign Dealer Routes */}
            <Route path="/foreign-dealer" element={<ForeignDealerDashboard />} />
            <Route path="/foreign-dealer/add" element={<ForeignDealerAddMotorcycle />} />
            
            {/* Shared Routes */}
            <Route path="/motorcycle/:id" element={<MotorcycleDetail />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/pakbon/:orderId" element={<Pakbon />} />
            
            {/* Default Redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          <InstallPrompt />
        </BrowserRouter>
      </div>
    </AuthProvider>
  );
}

export default App;
