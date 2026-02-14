import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Download, X } from 'lucide-react';

const InstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const dayInMs = 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < dayInMs * 7) {
        return; // Don't show for 7 days after dismiss
      }
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // Show iOS install instructions after a delay
      setTimeout(() => setShowPrompt(true), 3000);
      return;
    }

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-6 md:w-80 bg-white rounded-xl shadow-2xl border border-zinc-200 p-4 z-50 animate-in slide-in-from-bottom-4">
      <button 
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-zinc-400 hover:text-zinc-600"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Download className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-barlow font-bold text-zinc-900 uppercase text-sm">
            Installeer Moto Import
          </h3>
          {isIOS ? (
            <p className="text-xs text-zinc-500 mt-1">
              Tik op <span className="inline-flex items-center px-1 bg-zinc-100 rounded">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L12 14M12 14L8 10M12 14L16 10M4 18L4 20L20 20L20 18"/>
                </svg>
              </span> en dan "Zet op beginscherm"
            </p>
          ) : (
            <p className="text-xs text-zinc-500 mt-1">
              Voeg toe aan uw beginscherm voor snelle toegang
            </p>
          )}
        </div>
      </div>
      
      {!isIOS && (
        <Button 
          onClick={handleInstall}
          className="w-full mt-3 bg-red-600 hover:bg-red-700 h-9 text-sm"
        >
          <Download className="w-4 h-4 mr-2" />
          Installeren
        </Button>
      )}
    </div>
  );
};

export default InstallPrompt;
