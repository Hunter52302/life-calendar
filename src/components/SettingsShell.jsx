import PopoutWindow from './PopoutWindow';

// Small stroke icons matching the app's existing iconography.
function IconClose() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
function IconPopOut() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 4h6m0 0v6m0-6L10 14M20 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h4" />
    </svg>
  );
}
function IconDockBack() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L4 20m0 0h5m-5 0v-5M20 6a2 2 0 00-2-2H6a2 2 0 00-2 2v6" />
    </svg>
  );
}
function IconCollapse() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </svg>
  );
}

function HeaderButton({ onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      {children}
    </button>
  );
}

/**
 * Chrome for the main Settings menu. Wraps the (unchanged) settings content and
 * renders it as one of three presentations:
 *   • sidebar  — a right-docked drawer that leaves the calendar visible and
 *                interactive (no dimming backdrop), so appearance changes can be
 *                previewed live. Can be minimized to a slim edge tab.
 *   • popup    — the classic centered modal with a dimming backdrop.
 *   • popped-out — detached into its own OS window via <PopoutWindow>.
 */
export default function SettingsShell({
  view = 'sidebar',
  poppedOut = false,
  minimized = false,
  onClose,
  onPopOut,
  onDockBack,
  onToggleMinimize,
  onPopoutWindowClosed,
  children,
}) {
  const header = (
    <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Settings</p>
      <div className="flex items-center gap-0.5">
        {poppedOut ? (
          <HeaderButton onClick={onDockBack} title="Dock back into window"><IconDockBack /></HeaderButton>
        ) : (
          <>
            {view === 'sidebar' && (
              <HeaderButton onClick={onToggleMinimize} title="Minimize to edge"><IconCollapse /></HeaderButton>
            )}
            <HeaderButton onClick={onPopOut} title="Pop out to a separate window"><IconPopOut /></HeaderButton>
          </>
        )}
        <HeaderButton onClick={onClose} title="Close settings"><IconClose /></HeaderButton>
      </div>
    </div>
  );

  const body = (
    <div className="flex-1 min-h-0 overflow-y-auto p-4">
      {children}
    </div>
  );

  // ── Popped out into its own window ────────────────────────────────────────
  if (poppedOut) {
    return (
      <PopoutWindow title="PLS Calendar — Settings" width={460} height={840} onClose={onPopoutWindowClosed}>
        <div className="flex flex-col h-screen bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
          {header}
          {body}
        </div>
      </PopoutWindow>
    );
  }

  // ── Minimized sidebar: just a slim tab on the right edge ──────────────────
  if (view === 'sidebar' && minimized) {
    return (
      <button
        type="button"
        onClick={onToggleMinimize}
        title="Open settings"
        aria-label="Open settings"
        className="fixed top-1/2 right-0 -translate-y-1/2 z-50 flex items-center gap-1 py-3 pl-2 pr-1.5 rounded-l-xl bg-white dark:bg-gray-800 border border-r-0 border-gray-200 dark:border-gray-700 shadow-lg text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
        style={{ writingMode: 'vertical-rl' }}
      >
        <svg className="w-4 h-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-[11px] font-semibold uppercase tracking-wider">Settings</span>
      </button>
    );
  }

  // ── Sidebar drawer (default) ──────────────────────────────────────────────
  if (view === 'sidebar') {
    return (
      <div
        className="fixed top-0 right-0 h-full z-50 w-full sm:w-[22rem] max-w-full flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-2xl"
        style={{ animation: 'lc-slide-in-right 0.18s ease-out', paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {header}
        {body}
      </div>
    );
  }

  // ── Centered popup (classic) ──────────────────────────────────────────────
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 dark:bg-black/60"
        style={{ animation: 'lc-fade-in 0.15s ease-out' }}
        onClick={onClose}
      />
      <div
        className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 pointer-events-none"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="pointer-events-auto w-full max-w-md flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl max-h-[92vh] sm:max-h-[85vh] overflow-hidden">
          {header}
          {body}
        </div>
      </div>
    </>
  );
}
