import React, { useEffect } from "react";
import "@/App.css";
import "./i18n"; // Initialize i18n
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "./contexts/AuthContext";
import { DataRefreshProvider } from "./components/DataRefreshProvider";
import { initializeNativeFeatures, isNative } from "./services/nativeService";
import InstallPrompt from "./components/InstallPrompt";
import WelcomePopup from "./components/WelcomePopup";
import CocAnnouncementPopup from "./components/CocAnnouncementPopup";
import { useGeoLanguage } from "./hooks/useGeoLanguage";

// Global navigation ref for service worker notifications
let globalNavigate = null;

// Pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import SupplierRegisterPage from "./pages/SupplierRegisterPage";
import SupplierGuide from "./pages/SupplierGuide";
import SupplierLandingPage from "./pages/SupplierLandingPage";
import DealerLandingPage from "./pages/DealerLandingPage";
import ParticulierLandingPage from "./pages/ParticulierLandingPage";
import DealerGuide from "./pages/DealerGuide";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AutoLoginPage from "./pages/AutoLoginPage";
import ShortCodeLoginPage from "./pages/ShortCodeLoginPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import MotorcycleList from "./pages/admin/MotorcycleList";
import MotorcycleForm from "./pages/admin/MotorcycleForm";
import BulkMotorcycleForm from "./pages/admin/BulkMotorcycleForm";
import TaxatieInvoices from "./pages/admin/TaxatieInvoices";
import OrderList from "./pages/admin/OrderList";
import CocOrders from "./pages/admin/CocOrders";
import DealerManagement from "./pages/admin/DealerManagement";
import PendingForeignListings from "./pages/admin/PendingForeignListings";
import AdminParts from "./pages/admin/AdminParts";
import AdminPartOrders from "./pages/admin/AdminPartOrders";
import AdminLicensePlates from "./pages/admin/AdminLicensePlates";
import AdminCreateAdmin from "./pages/admin/AdminCreateAdmin";
import AdminResetPassword from "./pages/admin/AdminResetPassword";
import AdminExchangeRate from "./pages/admin/AdminExchangeRate";
import AdminBulkEmail from "./pages/admin/AdminBulkEmail";
import AdminWhatsAppBroadcast from "./pages/admin/AdminWhatsAppBroadcast";
import AdminSMSBroadcast from "./pages/admin/AdminSMSBroadcast";
import AdminPriceProposals from "./pages/admin/AdminPriceProposals";
import AdminWantedRequests from "./pages/admin/AdminWantedRequests";
import AdminActivity from "./pages/admin/AdminActivity";
import DealerDashboard from "./pages/dealer/DealerDashboard";
import DealerOrders from "./pages/dealer/DealerOrders";
import DealerArchivedOrders from "./pages/dealer/DealerArchivedOrders";
import DealerSellMotorcycle from "./pages/dealer/DealerSellMotorcycle";
import DealerMyListings from "./pages/dealer/DealerMyListings";
import DealerLicensePlates from "./pages/dealer/DealerLicensePlates";
import PartsShop from "./pages/dealer/PartsShop";
import WantedRequestPage from "./pages/WantedRequestPage";
import ForeignDealerDashboard from "./pages/foreign-dealer/ForeignDealerDashboard";
import ForeignDealerAddMotorcycle from "./pages/foreign-dealer/ForeignDealerAddMotorcycle";
import MotorcycleDetail from "./pages/MotorcycleDetail";
import PaymentSuccess from "./pages/PaymentSuccess";
import Pakbon from "./pages/Pakbon";
import PakbonDashboard from "./pages/pakbon/PakbonDashboard";
import ParticulierRegister from "./pages/particulier/ParticulierRegister";
import ParticulierDashboard from "./pages/particulier/ParticulierDashboard";
import ParticulierAddListing from "./pages/particulier/ParticulierAddListing";
import ParticulierSuccess from "./pages/particulier/ParticulierSuccess";
import DealerGoogleMotors from "./pages/dealer/DealerGoogleMotors";
import AdminGoogleMotors from "./pages/admin/AdminGoogleMotors";
import TaxatieProgramma from "./pages/admin/TaxatieProgramma";
import PublicMotorListing from "./pages/PublicMotorListing";
import PublicMotorDetail from "./pages/PublicMotorDetail";
import CustomerMotorView from "./pages/CustomerMotorView";

// Helper component to handle service worker navigation and geo-language
function NotificationHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Auto-detect language based on visitor's country
  useGeoLanguage();
  
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

