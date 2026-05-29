import { useState, useEffect } from 'react';

const STEPS = [
  {
    intro: true,
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
        <rect x="4" y="6" width="32" height="28" rx="4" className="fill-indigo-100 dark:fill-indigo-900/40" />
        <rect x="4" y="6" width="32" height="8" rx="4" className="fill-indigo-500" />
        <rect x="10" y="19" width="8" height="2" rx="1" className="fill-indigo-300 dark:fill-indigo-600" />
        <rect x="10" y="24" width="14" height="2" rx="1" className="fill-indigo-200 dark:fill-indigo-700" />
        <rect x="22" y="19" width="8" height="7" rx="1" className="fill-indigo-400/60 dark:fill-indigo-600/60" />
      </svg>
    ),
    title: 'Welcome to Life Calendar',
    body: (
      <>
        <p className="mb-3">Life Calendar helps you close the gap between how you plan your time and how you actually spend it.</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">This quick tour covers everything you need to get started. You can always reopen it from <span className="font-medium text-gray-700 dark:text-gray-300">Settings → Tutorial</span> at any time.</p>
      </>
    ),
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="15" r="8" className="fill-indigo-100 dark:fill-indigo-900/40" />
        <circle cx="20" cy="15" r="5" className="fill-indigo-400" />
        <path d="M20 12v3l2 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="6" y="27" width="28" height="8" rx="3" className="fill-indigo-50 dark:fill-indigo-900/30" />
        <rect x="9" y="30" width="10" height="2" rx="1" className="fill-indigo-300 dark:fill-indigo-600" />
        <circle cx="30" cy="31" r="2.5" className="fill-green-400" />
        <path d="M29 31l1 1 1.5-1.5" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Your Account',
    body: (
      <>
        <p className="mb-2">PLS Calendar saves your data to a local database so nothing is lost if you clear your browser.</p>
        <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">First run</span> — you'll be prompted to create a password. This protects your data and enables sync.</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Cross-device sync</span> — once logged in, your Plan and Live events are the same everywhere you open the app.</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Offline mode</span> — if the server is unreachable, you can continue using the app and changes will sync when you reconnect.</li>
        </ul>
      </>
    ),
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
        <rect x="3" y="10" width="10" height="22" rx="3" className="fill-blue-400" />
        <rect x="15" y="10" width="10" height="22" rx="3" className="fill-green-400" />
        <rect x="27" y="10" width="10" height="22" rx="3" className="fill-purple-400" />
        <rect x="5" y="16" width="6" height="1.5" rx="0.75" fill="white" fillOpacity="0.7" />
        <rect x="5" y="19" width="4" height="1.5" rx="0.75" fill="white" fillOpacity="0.7" />
        <rect x="17" y="16" width="6" height="1.5" rx="0.75" fill="white" fillOpacity="0.7" />
        <rect x="17" y="19" width="4" height="1.5" rx="0.75" fill="white" fillOpacity="0.7" />
        <rect x="29" y="16" width="6" height="1.5" rx="0.75" fill="white" fillOpacity="0.7" />
        <rect x="29" y="19" width="4" height="1.5" rx="0.75" fill="white" fillOpacity="0.7" />
      </svg>
    ),
    title: 'Three Tabs',
    body: (
      <>
        <p className="mb-2">The app has three main views, selectable from the top:</p>
        <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
          <li><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-2 align-middle" /><strong className="text-gray-800 dark:text-gray-200">Plan</strong> — block out how you intend to use your time</li>
          <li><span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-2 align-middle" /><strong className="text-gray-800 dark:text-gray-200">Live</strong> — record what you actually did</li>
          <li><span className="inline-block w-2 h-2 rounded-full bg-purple-400 mr-2 align-middle" /><strong className="text-gray-800 dark:text-gray-200">See Your Life</strong> — compare plan vs reality side by side</li>
        </ul>
      </>
    ),
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
        <rect x="4" y="4" width="32" height="32" rx="5" className="fill-blue-50 dark:fill-blue-900/30" />
        <circle cx="28" cy="28" r="9" className="fill-blue-500" />
        <path d="M24 28h8M28 24v8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="9" y="10" width="14" height="3" rx="1.5" className="fill-blue-200 dark:fill-blue-700" />
        <rect x="9" y="16" width="10" height="2" rx="1" className="fill-blue-100 dark:fill-blue-800" />
      </svg>
    ),
    title: 'Adding Events',
    body: (
      <>
        <p className="mb-2">There are two ways to add an event:</p>
        <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Tap a time slot</span> — click any empty slot on the calendar grid to open the event form pre-filled with that time</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">+ button</span> — the floating button in the corner lets you add to Plan, Live, or log a Drive Time with automatic duration</li>
        </ul>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Events support labels, categories, all-day mode, and repeating patterns.</p>
      </>
    ),
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
        <circle cx="10" cy="12" r="5" fill="#F87171" />
        <circle cx="22" cy="12" r="5" fill="#34D399" />
        <circle cx="34" cy="12" r="5" fill="#60A5FA" />
        <circle cx="10" cy="28" r="5" fill="#FBBF24" />
        <circle cx="22" cy="28" r="5" fill="#A78BFA" />
        <circle cx="34" cy="28" r="5" fill="#F472B6" />
      </svg>
    ),
    title: 'Categories',
    body: (
      <>
        <p className="mb-2">Every event belongs to a category with its own color. Categories help you see at a glance how your time is distributed.</p>
        <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Filter</span> — click "Categories" in the toolbar to show/hide specific categories</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Pin</span> — star a category to keep it in the legend for quick reference</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Customize</span> — create, rename, or recolor categories in Settings → Manage Categories</li>
        </ul>
      </>
    ),
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
        <rect x="4" y="4" width="32" height="32" rx="4" className="fill-gray-100 dark:fill-gray-700" />
        <rect x="8" y="8" width="6" height="6" rx="1" className="fill-indigo-400" />
        <rect x="17" y="8" width="6" height="6" rx="1" className="fill-indigo-300" />
        <rect x="26" y="8" width="6" height="6" rx="1" className="fill-indigo-200 dark:fill-indigo-700" />
        <rect x="8" y="17" width="6" height="6" rx="1" className="fill-indigo-200 dark:fill-indigo-700" />
        <rect x="17" y="17" width="6" height="6" rx="1" className="fill-indigo-400" />
        <rect x="26" y="17" width="6" height="6" rx="1" className="fill-indigo-300" />
        <rect x="8" y="26" width="6" height="6" rx="1" className="fill-indigo-300" />
        <rect x="17" y="26" width="6" height="6" rx="1" className="fill-indigo-200 dark:fill-indigo-700" />
        <rect x="26" y="26" width="6" height="6" rx="1" className="fill-indigo-400" />
      </svg>
    ),
    title: 'Calendar Views',
    body: (
      <>
        <p className="mb-2">Switch views from the toolbar above the calendar:</p>
        <ul className="space-y-0.5 text-left text-sm text-gray-600 dark:text-gray-400">
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Day / Week</span> — hour-by-hour timeline with 30-min precision toggle</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Month</span> — full-month grid; <span className="text-indigo-500 dark:text-indigo-400 font-medium">click any week number</span> to jump straight to that week's day view</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Quarter / Half-Year / Year</span> — big-picture views (enable in Settings → Appearance)</li>
        </ul>
      </>
    ),
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
        <circle cx="18" cy="18" r="11" className="stroke-indigo-400 dark:stroke-indigo-500" strokeWidth="3" fill="none" />
        <path d="M26.5 26.5L35 35" className="stroke-indigo-500 dark:stroke-indigo-400" strokeWidth="3" strokeLinecap="round" />
        <path d="M13 18h10M18 13v10" stroke="#A5B4FC" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Search',
    body: (
      <>
        <p className="mb-3">Press <kbd className="px-1.5 py-0.5 text-xs font-mono border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700">⌘K</kbd> (or <kbd className="px-1.5 py-0.5 text-xs font-mono border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700">Ctrl K</kbd> on Windows) to open the search overlay.</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">Search finds events across both Plan and Live calendars by name or category. Clicking a result jumps directly to that event on the calendar.</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">You can change the keyboard shortcut in Settings → Search Options.</p>
      </>
    ),
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
        <rect x="4" y="8" width="14" height="24" rx="3" className="fill-blue-200 dark:fill-blue-800" />
        <rect x="22" y="8" width="14" height="24" rx="3" className="fill-green-200 dark:fill-green-800" />
        <rect x="6" y="12" width="10" height="3" rx="1.5" className="fill-blue-400" />
        <rect x="6" y="18" width="7" height="3" rx="1.5" className="fill-blue-300" />
        <rect x="6" y="24" width="9" height="3" rx="1.5" className="fill-blue-400" />
        <rect x="24" y="14" width="10" height="3" rx="1.5" className="fill-green-400" />
        <rect x="24" y="21" width="7" height="3" rx="1.5" className="fill-green-300" />
        <rect x="24" y="27" width="9" height="3" rx="1.5" className="fill-green-400" />
      </svg>
    ),
    title: 'See Your Life (Reality Check)',
    body: (
      <>
        <p className="mb-2">The <strong className="text-gray-800 dark:text-gray-200">See Your Life</strong> tab compares your Plan against your Live calendar over any date range.</p>
        <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
          <li>See total planned vs actual hours per category</li>
          <li>Spot patterns in where your time drifts</li>
          <li>Export the comparison as <strong className="text-gray-700 dark:text-gray-300">CSV, JSON, or PDF</strong></li>
        </ul>
      </>
    ),
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
        {/* Phone */}
        <rect x="4" y="6" width="16" height="26" rx="3" className="fill-gray-100 dark:fill-gray-700" stroke="#A5B4FC" strokeWidth="1.5" />
        <rect x="8" y="10" width="8" height="14" rx="1" className="fill-indigo-100 dark:fill-indigo-900/40" />
        <circle cx="12" cy="27" r="1.5" className="fill-indigo-300 dark:fill-indigo-600" />
        {/* Download arrow into phone */}
        <path d="M20 19h8M24 15v8" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" />
        <path d="M21 23l3 3 3-3" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Desktop hint */}
        <rect x="26" y="26" width="10" height="8" rx="1.5" className="fill-indigo-400/60 dark:fill-indigo-600/60" />
        <rect x="29" y="34" width="4" height="1.5" rx="0.75" className="fill-indigo-300 dark:fill-indigo-600" />
      </svg>
    ),
    title: 'Install the App',
    body: (
      <>
        <p className="mb-2">PLS Calendar can be installed as a native-feeling app on any device — no App Store required.</p>
        <ul className="space-y-1 text-left text-sm text-gray-600 dark:text-gray-400">
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">iPhone / iPad</span> — open in Safari, tap the Share button, then <span className="italic">Add to Home Screen</span></li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Android</span> — tap the browser menu and choose <span className="italic">Add to Home Screen</span> or <span className="italic">Install App</span></li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Mac / Windows</span> — look for the install icon (⊕) in your browser's address bar</li>
        </ul>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Once installed it opens full-screen with no browser chrome, works offline, and gets updates automatically.</p>
      </>
    ),
  },
  {
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="14" className="fill-gray-100 dark:fill-gray-700" />
        <circle cx="20" cy="20" r="5" className="fill-gray-400 dark:fill-gray-500" />
        <circle cx="20" cy="20" r="2" className="fill-white dark:fill-gray-300" />
        <path d="M20 6v4M20 30v4M6 20h4M30 20h4" className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M10.1 10.1l2.8 2.8M27.1 27.1l2.8 2.8M10.1 29.9l2.8-2.8M27.1 12.9l2.8-2.8" className="stroke-gray-300 dark:stroke-gray-600" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Settings',
    body: (
      <>
        <p className="mb-2">Open Settings (⚙ top-right) to customize the app:</p>
        <ul className="space-y-0.5 text-left text-sm text-gray-600 dark:text-gray-400">
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Appearance</span> — dark mode, 24h time, week numbers, minimalist mode, font picker</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Search Options</span> — change the keyboard shortcut</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Time Zones</span> — track up to 5 time zones at once</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Manage Categories</span> — add, rename, or recolor categories</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Connected Calendars</span> — import/export .ics files</li>
          <li><span className="font-semibold text-gray-800 dark:text-gray-200">Account</span> — birthday, saved addresses, and profile details</li>
        </ul>
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">You can reopen this tutorial anytime from <span className="font-medium text-gray-500 dark:text-gray-400">Settings → Tutorial</span>.</p>
      </>
    ),
  },
];

