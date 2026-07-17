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

/**
 * True on phones/tablets and other touch-primary screens.
 *
 * `pointer: coarse` asks whether the *primary* pointer is imprecise, which is
 * the question we actually care about — unlike a bare `'ontouchstart' in window`
 * check, it stays false on a touchscreen laptop being driven by a mouse. Used to
 * default event drag-to-move off, since on a phone-sized grid a drag is far more
 * often a mis-grabbed scroll than an intentional move.
 */
export function isTouchDevice() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse)').matches;
}
