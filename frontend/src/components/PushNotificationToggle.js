import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Bell, BellOff, Check, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import NotificationBlockedModal from './NotificationBlockedModal';
import BackgroundPermissionModal from './BackgroundPermissionModal';

const API = process.env.REACT_APP_BACKEND_URL;

const PushNotificationToggle = ({ token }) => {
  const { t } = useTranslation();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState('default');
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);

  useEffect(() => {
    // Check if push notifications are supported
    const checkSupport = () => {
      const supported = 'serviceWorker' in navigator && 
                       'PushManager' in window && 
                       'Notification' in window;
      setIsSupported(supported);
      
      if (supported) {
        setPermission(Notification.permission);
        checkSubscription();
      }
    };
    
    checkSupport();
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Browser has subscription - verify it's also on server
        try {
          const response = await axios.get(`${API}/api/push/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setIsSubscribed(response.data.subscribed);
        } catch (e) {
          // If server check fails, trust browser state
          setIsSubscribed(true);
        }
      } else {
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setIsSubscribed(false);
    }
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribe = async () => {
    setIsLoading(true);
    try {
      // Request notification permission
      const currentPermission = await Notification.requestPermission();
      setPermission(currentPermission);
      
      if (currentPermission !== 'granted') {
        toast.error(t('pushNotifications.denied'));
        // Show the help modal when permission is denied
        setShowBlockedModal(true);
        return;
      }

      // Get VAPID public key from server
      const vapidResponse = await axios.get(`${API}/api/push/vapid-key`);
      const vapidKey = vapidResponse.data.vapidKey;

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });

      // Send subscription to server
      await axios.post(`${API}/api/push/subscribe`, {
        subscription: subscription.toJSON()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setIsSubscribed(true);
      localStorage.setItem('pushNotificationsEnabled', 'true'); // Store flag for reminder check
      toast.success(t('pushNotifications.enabled'));
      
      // Show background permission modal if not already accepted
      const hasAcceptedBackground = localStorage.getItem('backgroundPermissionAccepted');
      if (!hasAcceptedBackground) {
        setTimeout(() => {
          setShowBackgroundModal(true);
        }, 1000);
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      toast.error(t('pushNotifications.enableError'));
    } finally {
      setIsLoading(false);
    }
  };

  const testPush = async () => {
    try {
      const response = await axios.get(`${API}/api/push/test`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Push test response:', response.data);
      
      if (response.data.success) {
        toast.success(t('pushNotifications.testSent'));
      } else if (response.data.needs_resubscribe) {
        // Server detected invalid subscription - show manual instructions
        toast.error('Subscription ongeldig. Klik op "Uit" en dan "Inschakelen".');
        setIsSubscribed(false);
      } else {
        const errorMsg = response.data.error || '';
        toast.error(errorMsg || t('pushNotifications.testError'));
      }
    } catch (error) {
      console.error('Test push error:', error);
      const errorMsg = error.response?.data?.error || error.message || '';
      toast.error(errorMsg || t('pushNotifications.testError'));
    }
  };

  const resubscribe = async () => {
    // First unsubscribe the old subscription
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        console.log('Old subscription removed');
      }

      // Remove from server
      try {
        await axios.delete(`${API}/api/push/subscribe`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {
        // Ignore if not found on server
      }

      // Now subscribe with new key
      const vapidResponse = await axios.get(`${API}/api/push/vapid-key`);
      const vapidKey = vapidResponse.data.vapidKey;

      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });

      await axios.post(`${API}/api/push/subscribe`, {
        subscription: newSubscription.toJSON()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setIsSubscribed(true);
      toast.success('Push notificaties opnieuw ingeschakeld!');
    } catch (error) {
      console.error('Resubscribe error:', error);
      setIsSubscribed(false);
      toast.error('Kon niet opnieuw inschakelen. Probeer handmatig.');
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }

      // Remove from server
      await axios.delete(`${API}/api/push/subscribe`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setIsSubscribed(false);
      localStorage.removeItem('pushNotificationsEnabled'); // Remove flag
      toast.success(t('pushNotifications.disabled'));
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error(t('pushNotifications.disableError'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return null;
  }

  // Show prominent banner when not subscribed
  if (!isSubscribed) {
    return (
      <>
        <div 
          className="relative overflow-hidden rounded-xl border-2 border-red-500 bg-gradient-to-r from-red-50 to-orange-50 p-6 shadow-lg animate-pulse-subtle"
          data-testid="push-notification-toggle"
        >
          {/* Decorative background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-100 rounded-full translate-y-1/2 -translate-x-1/2 opacity-50" />
          
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Icon with animation */}
            <div className="flex-shrink-0 w-16 h-16 bg-red-600 rounded-full flex items-center justify-center animate-bounce-slow shadow-lg">
              <Bell className="w-8 h-8 text-white" />
            </div>
            
            <div className="flex-1">
              <h4 className="font-bold text-xl text-zinc-900 flex items-center gap-2">
                🔔 {t('pushNotifications.title')}
                <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {t('pushNotifications.important') || 'Belangrijk'}
                </span>
              </h4>
              <p className="text-base text-zinc-700 mt-2">
                {t('pushNotifications.unsubscribedMessage')}
              </p>
              <p className="text-sm text-zinc-500 mt-1">
                {t('pushNotifications.missNothing') || 'Mis geen nieuwe motoren of updates van uw bestellingen!'}
              </p>
              
              {permission === 'denied' && (
                <button
                  onClick={() => setShowBlockedModal(true)}
                  className="text-sm text-amber-600 hover:text-amber-700 underline mt-2 flex items-center gap-1"
                  data-testid="push-notification-help-btn"
                >
                  <HelpCircle className="w-4 h-4" />
                  {t('pushNotifications.howToEnable')}
                </button>
              )}
            </div>
            
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              {permission === 'denied' ? (
                <Button
                  onClick={() => setShowBlockedModal(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 text-lg shadow-lg"
                  data-testid="push-notification-blocked-help-btn"
                >
                  <HelpCircle className="w-5 h-5 mr-2" />
                  {t('pushNotifications.howToEnable')}
                </Button>
              ) : (
                <Button
                  onClick={subscribe}
                  disabled={isLoading}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 text-lg shadow-lg transform hover:scale-105 transition-transform"
                  data-testid="push-notification-enable-btn"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Bell className="w-5 h-5 mr-2" />
                      {t('pushNotifications.enableNow') || 'Nu Inschakelen'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
        
        <NotificationBlockedModal 
          isOpen={showBlockedModal} 
          onClose={() => setShowBlockedModal(false)} 
        />
      </>
    );
  }

  // Compact view when already subscribed
  return (
    <>
      <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200" data-testid="push-notification-toggle">
        <div className="flex-1">
          <h4 className="font-medium text-green-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            {t('pushNotifications.title')}
          </h4>
          <p className="text-sm text-green-600 mt-1">
            {t('pushNotifications.subscribedMessage')}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={testPush}
            className="text-green-600 border-green-600 hover:bg-green-100"
            data-testid="push-notification-test-btn"
          >
            {t('pushNotifications.test')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={unsubscribe}
            disabled={isLoading}
            className="text-zinc-600"
            data-testid="push-notification-disable-btn"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <BellOff className="w-4 h-4 mr-2" />
                {t('pushNotifications.disable')}
              </>
            )}
          </Button>
        </div>
      </div>
      
      <NotificationBlockedModal 
        isOpen={showBlockedModal} 
        onClose={() => setShowBlockedModal(false)} 
      />
      
      <BackgroundPermissionModal 
        isOpen={showBackgroundModal} 
        onClose={() => setShowBackgroundModal(false)}
        onAccept={() => {
          toast.success('Instellingen opgeslagen!');
        }}
      />
    </>
  );
};

export default PushNotificationToggle;
