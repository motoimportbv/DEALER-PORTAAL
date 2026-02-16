import React, { useEffect } from "react";
import "@/App.css";
import "./i18n"; // Initialize i18n
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { initializeNativeFeatures, isNative } from "./services/nativeService";
import InstallPrompt from "./components/InstallPrompt";

// Pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import SupplierRegisterPage from "./pages/SupplierRegisterPage";
import SupplierGuide from "./pages/SupplierGuide";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import MotorcycleList from "./pages/admin/MotorcycleList";
import MotorcycleForm from "./pages/admin/MotorcycleForm";
import OrderList from "./pages/admin/OrderList";
import DealerManagement from "./pages/admin/DealerManagement";
import PendingForeignListings from "./pages/admin/PendingForeignListings";
import DealerDashboard from "./pages/dealer/DealerDashboard";
import DealerOrders from "./pages/dealer/DealerOrders";
import DealerSellMotorcycle from "./pages/dealer/DealerSellMotorcycle";
import DealerMyListings from "./pages/dealer/DealerMyListings";
import ForeignDealerDashboard from "./pages/foreign-dealer/ForeignDealerDashboard";
import ForeignDealerAddMotorcycle from "./pages/foreign-dealer/ForeignDealerAddMotorcycle";
import MotorcycleDetail from "./pages/MotorcycleDetail";
import PaymentSuccess from "./pages/PaymentSuccess";
import Pakbon from "./pages/Pakbon";

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
        // Navigate to the URL from the notification
        const url = new URL(event.data.url);
        if (url.origin === window.location.origin) {
          window.location.href = url.pathname + url.search;
        }
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
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/register/supplier" element={<SupplierRegisterPage />} />
            <Route path="/supplier-guide" element={<SupplierGuide />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/motorcycles" element={<MotorcycleList />} />
            <Route path="/admin/motorcycles/new" element={<MotorcycleForm />} />
            <Route path="/admin/motorcycles/:id/edit" element={<MotorcycleForm />} />
            <Route path="/admin/orders" element={<OrderList />} />
            <Route path="/admin/dealers" element={<DealerManagement />} />
            <Route path="/admin/pending-foreign" element={<PendingForeignListings />} />
            
            {/* Dealer Routes */}
            <Route path="/dealer" element={<DealerDashboard />} />
            <Route path="/dealer/orders" element={<DealerOrders />} />
            <Route path="/dealer/sell" element={<DealerSellMotorcycle />} />
            <Route path="/dealer/my-listings" element={<DealerMyListings />} />
            
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
