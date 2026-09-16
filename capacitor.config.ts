import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.saferide.mobile",
  appName: "SafeRide",
  webDir: "public",
  server: {
    // Stable preview URL serving the latest build.
    // After publishing, replace with your published URL.
    url: "https://project--ecee0f21-3a38-44bc-83ad-eb526d33874c-dev.lovable.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;

