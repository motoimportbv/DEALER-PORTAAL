import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Download, X, Plus, Smartphone } from 'lucide-react';

const InstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true;
    setIsStandalone(standalone);
    
    if (standalone) {
      return;
    }

    // Check if dismissed recently (only 1 day for iOS to encourage installation)
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const dayInMs = 24 * 60 * 60 * 1000;
      // iOS: show again after 1 day, others: 7 days
      const waitDays = isIOS ? 1 : 7;
      if (Date.now() - dismissedTime < dayInMs * waitDays) {
        return;
      }
    }

    // Detect iOS/iPadOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    
    setIsIOS(isIOSDevice || isIPadOS);

    if (isIOSDevice || isIPadOS) {
      // Show iOS install instructions immediately for iOS
      setTimeout(() => setShowPrompt(true), 1000);
      return;
    }

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 1500);
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

  // Don't show if already installed or prompt not ready
  if (!showPrompt || isStandalone) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 animate-in fade-in"
        onClick={handleDismiss}
      />
      
      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[400px] bg-white rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 slide-in-from-bottom-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-5 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                <Smartphone className="w-7 h-7 text-red-600" />
              </div>
              <div>
                <h3 className="font-barlow text-xl font-bold text-white uppercase tracking-wide">
                  Installeer App
                </h3>
                <p className="text-white/80 text-sm">
                  Moto Import op uw {isIOS ? 'iPhone' : 'apparaat'}
                </p>
              </div>
            </div>
            <button 
              onClick={handleDismiss}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Sluiten"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-5">
          {isIOS ? (
            <div className="space-y-5">
              <p className="text-zinc-600 text-center">
                Voeg Moto Import toe aan uw beginscherm voor de beste ervaring!
              </p>
              
              {/* Step 1 */}
              <div className="flex gap-4 items-start p-4 bg-zinc-50 rounded-xl">
                <div className="flex-shrink-0 w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">
                  1
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-zinc-800 mb-2">
                    Tik op het Deel icoon
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                        <polyline points="16 6 12 2 8 6" />
                        <line x1="12" y1="2" x2="12" y2="15" />
                      </svg>
                    </div>
                    <span className="text-sm text-zinc-500">Onderaan in Safari</span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4 items-start p-4 bg-zinc-50 rounded-xl">
                <div className="flex-shrink-0 w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">
                  2
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-zinc-800 mb-2">
                    Tik op "Zet op beginscherm"
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-zinc-200 rounded-lg flex items-center justify-center">
                      <Plus className="w-6 h-6 text-zinc-700" />
                    </div>
                    <span className="text-sm text-zinc-500">Scroll naar beneden in het menu</span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4 items-start p-4 bg-zinc-50 rounded-xl">
                <div className="flex-shrink-0 w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">
                  3
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-zinc-800">
                    Tik op <span className="text-blue-500">"Voeg toe"</span>
                  </p>
                  <span className="text-sm text-zinc-500">Rechtsboven in het scherm</span>
                </div>
              </div>

              <div className="text-center pt-2">
                <p className="text-sm text-green-600 font-medium">
                  ✓ Daarna opent de app als een echte app!
                </p>
              </div>

              <Button 
                onClick={handleDismiss}
                variant="outline"
                className="w-full h-12"
              >
                Ik snap het
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-zinc-600 text-center">
                Installeer de Moto Import app voor snelle toegang en offline functionaliteit.
              </p>
              
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="text-sm text-green-800">
                  <p className="font-medium">Voordelen:</p>
                  <p>Sneller laden, werkt offline, meldingen</p>
                </div>
              </div>

              <Button 
                onClick={handleInstall}
                className="w-full bg-red-600 hover:bg-red-700 h-12 text-base font-semibold"
              >
                <Download className="w-5 h-5 mr-2" />
                Nu Installeren
              </Button>
              
              <Button 
                onClick={handleDismiss}
                variant="ghost"
                className="w-full"
              >
                Later
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default InstallPrompt;
