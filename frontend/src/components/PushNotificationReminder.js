import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, X, Smartphone, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
} from './ui/dialog';

const PushNotificationReminder = ({ isSubscribed, onEnableClick }) => {
  const { t } = useTranslation();
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the reminder before
    const dismissed = localStorage.getItem('pushReminderDismissed');
    const dismissedTime = localStorage.getItem('pushReminderDismissedTime');
    
    // Show reminder if:
    // 1. Not subscribed to push
    // 2. Not dismissed, OR dismissed more than 24 hours ago
    if (!isSubscribed) {
      if (!dismissed) {
        // First time - show after 3 seconds
        const timer = setTimeout(() => {
          setShowReminder(true);
        }, 3000);
        return () => clearTimeout(timer);
      } else if (dismissedTime) {
        // Check if 24 hours have passed
        const timeDiff = Date.now() - parseInt(dismissedTime);
        const hoursPassed = timeDiff / (1000 * 60 * 60);
        if (hoursPassed > 24) {
          const timer = setTimeout(() => {
            setShowReminder(true);
          }, 5000);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [isSubscribed]);

  const handleDismiss = () => {
    setShowReminder(false);
    localStorage.setItem('pushReminderDismissed', 'true');
    localStorage.setItem('pushReminderDismissedTime', Date.now().toString());
  };

  const handleEnable = () => {
    setShowReminder(false);
    onEnableClick();
  };

  if (isSubscribed) return null;

  return (
    <Dialog open={showReminder} onOpenChange={setShowReminder}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white relative">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <Bell className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {t('pushReminder.title') || 'Mis niets!'}
              </h2>
              <p className="text-red-100 mt-1">
                {t('pushReminder.subtitle') || 'Schakel meldingen in'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-zinc-600 mb-4">
            {t('pushReminder.message') || 'Ontvang direct een melding wanneer:'}
          </p>
          
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
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDismiss}
            >
              {t('pushReminder.later') || 'Later'}
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={handleEnable}
            >
              <Bell className="w-4 h-4 mr-2" />
              {t('pushReminder.enable') || 'Inschakelen'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PushNotificationReminder;
