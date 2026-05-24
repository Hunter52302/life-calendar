/**
 * UpdatePrompt — shown when the service worker has downloaded a new
 * version of the app. Clicking "Update" activates the new SW and reloads.
 *
 * Receives `updateSW` from vite-plugin-pwa's `useRegisterSW` hook.
 */
export default function UpdatePrompt({ updateSW }) {
  if (!updateSW) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[300] sm:left-auto sm:right-6 sm:w-80">
      <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-2xl shadow-2xl p-4 flex items-center gap-3">
        {/* Icon */}
        <div className="w-8 h-8 rounded-lg bg-indigo-400 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Update available</p>
          <p className="text-xs opacity-70 mt-0.5">A new version of PLS Calendar is ready.</p>
        </div>

        <button
          type="button"
          onClick={() => updateSW(true)}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors"
        >
          Update
        </button>
      </div>
    </div>
  );
}
