import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'nl.motoimport.app',
  appName: 'Moto Import',
  webDir: 'build',
  server: {
    // For development, use the preview URL
    // For production, comment this out to use the bundled web assets
    url: process.env.NODE_ENV === 'development' 
      ? 'https://motoimport.preview.emergentagent.com' 
      : undefined,
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#18181b',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#18181b'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Moto Import'
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#18181b'
  }
};

export default config;
