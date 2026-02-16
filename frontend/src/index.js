import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Service Worker Registration with auto-update for iOS
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        updateViaCache: 'none' // Important for iOS - don't use HTTP cache
      });
      
      console.log('[App] Service Worker registered');
      
      // Check for updates immediately
      registration.update();
      
      // Check for updates every 60 seconds
      setInterval(() => {
        registration.update();
      }, 60000);
      
      // Handle new service worker available
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('[App] New service worker found');
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content available - skip waiting and activate immediately
            console.log('[App] New content available, activating...');
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
      
      // Reload page when new service worker takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('[App] New service worker active, reloading...');
          window.location.reload();
        }
      });
      
    } catch (error) {
      console.error('[App] Service Worker registration failed:', error);
    }
  });
}
