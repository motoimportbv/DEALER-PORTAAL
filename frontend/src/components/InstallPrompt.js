import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Download, X, Share, Plus } from 'lucide-react';

const InstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isIPad, setIsIPad] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }
    
    // Check if running in standalone on iOS
    if (window.navigator.standalone === true) {
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

    // Detect iOS/iPadOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    
    setIsIOS(isIOSDevice || isIPadOS);
    setIsIPad(isIPadOS || /iPad/.test(navigator.userAgent));

    if (isIOSDevice || isIPadOS) {
      // Show iOS install instructions after a delay
      setTimeout(() => setShowPrompt(true), 2000);
      return;
    }

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 2000);
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

  // iOS Share icon SVG
  const ShareIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8.59 13.51L15.42 17.49M15.41 6.51L8.59 10.49M21 5C21 6.65685 19.6569 8 18 8C16.3431 8 15 6.65685 15 5C15 3.34315 16.3431 2 18 2C19.6569 2 21 3.34315 21 5ZM9 12C9 13.6569 7.65685 15 6 15C4.34315 15 3 13.6569 3 12C3 10.3431 4.34315 9 6 9C7.65685 9 9 10.3431 9 12ZM21 19C21 20.6569 19.6569 22 18 22C16.3431 22 15 20.6569 15 19C15 17.3431 16.3431 16 18 16C19.6569 16 21 17.3431 21 19Z" />
    </svg>
  );

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-96 bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden z-50 animate-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Download className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">
              Installeer Moto Import
            </h3>
            <p className="text-white/80 text-xs">
              {isIPad ? 'Op uw iPad' : isIOS ? 'Op uw iPhone' : 'Op uw apparaat'}
            </p>
          </div>
        </div>
        <button 
          onClick={handleDismiss}
          className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Sluiten"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {isIOS ? (
          <>
            {!showIOSSteps ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-600">
                  Voeg Moto Import toe aan uw beginscherm voor snelle toegang, ook offline.
                </p>
                <Button 
                  onClick={() => setShowIOSSteps(true)}
                  className="w-full bg-red-600 hover:bg-red-700 h-11 text-sm font-semibold"
                >
                  Toon Instructies
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 font-bold text-sm">1</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-zinc-700 font-medium">
                      Tik op het Deel icoon
                    </p>
                    <div className="mt-2 flex items-center gap-2 bg-zinc-100 rounded-lg px-3 py-2">
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                          <polyline points="16 6 12 2 8 6" />
                          <line x1="12" y1="2" x2="12" y2="15" />
                        </svg>
                      </div>
                      <span className="text-xs text-zinc-600">Onderaan Safari</span>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 font-bold text-sm">2</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-zinc-700 font-medium">
                      Scroll naar beneden en tik op:
                    </p>
                    <div className="mt-2 flex items-center gap-2 bg-zinc-100 rounded-lg px-3 py-2">
                      <div className="w-8 h-8 bg-zinc-200 rounded-lg flex items-center justify-center">
                        <Plus className="w-5 h-5 text-zinc-700" />
                      </div>
                      <span className="text-sm font-medium text-zinc-700">Zet op beginscherm</span>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 font-bold text-sm">3</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-zinc-700 font-medium">
                      Tik op <span className="text-blue-500 font-semibold">"Voeg toe"</span> rechtsboven
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-100">
                  <p className="text-xs text-zinc-500 text-center">
                    Daarna vindt u Moto Import op uw beginscherm
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">
              Installeer de app voor snelle toegang en offline functionaliteit.
            </p>
            <Button 
              onClick={handleInstall}
              className="w-full bg-red-600 hover:bg-red-700 h-11 text-sm font-semibold"
            >
              <Download className="w-4 h-4 mr-2" />
              Nu Installeren
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstallPrompt;
