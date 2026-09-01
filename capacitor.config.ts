import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cavalry63.tresath',
  appName: 'Tresath',
  webDir: 'out',
  ...(process.env.CAP_SERVER_URL
    ? { server: { url: process.env.CAP_SERVER_URL, cleartext: true } }
    : {}),
  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    CapacitorUpdater: {
      appId: 'com.cavalry63.tresath',
      autoUpdate: 'atBackground'
    }
  }
};

export default config;
