import type { CapacitorConfig } from "@capacitor/cli";

// SafeRide is a full-stack app (auth, GPS, realtime) hosted on Lovable.
// The Android shell loads the live app over HTTPS. Publish the app first,
// then set server.url to your published URL before building the APK.
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
  plugins: {
    CapacitorGeolocation: {
      // Browser Geolocation is used by the driver tracker; Android WebView
      // honors the same permissions requested here.
    },
  },
};

export default config;
