/**
 * UpdateSettings — the "Check for Updates" block inside the About section,
 * for desktop (Tauri) only. Lets the user check/install updates manually,
 * flip on auto-update, and revert to the last version if a new one breaks.
 *
 * Takes the shared `updater` (from useDesktopUpdater) as a prop so it stays
 * in sync with UpdateBanner instead of running its own listener/state.
 */
export default function UpdateSettings({ updater }) {
  const { autoUpdate, setAutoUpdate, status, pending, previousVersion, checkNow, install, revert } = updater;

  const statusLabel =
    status === 'checking' ? 'Checking…'
    : status === 'installing' ? 'Installing…'
    : status === 'available' ? `v${pending?.version} available!`
    : status === 'latest' ? 'Up to date ✓'
    : status === 'error' ? 'Check failed — try again'
    : 'Check for Updates';

  return (
    <div className="pt-1 border-t border-gray-100 dark:border-gray-800 space-y-2">
      <button
        type="button"
        disabled={status === 'checking' || status === 'installing'}
        onClick={() => (status === 'available' ? install(pending) : checkNow())}
        className="w-full flex items-center justify-between px-1 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
      >
        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">{statusLabel}</span>
        {(status === 'checking' || status === 'installing')
          ? <svg className="w-3.5 h-3.5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
          : status === 'available'
            ? <span className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400">Install →</span>
            : <svg className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        }
      </button>

      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">Install updates automatically</span>
        <button
          type="button"
          role="switch"
          aria-checked={autoUpdate}
          onClick={() => setAutoUpdate(!autoUpdate)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${autoUpdate ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${autoUpdate ? 'translate-x-[18px]' : 'translate-x-1'}`} />
        </button>
      </div>

      {previousVersion && (
        <button
          type="button"
          disabled={status === 'installing'}
          onClick={() => revert()}
          className="w-full flex items-center justify-between px-1 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Revert to v{previousVersion}</span>
          <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a4 4 0 010 8H8m-5-8l4-4m-4 4l4 4" /></svg>
        </button>
      )}
    </div>
  );
}
