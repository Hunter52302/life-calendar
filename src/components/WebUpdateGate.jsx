import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import UpdatePrompt from './UpdatePrompt.jsx'

// Matches the "Install updates automatically" toggle in the About settings
// panel (App.jsx), persisted via usePersistentState under the same key.
const WEB_AUTO_UPDATE_KEY = 'lc-web-auto-update';

/**
 * Owns the PWA service worker: registration, update polling, and the refresh
 * prompt. Rendered for web and Capacitor only — NEVER under Tauri (see main.jsx).
 *
 * The desktop build serves its frontend from the binary and ships new UI via the
 * Tauri updater, so a service worker buys it no offline capability it does not
 * already have. Worse, the worker's precache lives in the webview's data
 * directory, which survives an app update: after the updater swapped in a new
 * binary, the worker kept serving the OLD release's bundle, so the About panel
 * reported a version behind the .exe on disk, while the Rust-side update check
 * (reading the real binary version) correctly said "up to date". Workers left
 * behind by builds that predate this split are evicted from Rust — see
 * EVICT_SERVICE_WORKER_JS in src-tauri/src/lib.rs.
 */
export default function WebUpdateGate() {
  // Register the service worker; get a callback to activate a waiting update
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      if (!r) return;
      // Poll for updates every hour while the tab stays open.
      setInterval(() => r.update(), 60 * 60 * 1000);
      // Also re-check the instant the app returns to the foreground, so a
      // reopened PWA (whose process the OS kept warm, so the hourly timer never
      // lapsed) picks up a new release within seconds instead of waiting up to
      // an hour. Throttled to one check a minute so rapid focus toggling can't
      // spam sw.js revalidations.
      let lastCheck = 0;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        const now = Date.now();
        if (now - lastCheck < 60 * 1000) return;
        lastCheck = now;
        r.update();
      });
    },
    onRegisterError(err) {
      console.warn('Service worker registration failed:', err);
    },
  });

  // When a new version is downloaded, apply it immediately if the user has
  // opted into auto-updates; otherwise UpdatePrompt below asks them first.
  useEffect(() => {
    if (needRefresh && localStorage.getItem(WEB_AUTO_UPDATE_KEY) === 'true') {
      updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  return <UpdatePrompt updateSW={needRefresh ? updateServiceWorker : null} />;
}
