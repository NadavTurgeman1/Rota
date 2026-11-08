import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The Next app keeps its API routes on the server, so the store build opens
 * the live site instead of a static export. A LAN live-reload URL is not stored here.
 */
const config: CapacitorConfig = {
  appId: "com.rota.schedule",
  appName: "Rota",
  webDir: "mobile/www",
  server: {
    url: "https://rota-schedule.com/app",
    androidScheme: "https",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#f4f0e6",
      showSpinner: false,
    },
    Keyboard: {
      resize: "body",
    },
  },
};

export default config;
