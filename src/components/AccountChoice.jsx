/**
 * AccountChoice — first-run screen. Presents two "membership"-style cards,
 * styled after a pricing table, so the user can decide up front whether to use
 * PLS Calendar with an account (synced, recoverable) or account-free (local to
 * this one device). Rendered by AuthGate when authState === 'choose'.
 *
 * The choice is remembered (see useAuth ACCOUNT_MODE_KEY); a local-only user can
 * still upgrade to an account later from Settings.
 */

function Check({ className = '' }) {
  return (
    <svg className={`w-4 h-4 flex-shrink-0 ${className}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.3 6.8-6.8a1 1 0 0 1 1.4 0z" clipRule="evenodd" />
    </svg>
  );
}

function Feature({ children, muted = false }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <Check className={muted ? 'text-gray-300 dark:text-gray-600' : 'text-emerald-500'} />
      <span className={muted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'}>{children}</span>
    </li>
  );
}

export default function AccountChoice({ onChooseLocal, onChooseAccount, serverReachable = true, theme }) {
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
            Choose how you'd like to use it. You can change your mind later.
          </p>
        </div>

        <div className="grid gap-5 w-full max-w-3xl md:grid-cols-2">
          {/* ── No account / local only ─────────────────────────────────────── */}
          <div className="flex flex-col rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <div className="text-center mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">No account</h2>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white mt-2">Free</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Just start using it</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Everything stays on this device</p>
            </div>
            <ul className="space-y-3 flex-1">
              <Feature>Full calendar, plan &amp; live views</Feature>
              <Feature>Habits, budgets &amp; categories</Feature>
              <Feature>Import / export ICS &amp; subscriptions</Feature>
              <Feature>Nothing leaves your device</Feature>
              <Feature muted>No sync across devices</Feature>
              <Feature muted>No password recovery / backup key</Feature>
              <Feature muted>Clearing browser data erases everything</Feature>
            </ul>
            <button
              type="button"
              onClick={onChooseLocal}
              className="mt-6 w-full py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              No account — use it locally
            </button>
            <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 mt-3">
              I understand this device holds the only copy of my data.
            </p>
          </div>

          {/* ── Account / synced ────────────────────────────────────────────── */}
          <div className="relative flex flex-col rounded-2xl bg-white dark:bg-gray-800 border-2 border-indigo-500 shadow-lg p-6">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 text-white text-[11px] font-semibold px-3 py-1 shadow">
              Recommended
            </span>
            <div className="text-center mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Account</h2>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white mt-2">Free</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Sign up in seconds</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">Encrypted &amp; synced across devices</p>
            </div>
            <ul className="space-y-3 flex-1">
              <Feature>Everything in "No account", plus:</Feature>
              <Feature>Sync across all your devices</Feature>
              <Feature>Zero-knowledge end-to-end encryption</Feature>
              <Feature>One-time recovery / backup key</Feature>
              <Feature>Connect Google &amp; other calendars</Feature>
              <Feature>Push &amp; webhook reminders</Feature>
            </ul>
            <button
              type="button"
              onClick={onChooseAccount}
              className="mt-6 w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors"
            >
              Sign in / Sign up
            </button>
            <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 mt-3">
              {serverReachable
                ? 'Your password encrypts your data — only you can read it.'
                : 'Server is unreachable right now — try again once it’s online.'}
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-8 max-w-md">
          Prefer to run the server yourself? PLS Calendar can be self-hosted — see the
          project README for the self-hosting guide.
        </p>
      </div>
    </div>
  );
}
