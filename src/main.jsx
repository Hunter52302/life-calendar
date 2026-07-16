import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LandingRouter from './components/LandingRouter.jsx'
import WebUpdateGate from './components/WebUpdateGate.jsx'
import { CryptoProvider } from './context/CryptoContext.jsx'
import { isTauri, isWebBrowser } from './lib/platform.js'
import { storage } from './lib/storage.js'

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

  // isTauri() is fixed for the life of the process, so gating a component on it
  // can't change hook order between renders.
  return (
    <>
      <App />
      {!isTauri() && <WebUpdateGate />}
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
