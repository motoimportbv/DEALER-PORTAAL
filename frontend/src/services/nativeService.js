import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

// Check if we're running on a native platform
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'ios', 'android', or 'web'

// Initialize native features
export const initializeNativeFeatures = async () => {
  if (!isNative) {
    console.log('Running in web mode - native features disabled');
    return;
  }

  try {
    // Hide splash screen after app is ready
    await SplashScreen.hide();

    // Set status bar style
    await StatusBar.setStyle({ style: Style.Dark });
    
    if (platform === 'android') {
      await StatusBar.setBackgroundColor({ color: '#18181b' });
    }

    // Setup push notifications
    await setupPushNotifications();

    // Handle app URL open (deep links)
    App.addListener('appUrlOpen', (data) => {
      console.log('App opened with URL:', data.url);
      // Handle deep links here if needed
    });

    // Handle back button on Android
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    console.log('Native features initialized successfully');
  } catch (error) {
    console.error('Error initializing native features:', error);
  }
};

// Setup push notifications
export const setupPushNotifications = async () => {
  if (!isNative) return null;

  try {
    // Request permission
    const permissionStatus = await PushNotifications.requestPermissions();
    
    if (permissionStatus.receive === 'granted') {
      // Register with Apple/Google
      await PushNotifications.register();
    } else {
      console.log('Push notification permission denied');
      return null;
    }

    // Handle registration success
    PushNotifications.addListener('registration', (token) => {
      console.log('Push registration success, token:', token.value);
      // Send token to backend for storage
      sendTokenToBackend(token.value);
    });

    // Handle registration error
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
    });

    // Handle push notification received while app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received:', notification);
      // Show in-app notification or update UI
      handleForegroundNotification(notification);
    });

    // Handle push notification action (user tapped on notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification action performed:', notification);
      // Navigate to relevant screen
      handleNotificationAction(notification);
    });

    console.log('Push notifications setup completed');
  } catch (error) {
    console.error('Error setting up push notifications:', error);
  }
};

// Send push token to backend
const sendTokenToBackend = async (token) => {
  try {
    const authToken = localStorage.getItem('token');
    if (!authToken) return;

    const API = process.env.REACT_APP_BACKEND_URL;
    await fetch(`${API}/api/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ 
        token, 
        platform: platform 
      })
    });
    console.log('Push token sent to backend');
  } catch (error) {
    console.error('Error sending push token to backend:', error);
  }
};

// Handle foreground notification
const handleForegroundNotification = (notification) => {
  // You can show a toast/alert here
  // The notification object contains: id, title, body, data
  console.log('Foreground notification:', notification.title, notification.body);
};

// Handle notification action (user tapped)
const handleNotificationAction = (notification) => {
  const data = notification.notification.data;
  
  // Navigate based on notification data
  if (data?.motorcycle_id) {
    window.location.href = `/motorcycle/${data.motorcycle_id}`;
  } else if (data?.order_id) {
    window.location.href = '/dealer/orders';
  }
};

// Get current push token
export const getPushToken = async () => {
  if (!isNative) return null;
  
  try {
    // The token is stored when registration succeeds
    // For now, re-register to get the token
    const permissionStatus = await PushNotifications.checkPermissions();
    if (permissionStatus.receive === 'granted') {
      // Token will be sent via the registration listener
      await PushNotifications.register();
    }
  } catch (error) {
    console.error('Error getting push token:', error);
  }
  return null;
};
