import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, X, Smartphone, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
} from './ui/dialog';

const PushNotificationReminder = ({ isSubscribed, onEnableClick }) => {
  const { t } = useTranslation();
  const [showReminder, setShowReminder] = useState(false);
  const [dismissCount, setDismissCount] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Check if notification permission is already granted
  useEffect(() => {
    if ('Notification' in window) {
      setPermissionGranted(Notification.permission === 'granted');
    }
  }, []);

  useEffect(() => {
    // Get dismiss count from localStorage
    const count = parseInt(localStorage.getItem('pushReminderDismissCount') || '0');
    setDismissCount(count);
    
    // Don't show if subscribed OR if permission is already granted
    if (!isSubscribed && !permissionGranted) {
      const timer = setTimeout(() => {
        setShowReminder(true);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setShowReminder(false);
    }
  }, [isSubscribed, permissionGranted]);

  // Show reminder again after dismissing (every 60 seconds instead of 30)
  useEffect(() => {
    if (!isSubscribed && !permissionGranted && !showReminder) {
      const timer = setTimeout(() => {
        // Double-check permission before showing again
        if ('Notification' in window && Notification.permission === 'granted') {
          setPermissionGranted(true);
          return;
        }
        setShowReminder(true);
      }, 60000); // 60 seconds
      return () => clearTimeout(timer);
    }
  }, [isSubscribed, permissionGranted, showReminder]);

  const handleDismiss = () => {
    const newCount = dismissCount + 1;
    setDismissCount(newCount);
    localStorage.setItem('pushReminderDismissCount', newCount.toString());
    setShowReminder(false);
  };

  const handleEnable = () => {
    setShowReminder(false);
    localStorage.setItem('pushReminderDismissCount', '0'); // Reset count on enable
    onEnableClick();
  };

  if (isSubscribed) return null;

  // After 3 dismisses, show more urgent message without Later button
  const isUrgent = dismissCount >= 3;

  return (
    <Dialog open={showReminder} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="max-w-md p-0 overflow-hidden" hideCloseButton={isUrgent}>
        {/* Header with gradient */}
        <div className={`${isUrgent ? 'bg-gradient-to-r from-amber-500 to-red-600' : 'bg-gradient-to-r from-red-600 to-red-700'} p-6 text-white relative`}>
          {!isUrgent && (
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              {isUrgent ? (
                <AlertTriangle className="w-8 h-8 text-white" />
              ) : (
                <Bell className="w-8 h-8 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {isUrgent ? 'Push Verplicht!' : (t('pushReminder.title') || 'Mis niets!')}
              </h2>
              <p className="text-white/90 mt-1">
                {isUrgent 
                  ? 'U moet meldingen inschakelen om te kunnen bestellen' 
                  : (t('pushReminder.subtitle') || 'Schakel meldingen in')}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {isUrgent ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <p className="text-amber-800 font-medium">
                ⚠️ Zonder push meldingen kunt u geen nieuwe motoren zien en mist u aanbiedingen!
              </p>
            </div>
          ) : (
            <p className="text-zinc-600 mb-4">
              {t('pushReminder.message') || 'Ontvang direct een melding wanneer:'}
            </p>
          )}
          
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-zinc-700">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span>{t('pushReminder.benefit1') || 'Er nieuwe motoren beschikbaar zijn'}</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-700">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span>{t('pushReminder.benefit2') || 'Uw bestelling is bijgewerkt'}</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-700">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span>{t('pushReminder.benefit3') || 'Er een nieuw kenteken voor u is'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg mb-6">
            <Smartphone className="w-5 h-5 text-blue-600" />
            <p className="text-sm text-blue-700">
              {t('pushReminder.deviceNote') || 'Werkt op telefoon, tablet én computer'}
            </p>
          </div>

          <div className="flex gap-3">
            {!isUrgent && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDismiss}
              >
                {t('pushReminder.later') || 'Later'}
              </Button>
            )}
            <Button
              className={`${isUrgent ? 'w-full' : 'flex-1'} bg-red-600 hover:bg-red-700`}
              onClick={handleEnable}
            >
              <Bell className="w-4 h-4 mr-2" />
              {t('pushReminder.enable') || 'Inschakelen'}
            </Button>
          </div>
          
          {isUrgent && (
            <p className="text-xs text-zinc-400 text-center mt-4">
              Klik op "Inschakelen" en dan op "Toestaan" in de browser popup
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PushNotificationReminder;
