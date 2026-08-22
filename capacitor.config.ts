import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cavalry63.tresath',
  appName: 'Tresath',
  webDir: 'out',
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
