import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:     'com.dayflow.app',
  appName:   'DayFlow',
  webDir:    'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor:    '#1A1A2E',
      showSpinner:        false,
    },
  },
};

export default config;