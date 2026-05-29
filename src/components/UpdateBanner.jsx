import { useState, useEffect } from 'react';

/**
 * UpdateBanner — listens for the "update-available" event emitted by the
 * Tauri backend and shows a dismissable banner prompting the user to restart.
 * Only renders inside a Tauri desktop window (no-ops in the browser/PWA).
 */
export default function UpdateBanner() {
  const [update, setUpdate] = useState(null); // { version, body }
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only run inside Tauri
    if (typeof window.__TAURI__ === 'undefined') return;

    let unlisten;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('update-available', event => {
        setUpdate(event.payload);
        setDismissed(false);
      }).then(fn => { unlisten = fn; });
    });

    return () => { unlisten?.(); };
  }, []);

  async function handleInstall() {
    if (typeof window.__TAURI__ === 'undefined') return;
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch {
      // Fallback — just close the banner
      setDismissed(true);
    }
  }

  if (!update || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-5 py-3 bg-indigo-600 text-white shadow-xl">
      <div className="flex items-center gap-3 min-w-0">
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span className="text-sm font-medium truncate">
          PLS Calendar <strong>v{update.version}</strong> is ready to install
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={handleInstall}
          className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-white text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          Restart &amp; Update
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-sm px-3 py-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-indigo-500 transition-colors"
        >
          Later
        </button>
      </div>
    </div>
  );
}
