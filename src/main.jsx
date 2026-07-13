import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useRegisterSW } from 'virtual:pwa-register/react'
import './index.css'
import App from './App.jsx'
import LandingRouter from './components/LandingRouter.jsx'
import UpdatePrompt from './components/UpdatePrompt.jsx'
import { CryptoProvider } from './context/CryptoContext.jsx'
import { isWebBrowser } from './lib/platform.js'
import { storage } from './lib/storage.js'

// Matches the "Install updates automatically" toggle in the About settings
// panel (App.jsx), persisted via usePersistentState under the same key.
const WEB_AUTO_UPDATE_KEY = 'lc-web-auto-update';

// ── Feature flag: public marketing landing page ───────────────────────────────
// The marketing "front door" (hero + feature grid at /, plus /downloads, /docs
// and the legal pages, all owned by LandingRouter) is currently DISABLED. Web
// visitors now boot straight into the app's account-choice screen — the two
// ways to use PLS Calendar: "Sign in or create an account" or "Continue without
// an account". The landing code is intentionally kept intact and still imported
// below; flip this to `true` to bring the marketing page back. The full working
// version also lives on the `feature/marketing-landing-page` git branch.
const LANDING_PAGE_ENABLED = false;

function Root() {
  // Gate the app behind the landing page. The landing page is the front door
  // for plain browser visits: it lets people read about PLS Calendar, download
  // a native build, or hit GitHub WITHOUT the app mounting, calling the API, or
  // touching their data. Skip it (boot <App/> directly) when the landing page is
  // disabled by the feature flag above, when we're inside a packaged
  // desktop/mobile build (Tauri/Capacitor), or when the visitor is already
  // signed in (a token is present) so returning users aren't bounced through the
  // marketing page.
  const [entered, setEntered] = useState(() =>
    !LANDING_PAGE_ENABLED || !isWebBrowser() || !!storage.getToken());

  // Register the service worker; get a callback to activate a waiting update
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      // Poll for updates every hour while the tab stays open
      if (r) setInterval(() => r.update(), 60 * 60 * 1000);
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

  if (!entered) {
    // lc-theme is persisted JSON-encoded by usePersistentState (App.jsx), so it's
    // stored as '"dark"' (with quotes) — read it the same way, or a dark-mode
    // visitor without a token would see the landing page render in light mode.
    let theme;
    try { theme = JSON.parse(localStorage.getItem('lc-theme')) || 'dark'; }
    catch { theme = localStorage.getItem('lc-theme') || 'dark'; }
    // Reset any landing path (e.g. /docs) back to root before the app mounts —
    // App reads query params, not the path, so this just keeps the URL tidy.
    const enter = () => {
      if (window.location.pathname !== '/') window.history.replaceState({}, '', '/');
      setEntered(true);
    };
    return <LandingRouter onEnter={enter} theme={theme} />;
  }

  return (
    <>
      <App />
      <UpdatePrompt updateSW={needRefresh ? updateServiceWorker : null} />
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CryptoProvider>
      <Root />
    </CryptoProvider>
  </StrictMode>,
)
