import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.plscalendar.app',
  appName: 'PLS Calendar',

  // The Vite build output directory
  webDir: 'dist',

  // Use https:// scheme on Android so service workers and
  // secure storage work the same as iOS.
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'automatic',
  },

  server: {
    // androidScheme 'https' means Android loads the bundled web app at
    // https://localhost — required for service workers to function.
    androidScheme: 'https',

    // During local development you can point Capacitor at your running
    // Vite dev server for live reload. Replace with your machine's LAN IP:
    //
    //   url: 'http://192.168.1.x:5173',
    //   cleartext: true,
    //
    // Comment this out for production builds — the app will load from the
    // bundled dist/ assets instead.
  },

  plugins: {
    // SplashScreen is added automatically; configure it here if needed.
    // SplashScreen: {
    //   launchShowDuration: 0,
    // },
  },
};

export default config;
