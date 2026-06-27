import { useEffect } from 'react';
import { TOPICS } from './TutorialModal.jsx';

/**
 * Center-screen topic picker shown when the user clicks "Tutorial" in
 * Settings. The "Quick Tour" topic (recommended) is a short, glossed-over
 * walkthrough for brand-new users; every other card opens a focused
 * deep-dive into one part of the app.
 */
export default function TutorialHub({ onSelect, onClose }) {
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const recommended = TOPICS.find(t => t.recommended);
  const rest = TOPICS.filter(t => !t.recommended);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-indigo-400 via-blue-400 to-purple-400 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">What would you like a tutorial on?</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pick a topic below — each one is a short, focused walkthrough of how that part of the app fits into your day.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-base leading-none flex-shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Topic list */}
        <div className="px-5 pb-5 overflow-y-auto space-y-3">
          {recommended && (
            <button
              type="button"
              onClick={() => onSelect(recommended.id)}
              className="w-full flex items-start gap-3 p-3 rounded-xl border-2 border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-left"
            >
              <div className="flex-shrink-0 mt-0.5">{recommended.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800 dark:text-gray-100">{recommended.label}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500 text-white uppercase tracking-wide">New here?</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{recommended.blurb}</p>
              </div>
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {rest.map(topic => (
              <button
                key={topic.id}
                type="button"
                onClick={() => onSelect(topic.id)}
                className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
              >
                <div className="flex-shrink-0 scale-[0.65] -m-1.5">{topic.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{topic.label}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{topic.blurb}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
