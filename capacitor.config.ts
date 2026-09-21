import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.saferide.mobile",
  appName: "SafeRide",
  webDir: "public",
  server: {
    // Stable published (production) URL. Requires the app to be published.
    url: "https://child-route-buddy.lovable.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
