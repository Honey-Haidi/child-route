import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.saferide.mobile",
  appName: "SafeRide",
  webDir: "public",
  server: {
    // Stable published (production) URL. Requires the app to be published.
    url: "https://project--ecee0f21-3a38-44bc-83ad-eb526d33874c.lovable.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
