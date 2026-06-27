import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useRegisterSW } from 'virtual:pwa-register/react'
import './index.css'
import App from './App.jsx'
import LandingPage from './components/LandingPage.jsx'
import UpdatePrompt from './components/UpdatePrompt.jsx'
import { CryptoProvider } from './context/CryptoContext.jsx'
import { isWebBrowser } from './lib/platform.js'
import { storage } from './lib/storage.js'

// Matches the "Install updates automatically" toggle in the About settings
// panel (App.jsx), persisted via usePersistentState under the same key.
const WEB_AUTO_UPDATE_KEY = 'lc-web-auto-update';

function Root() {
  // Gate the app behind the landing page. The landing page is the front door
  // for plain browser visits: it lets people read about PLS Calendar, download
  // a native build, or hit GitHub WITHOUT the app mounting, calling the API, or
  // touching their data. Skip it (boot <App/> directly) when we're inside a
  // packaged desktop/mobile build (Tauri/Capacitor), or when the visitor is
  // already signed in (a token is present) so returning users aren't bounced
  // through the marketing page.
  const [entered, setEntered] = useState(() => !isWebBrowser() || !!storage.getToken());

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
    const theme = localStorage.getItem('lc-theme') || 'dark';
    return <LandingPage onEnter={() => setEntered(true)} theme={theme} />;
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
