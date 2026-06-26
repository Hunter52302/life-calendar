import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useRegisterSW } from 'virtual:pwa-register/react'
import './index.css'
import App from './App.jsx'
import UpdatePrompt from './components/UpdatePrompt.jsx'
import { CryptoProvider } from './context/CryptoContext.jsx'

// Matches the "Install updates automatically" toggle in the About settings
// panel (App.jsx), persisted via usePersistentState under the same key.
const WEB_AUTO_UPDATE_KEY = 'lc-web-auto-update';

function Root() {
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
