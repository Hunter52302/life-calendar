import PopoutWindow from './PopoutWindow';
import { isTauri } from '../lib/platform.js';

// Detaching Settings is built on window.open + a React portal, which the desktop
// build cannot do: Tauri's macOS webview (WKWebView) returns null from
// window.open unless the Rust side supplies a new-window handler, and wry's only
// "allow" path builds a raw WKWebView whose ivars are uninitialized, so the app
// aborts the moment the new window handles an event. Until the pop-out is
// rebuilt as a real second Tauri window (its own JS context, state synced rather
// than shared), hide the control on desktop instead of offering a dead button.
// The in-app dock remains available on every edge.
const CAN_POP_OUT = !isTauri();

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
 * Chrome for the main Settings menu. It stays attached to the chosen app edge
 * and leaves the calendar visible. Web builds can also detach it into a window.
 */
export default function SettingsShell({
  dock = 'right',
  poppedOut = false,
  onClose,
  onPopOut,
  onDockBack,
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
            {CAN_POP_OUT && (
              <HeaderButton onClick={onPopOut} title="Pop out to a separate window"><IconPopOut /></HeaderButton>
            )}
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
        <div className="lc-glass-panel flex flex-col h-screen bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
          {header}
          {body}
        </div>
      </PopoutWindow>
    );
  }

  const dockClasses = {
    right:  'inset-y-0 right-0 w-full sm:w-[22rem] border-l',
    left:   'inset-y-0 left-0 w-full sm:w-[22rem] border-r',
    top:    'inset-x-0 top-0 h-full sm:h-[18rem] border-b',
    bottom: 'inset-x-0 bottom-0 h-full sm:h-[18rem] border-t',
  };

  return (
    <aside
      data-settings-dock={dock}
      className={`lc-glass-panel fixed z-50 flex flex-col bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 ${dockClasses[dock] || dockClasses.right}`}
      style={{ paddingTop: ['right', 'left', 'top'].includes(dock) ? 'env(safe-area-inset-top, 0px)' : undefined }}
    >
      {header}
      {body}
    </aside>
  );
}