export default function TutorialModal({ onClose }) {
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const current = STEPS[step];

  // Close on Escape
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-indigo-400 via-blue-400 to-purple-400" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Tutorial
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-base leading-none"
            aria-label="Close tutorial"
          >
            ✕
          </button>
        </div>

        {/* Step content */}
        <div className="px-5 pt-3 pb-5 flex flex-col items-center text-center min-h-[300px]">
          {/* Icon */}
          <div className="mb-4 mt-1">
            {current.icon}
          </div>

          {/* Title */}
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
            {current.title}
          </h2>

          {/* Body */}
          <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed w-full">
            {typeof current.body === 'string' ? <p>{current.body}</p> : current.body}
          </div>
        </div>

        {/* Footer */}
        {current.intro ? (
          /* Intro slide — Skip / Let's go */
          <div className="flex items-center justify-center gap-3 px-5 pb-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-6 py-2 text-sm rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors"
            >
              Let's go
            </button>
          </div>
        ) : (
          /* All other slides — dots + Back / Next / Done */
          <div className="flex items-center justify-between px-5 pb-5">
            {/* Step dots (exclude intro step 0) */}
            <div className="flex items-center gap-1.5">
              {STEPS.slice(1).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStep(i + 1)}
                  className={`rounded-full transition-all ${
                    i + 1 === step
                      ? 'w-4 h-2 bg-indigo-500'
                      : 'w-2 h-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            {/* Back / Next / Done */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Back
              </button>
              {step < total - 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(s => s + 1)}
                  className="px-4 py-1.5 text-sm rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 text-sm rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
