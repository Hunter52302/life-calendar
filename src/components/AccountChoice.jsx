/**
 * AccountChoice — first-run screen. Lays out the two ways to use PLS Calendar
 * side by side — account-free (local to this one device) or with an account
 * (encrypted sync across devices) — as a plain, informational comparison so the
 * user can make an informed choice. Rendered by AuthGate when
 * authState === 'choose'.
 *
 * The choice is remembered (see useAuth ACCOUNT_MODE_KEY); a local-only user can
 * still switch to an account later from the app.
 */

function Point({ children }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-300">
      <span aria-hidden="true" className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}

export default function AccountChoice({ onChooseLocal, onChooseAccount, serverReachable = true, theme }) {
  const cardCls = 'flex flex-col rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6';

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
            Two ways to use it — here's what each one means. You can switch later.
          </p>
        </div>

        <div className="grid gap-5 w-full max-w-3xl md:grid-cols-2">
          {/* ── No account / local only ─────────────────────────────────────── */}
          <div className={cardCls}>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Use without an account</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Everything stays on this device.</p>
            </div>
            <ul className="space-y-3 flex-1">
              <Point>Full calendar, plan &amp; live views, habits, budgets and categories</Point>
              <Point>Import and export ICS files and calendar subscriptions</Point>
              <Point>Your data never leaves this device</Point>
              <Point>No sync — this device is the only place your calendar exists</Point>
              <Point>No password recovery or backup key</Point>
              <Point>Clearing this browser or app's data erases your calendar</Point>
            </ul>
            <button
              type="button"
              onClick={onChooseLocal}
              className="mt-6 w-full py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Continue without an account
            </button>
          </div>

          {/* ── Account / synced ────────────────────────────────────────────── */}
          <div className={cardCls}>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Use with an account</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Encrypted and synced across your devices.</p>
            </div>
            <ul className="space-y-3 flex-1">
              <Point>Everything the account-free option has</Point>
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
