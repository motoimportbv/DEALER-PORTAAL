import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Bell, BellOff, Check, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import NotificationBlockedModal from './NotificationBlockedModal';

const API = process.env.REACT_APP_BACKEND_URL;

const PushNotificationToggle = ({ token }) => {
  const { t } = useTranslation();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState('default');
  const [showBlockedModal, setShowBlockedModal] = useState(false);

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
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
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
      toast.success(t('pushNotifications.enabled'));
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
        // Server detected invalid subscription and removed it
        toast.info('Push notificaties opnieuw instellen...');
        setIsSubscribed(false);
        // Auto resubscribe after short delay
        setTimeout(() => subscribe(), 1000);
      } else {
        // Check for VAPID key mismatch error
        const errorMsg = response.data.error || '';
        const debug = response.data.debug;
        
        if (errorMsg.includes('VapidPkHashMismatch') || errorMsg.includes('400')) {
          toast.error('Push keys gewijzigd. Even opnieuw inschakelen...');
          await resubscribe();
          return;
        }
        
        toast.error(errorMsg || t('pushNotifications.testError'));
        if (debug) {
          console.log('Debug info:', debug);
          if (!debug.has_valid_keys) {
            toast.error(t('pushNotifications.invalidKeys'));
          }
        }
      }
    } catch (error) {
      console.error('Test push error:', error);
      const errorMsg = error.response?.data?.error || error.message || '';
      
      // Check for VAPID mismatch in error response
      if (errorMsg.includes('VapidPkHashMismatch') || errorMsg.includes('400')) {
        toast.error('Push keys gewijzigd. Even opnieuw inschakelen...');
        await resubscribe();
        return;
      }
      
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

  return (
    <>
      <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-lg border border-zinc-200" data-testid="push-notification-toggle">
        <div className="flex-1">
          <h4 className="font-medium text-zinc-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-red-600" />
            {t('pushNotifications.title')}
          </h4>
          <p className="text-sm text-zinc-500 mt-1">
            {isSubscribed 
              ? t('pushNotifications.subscribedMessage')
              : t('pushNotifications.unsubscribedMessage')}
          </p>
          {/* Show help link when permission is denied */}
          {permission === 'denied' && !isSubscribed && (
            <button
              onClick={() => setShowBlockedModal(true)}
              className="text-sm text-amber-600 hover:text-amber-700 underline mt-1 flex items-center gap-1"
              data-testid="push-notification-help-btn"
            >
              <HelpCircle className="w-3 h-3" />
              {t('pushNotifications.howToEnable')}
            </button>
          )}
        </div>
        
        {isSubscribed ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={testPush}
              className="text-green-600 border-green-600 hover:bg-green-50"
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
        ) : (
          <div className="flex gap-2">
            {/* Show help button when blocked */}
            {permission === 'denied' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBlockedModal(true)}
                className="text-amber-600 border-amber-400 hover:bg-amber-50"
                data-testid="push-notification-blocked-help-btn"
              >
                <HelpCircle className="w-4 h-4 mr-1" />
                {t('pushNotifications.howToEnable')}
              </Button>
            )}
            <Button
              size="sm"
              onClick={subscribe}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
              data-testid="push-notification-enable-btn"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Bell className="w-4 h-4 mr-2" />
                  {t('pushNotifications.enable')}
                </>
              )}
            </Button>
          </div>
        )}
      </div>
      
      {/* Blocked Notifications Help Modal */}
      <NotificationBlockedModal 
        isOpen={showBlockedModal} 
        onClose={() => setShowBlockedModal(false)} 
      />
    </>
  );
};

export default PushNotificationToggle;
