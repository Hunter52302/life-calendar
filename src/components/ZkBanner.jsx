/** Small recurring reminder shown while Zero-Knowledge encryption is off. */
export default function ZkBanner({ onOpenSettings, onDismiss }) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-[90] sm:left-auto sm:right-6 sm:w-96 flex items-center gap-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 rounded-xl shadow-lg px-4 py-3">
      <span className="text-xl flex-shrink-0">🔓</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Your data isn't end-to-end encrypted</p>
        <button
          type="button"
          onClick={onOpenSettings}
          className="text-[11px] text-amber-700 dark:text-amber-400 underline hover:no-underline"
        >
          Enable Zero-Knowledge encryption →
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 text-sm leading-none flex-shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
