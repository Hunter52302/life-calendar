import { useEffect } from 'react';

/** One-time nudge to enable Zero-Knowledge encryption, shown while it's off. */
export default function ZkPromptModal({ onEnable, onDismiss }) {
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onDismiss(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center px-4">
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onDismiss}
      />
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-violet-400 via-indigo-400 to-blue-400" />
        <div className="px-5 pt-5 pb-5 flex flex-col items-center text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Make your data unreadable to anyone but you
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Your data can be fully end-to-end encrypted — only you can read it. Enable Zero-Knowledge mode now?
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 px-5 pb-5">
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Maybe later
          </button>
          <button
            type="button"
            onClick={onEnable}
            className="px-5 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-colors"
          >
            Enable
          </button>
        </div>
      </div>
    </div>
  );
}
