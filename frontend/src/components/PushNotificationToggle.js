import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Bell, BellOff, Check } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const PushNotificationToggle = ({ token }) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState('default');

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
      const permission = await Notification.requestPermission();
      setPermission(permission);
      
      if (permission !== 'granted') {
        toast.error('U heeft notificaties geweigerd. Schakel deze in via uw browserinstellingen.');
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
      toast.success('Push notificaties ingeschakeld! U ontvangt nu meldingen bij nieuwe motoren.');
    } catch (error) {
      console.error('Error subscribing:', error);
      toast.error('Kon push notificaties niet inschakelen');
    } finally {
      setIsLoading(false);
    }
  };

  const testPush = async () => {
    try {
      const response = await axios.get(`${API}/api/push/test`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        toast.success('Test notificatie verzonden! Check uw telefoon.');
      } else {
        // Show detailed error
        toast.error(response.data.error || 'Test mislukt');
        console.error('Push test error:', response.data.error);
      }
    } catch (error) {
      console.error('Test push error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Kon test niet uitvoeren';
      toast.error(errorMsg);
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
      toast.success('Push notificaties uitgeschakeld');
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error('Kon push notificaties niet uitschakelen');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-lg border border-zinc-200">
      <div className="flex-1">
        <h4 className="font-medium text-zinc-900 flex items-center gap-2">
          <Bell className="w-4 h-4 text-red-600" />
          Push Notificaties
        </h4>
        <p className="text-sm text-zinc-500 mt-1">
          {isSubscribed 
            ? 'U ontvangt meldingen bij nieuwe motoren'
            : 'Ontvang direct een melding op uw telefoon'}
        </p>
      </div>
      
      {isSubscribed ? (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={testPush}
            className="text-green-600 border-green-600 hover:bg-green-50"
          >
            Test
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={unsubscribe}
            disabled={isLoading}
            className="text-zinc-600"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <BellOff className="w-4 h-4 mr-2" />
                Uit
              </>
            )}
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          onClick={subscribe}
          disabled={isLoading}
          className="bg-red-600 hover:bg-red-700"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Bell className="w-4 h-4 mr-2" />
              Inschakelen
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default PushNotificationToggle;
