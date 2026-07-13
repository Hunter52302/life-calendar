/**
 * AccountChoice — first-run screen. Lays out the three ways to use PLS Calendar
 * side by side, as a plain, informational comparison (features + the trial's
 * data warning, no marketing) so the user can make an informed choice. Rendered
 * by AuthGate when authState === 'choose'.
 *
 *   1. Try it (browser)      — instant, but data lives only in this browser.
 *   2. Use without an account — download the native app; data persists locally.
 *   3. Use with an account   — encrypted sync across devices.
 *
 * All three cards are the same size on purpose — none is presented as "better".
 * The choice is remembered (see useAuth ACCOUNT_MODE_KEY); a local-only user can
 * still switch to an account later from the app.
 */

// Where "Use without an account" sends people to grab a native build.
const RELEASES_URL = 'https://github.com/Hunter52302/life-calendar/releases';

function Point({ children }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-300">
      <span aria-hidden="true" className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}

export default function AccountChoice({ onChooseLocal, onChooseAccount, serverReachable = true, theme }) {
  const cardCls = 'flex flex-col h-full rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6';

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-900 px-4 py-10 flex flex-col items-center justify-center overflow-y-auto">
        <div className="text-center mb-8 max-w-2xl">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Welcome to PLS Calendar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Three ways to use it — here's what each one means. You can switch later.
          </p>
        </div>

        <div className="grid gap-5 w-full max-w-5xl md:grid-cols-3 items-stretch">
          {/* ── 1. Browser trial ────────────────────────────────────────────── */}
          <div className={cardCls}>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Try it in your browser</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Start now — nothing to install.</p>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3.5 mb-4">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Your data is saved only in this browser.</p>
                <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300/90 mt-1">
                  It stays across refreshes, but clearing your browser data, using a different browser, or opening it on another device will erase everything. No sync, no backup, no recovery. Best for a quick look.
                </p>
              </div>
              <ul className="space-y-3">
                <Point>Full calendar, plan &amp; live views, habits, budgets and categories</Point>
                <Point>Import and export ICS files and calendar subscriptions</Point>
                <Point>No account or sign-up needed</Point>
              </ul>
            </div>
            <button
              type="button"
              onClick={onChooseLocal}
              className="mt-6 w-full py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Try it now
            </button>
          </div>

          {/* ── 2. No account / download the app ─────────────────────────────── */}
          <div className={cardCls}>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Use without an account</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Download the app for your device.</p>
            </div>
            <ul className="space-y-3 flex-1">
              <Point>Everything in the browser trial</Point>
              <Point>Your calendar is stored by the installed app, so clearing your browser won't erase it</Point>
              <Point>Works fully offline on this device</Point>
              <Point>No sync — this device is the only place your calendar exists</Point>
              <Point>No account, password or recovery key</Point>
            </ul>
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 w-full py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:opacity-90 transition-opacity text-center"
            >
              Download the app
            </a>
          </div>

          {/* ── 3. Account / synced ──────────────────────────────────────────── */}
          <div className={cardCls}>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Use with an account</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Encrypted and synced across your devices.</p>
            </div>
            <ul className="space-y-3 flex-1">
              <Point>Everything the account-free options have</Point>
              <Point>Syncs across all your devices</Point>
              <Point>Zero-knowledge end-to-end encryption — only you can read your data</Point>
              <Point>One-time recovery / backup key to regain access if you forget your password</Point>
              <Point>Connect Google and other calendars</Point>
              <Point>Push and webhook reminders</Point>
              {!serverReachable && (
                <Point>Currently unavailable — the server can't be reached right now</Point>
              )}
            </ul>
            <button
              type="button"
              onClick={onChooseAccount}
              className="mt-6 w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors"
            >
              Sign in or create an account
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-8 max-w-md">
          You can also run the server yourself — see the project README for the self-hosting guide.
        </p>
      </div>
    </div>
  );
}
