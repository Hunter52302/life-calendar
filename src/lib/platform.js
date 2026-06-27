// Platform detection helpers.
//
// The web-facing landing page (LandingPage.jsx) should only ever appear in a
// regular browser tab. When the same bundle is wrapped by Tauri (desktop) or
// Capacitor (iOS/Android) the user already chose to install the app, so we
// skip the marketing/landing shell and boot straight into the calendar.

export function isTauri() {
  return typeof window !== 'undefined' && typeof window.__TAURI__ !== 'undefined';
}

export function isCapacitor() {
  return typeof window !== 'undefined'
    && !!window.Capacitor
    && typeof window.Capacitor.isNativePlatform === 'function'
    && window.Capacitor.isNativePlatform();
}

/** True inside a packaged desktop/mobile build (not a plain browser). */
export function isNativeApp() {
  return isTauri() || isCapacitor();
}

/** True for a normal web browser visit (where the landing page belongs). */
export function isWebBrowser() {
  return !isNativeApp();
}
