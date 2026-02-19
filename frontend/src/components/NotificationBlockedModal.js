import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Bell, Settings, Chrome, Smartphone, Monitor, ExternalLink, CheckCircle2 } from 'lucide-react';

const NotificationBlockedModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  
  // Detect browser type
  const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent) && !/SamsungBrowser/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  const isFirefox = /Firefox/.test(navigator.userAgent);
  const isEdge = /Edg/.test(navigator.userAgent);
  const isSamsungBrowser = /SamsungBrowser/.test(navigator.userAgent);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  const getBrowserName = () => {
    if (isSamsungBrowser) return 'Samsung Internet';
    if (isChrome) return 'Chrome';
    if (isSafari) return 'Safari';
    if (isFirefox) return 'Firefox';
    if (isEdge) return 'Edge';
    return t('pushBlocked.browser');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="notification-blocked-modal">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <Bell className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-zinc-900">
                {t('pushBlocked.title')}
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-500">
                {t('pushBlocked.subtitle')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Explanation */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              {t('pushBlocked.explanation')}
            </p>
          </div>

          {/* Instructions based on device/browser */}
          <div className="space-y-3">
            <h4 className="font-medium text-zinc-900 flex items-center gap-2">
              {isMobile ? (
                <Smartphone className="w-4 h-4 text-red-600" />
              ) : (
                <Monitor className="w-4 h-4 text-red-600" />
              )}
              {t('pushBlocked.stepsFor', { browser: getBrowserName() })}
            </h4>

            {/* Desktop Chrome/Edge Instructions */}
            {!isMobile && (isChrome || isEdge) && (
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <div>
                    <p className="font-medium text-zinc-900">{t('pushBlocked.chrome.step1Title')}</p>
                    <p className="text-zinc-600 mt-1">{t('pushBlocked.chrome.step1Desc')}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <div>
                    <p className="font-medium text-zinc-900">{t('pushBlocked.chrome.step2Title')}</p>
                    <p className="text-zinc-600 mt-1">{t('pushBlocked.chrome.step2Desc')}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <div>
                    <p className="font-medium text-zinc-900">{t('pushBlocked.chrome.step3Title')}</p>
                    <p className="text-zinc-600 mt-1">{t('pushBlocked.chrome.step3Desc')}</p>
                  </div>
                </li>
              </ol>
            )}

            {/* Desktop Safari Instructions */}
            {!isMobile && isSafari && (
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <div>
                    <p className="font-medium text-zinc-900">{t('pushBlocked.safari.step1Title')}</p>
                    <p className="text-zinc-600 mt-1">{t('pushBlocked.safari.step1Desc')}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <div>
                    <p className="font-medium text-zinc-900">{t('pushBlocked.safari.step2Title')}</p>
                    <p className="text-zinc-600 mt-1">{t('pushBlocked.safari.step2Desc')}</p>
                  </div>
                </li>
              </ol>
            )}

            {/* Desktop Firefox Instructions */}
            {!isMobile && isFirefox && (
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <div>
                    <p className="font-medium text-zinc-900">{t('pushBlocked.firefox.step1Title')}</p>
                    <p className="text-zinc-600 mt-1">{t('pushBlocked.firefox.step1Desc')}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <div>
                    <p className="font-medium text-zinc-900">{t('pushBlocked.firefox.step2Title')}</p>
                    <p className="text-zinc-600 mt-1">{t('pushBlocked.firefox.step2Desc')}</p>
                  </div>
                </li>
              </ol>
            )}

            {/* iOS Mobile Instructions */}
            {isIOS && (
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <div>
                    <p className="font-medium text-zinc-900">{t('pushBlocked.ios.step1Title')}</p>
                    <p className="text-zinc-600 mt-1">{t('pushBlocked.ios.step1Desc')}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <div>
                    <p className="font-medium text-zinc-900">{t('pushBlocked.ios.step2Title')}</p>
                    <p className="text-zinc-600 mt-1">{t('pushBlocked.ios.step2Desc')}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <div>
                    <p className="font-medium text-zinc-900">{t('pushBlocked.ios.step3Title')}</p>
                    <p className="text-zinc-600 mt-1">{t('pushBlocked.ios.step3Desc')}</p>
                  </div>
                </li>
              </ol>
            )}

            {/* Android Mobile Instructions */}
            {isAndroid && !isSamsungBrowser && (
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <div>
                    <p className="font-medium text-zinc-900">{t('pushBlocked.android.step1Title')}</p>
                    <p className="text-zinc-600 mt-1">{t('pushBlocked.android.step1Desc')}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <div>
                    <p className="font-medium text-zinc-900">{t('pushBlocked.android.step2Title')}</p>
                    <p className="text-zinc-600 mt-1">{t('pushBlocked.android.step2Desc')}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <div>
                    <p className="font-medium text-zinc-900">{t('pushBlocked.android.step3Title')}</p>
                    <p className="text-zinc-600 mt-1">{t('pushBlocked.android.step3Desc')}</p>
                  </div>
                </li>
              </ol>
            )}

            {/* Samsung Internet Browser Instructions */}
            {isSamsungBrowser && (
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <div>
                    <p className="font-medium text-zinc-900">Open Samsung Internet Instellingen</p>
                    <p className="text-zinc-600 mt-1">Tik op het menu (☰) → Instellingen → Sites en downloads</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <div>
                    <p className="font-medium text-zinc-900">Ga naar Meldingen</p>
                    <p className="text-zinc-600 mt-1">Tik op "Meldingen" of "Notifications"</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                  <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <div>
                    <p className="font-medium text-zinc-900">Sta meldingen toe voor deze site</p>
                    <p className="text-zinc-600 mt-1">Zoek "motoimportbv.nl" en zet meldingen aan, of verwijder de blokkade</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">💡</span>
                  <div>
                    <p className="font-medium text-blue-900">Alternatief: Gebruik Chrome</p>
                    <p className="text-blue-700 mt-1">Push notificaties werken het beste in Google Chrome. Open de site in Chrome voor de beste ervaring.</p>
                  </div>
                </li>
              </ol>
            )}
          </div>

          {/* Final step */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">
              {t('pushBlocked.finalStep')}
            </p>
          </div>

          {/* Action Button */}
          <Button 
            onClick={onClose} 
            className="w-full bg-red-600 hover:bg-red-700"
            data-testid="notification-blocked-close-btn"
          >
            {t('pushBlocked.understood')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationBlockedModal;
