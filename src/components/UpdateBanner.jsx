import { useState } from 'react';

/**
 * UpdateBanner — shows a dismissable banner when a desktop update is
 * available (manual mode) or a brief "installing" notice (auto-update mode,
 * right before the app relaunches itself). No-ops in the browser/PWA.
 *
 * Takes the shared `updater` (from useDesktopUpdater) as a prop rather than
 * calling the hook itself, so it stays in sync with the About panel's
 * updater controls instead of running its own independent listener/state.
 */
export default function UpdateBanner({ updater }) {
  const { autoUpdate, status, pending, install } = updater;
  const [dismissed, setDismissed] = useState(false);

  if (status === 'installing') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-3 px-5 py-3 bg-indigo-600 text-white shadow-xl">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
        <span className="text-sm font-medium">Installing update — restarting…</span>
      </div>
    );
  }

  if (!pending || status !== 'available' || autoUpdate || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-5 py-3 bg-indigo-600 text-white shadow-xl">
      <div className="flex items-center gap-3 min-w-0">
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span className="text-sm font-medium truncate">
          PLS Calendar <strong>v{pending.version}</strong> is ready to install
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => install(pending)}
          className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-white text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          Update &amp; Restart
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