// Redirect old preview URLs to production
// NOTE: Disabled in preview environment to allow testing
function PreviewRedirect() {
  useEffect(() => {
    const hostname = window.location.hostname;
    const PRODUCTION_URL = 'https://www.motoimportbv.nl';
    
    // Skip redirect in preview environments to allow development/testing
    if (hostname.includes('preview.emergentagent.com')) {
      console.log('Preview environment detected - skipping redirect to production');
      return; // Don't redirect in preview
    }
    
    // Only redirect non-localhost, non-preview URLs that aren't production
    // This handles legacy URLs or other deployment environments
    if (!hostname.includes('localhost') && 
        !hostname.includes('motoimportbv.nl') &&
        !hostname.includes('preview.emergentagent.com')) {
      const productionUrl = `${PRODUCTION_URL}${window.location.pathname}${window.location.search}`;
      console.log('Redirecting to production:', productionUrl);
      window.location.replace(productionUrl);
    }
  }, []);
  
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
    <HelmetProvider>
    <AuthProvider>
      <DataRefreshProvider>
        <div className="App">
          <Toaster position="top-right" richColors />
          <BrowserRouter>
            <PreviewRedirect />
            <NotificationHandler />
            <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/:token" element={<AutoLoginPage />} />
            <Route path="/go/:code" element={<ShortCodeLoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/register/supplier" element={<SupplierRegisterPage />} />
            <Route path="/supplier-guide" element={<SupplierGuide />} />
            <Route path="/suppliers" element={<SupplierLandingPage />} />
            <Route path="/dealers" element={<DealerLandingPage />} />
            <Route path="/particulier-verkopen" element={<ParticulierLandingPage />} />
            <Route path="/motoren" element={<PublicMotorListing />} />
            <Route path="/motor/:id/:slug?" element={<PublicMotorDetail />} />
            <Route path="/klant/motor/:id" element={<CustomerMotorView />} />
            <Route path="/dealer-guide" element={<DealerGuide />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/auto-login" element={<AutoLoginPage />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/motorcycles" element={<MotorcycleList />} />
            <Route path="/admin/motorcycles/new" element={<MotorcycleForm />} />
            <Route path="/admin/motorcycles/bulk" element={<BulkMotorcycleForm />} />
            <Route path="/admin/motorcycles/:id/edit" element={<MotorcycleForm />} />
            <Route path="/admin/orders" element={<OrderList />} />
            <Route path="/admin/coc-orders" element={<CocOrders />} />
            <Route path="/admin/dealers" element={<DealerManagement />} />
            <Route path="/admin/pending-foreign" element={<PendingForeignListings />} />
            <Route path="/admin/parts" element={<AdminParts />} />
            <Route path="/admin/part-orders" element={<AdminPartOrders />} />
            <Route path="/admin/license-plates" element={<AdminLicensePlates />} />
            <Route path="/admin/create-admin" element={<AdminCreateAdmin />} />
            <Route path="/admin/reset-password" element={<AdminResetPassword />} />
            <Route path="/admin/exchange-rate" element={<AdminExchangeRate />} />
            <Route path="/admin/bulk-email" element={<AdminBulkEmail />} />
            <Route path="/admin/whatsapp" element={<AdminWhatsAppBroadcast />} />
            <Route path="/admin/sms" element={<AdminSMSBroadcast />} />
            <Route path="/admin/taxatie" element={<TaxatieInvoices />} />
            <Route path="/admin/activity" element={<AdminActivity />} />
            <Route path="/admin/price-proposals" element={<AdminPriceProposals />} />
            <Route path="/admin/wanted-requests" element={<AdminWantedRequests />} />
            <Route path="/admin/google-motors" element={<AdminGoogleMotors />} />
            <Route path="/admin/taxatie-programma" element={<TaxatieProgramma />} />
            
            {/* Dealer Routes */}
            <Route path="/dealer" element={<DealerDashboard />} />
            <Route path="/dealer/orders" element={<DealerOrders />} />
            <Route path="/dealer/orders/archived" element={<DealerArchivedOrders />} />
            <Route path="/dealer/sell" element={<DealerSellMotorcycle />} />
            <Route path="/dealer/my-listings" element={<DealerMyListings />} />
            <Route path="/dealer/parts" element={<PartsShop />} />
            <Route path="/dealer/license-plates" element={<DealerLicensePlates />} />
            <Route path="/dealer/wanted-requests" element={<WantedRequestPage />} />
            <Route path="/dealer/google-motors" element={<DealerGoogleMotors />} />
            
            {/* Foreign Dealer Routes */}
            <Route path="/foreign-dealer" element={<ForeignDealerDashboard />} />
            <Route path="/foreign-dealer/add" element={<ForeignDealerAddMotorcycle />} />
            
            {/* Particulier Routes */}
            <Route path="/register/particulier" element={<ParticulierRegister />} />
            <Route path="/particulier" element={<ParticulierDashboard />} />
            <Route path="/particulier/nieuw" element={<ParticulierAddListing />} />
            <Route path="/particulier/success" element={<ParticulierSuccess />} />
            
            {/* Pakbon Routes */}
            <Route path="/pakbonnen" element={<PakbonDashboard />} />
            
            {/* Shared Routes - Motorcycle detail is PUBLIC */}
            <Route path="/motorcycle/:id" element={<MotorcycleDetail />} />
            <Route path="/motorcycles/:id" element={<MotorcycleDetail />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/pakbon/:orderId" element={<Pakbon />} />
            
            {/* Default Redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          <InstallPrompt />
          <WelcomePopup />
          <CocAnnouncementPopup />
        </BrowserRouter>
      </div>
      </DataRefreshProvider>
    </AuthProvider>
    </HelmetProvider>
  );
}

export default App;
