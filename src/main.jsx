import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useRegisterSW } from 'virtual:pwa-register/react'
import './index.css'
import App from './App.jsx'
import UpdatePrompt from './components/UpdatePrompt.jsx'
import { CryptoProvider } from './context/CryptoContext.jsx'

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
