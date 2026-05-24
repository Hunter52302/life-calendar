import { useState, useEffect } from 'react';

/**
 * InstallPrompt — surfaces the browser's "Add to Home Screen" / install
 * prompt in a styled banner at the bottom of the screen.
 *
 * The browser fires `beforeinstallprompt` only when all PWA criteria are met
 * (HTTPS or localhost, valid manifest, registered service worker, not already
 * installed). We capture that event and show our own UI instead of the
 * default browser prompt.
 */
export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null);   // the deferred event
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Don't show if already installed (running in standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    function onBeforeInstall(e) {
      e.preventDefault();
      setPrompt(e);
      setVisible(true);
    }
    function onInstalled() {
      setInstalled(true);
      setVisible(false);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setVisible(false);
    setPrompt(null);
  }

  if (!visible || installed) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[300] sm:left-auto sm:right-6 sm:w-80">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center flex-shrink-0">
          <img src="/favicon.svg" alt="" className="w-6 h-6" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Add to Home Screen</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
            Install PLS Calendar for quick access and offline use.
          </p>
        </div>

        {/* Dismiss */}
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-lg leading-none"
          aria-label="Dismiss"
        >×</button>
      </div>

      {/* Install button — full width below card */}
      <button
        type="button"
        onClick={handleInstall}
        className="mt-2 w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold shadow-lg transition-colors"
      >
        Install App
      </button>
    </div>
  );
}
