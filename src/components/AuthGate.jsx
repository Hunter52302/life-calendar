import { useState } from 'react';

/**
 * AuthGate — shown instead of the app when the user needs to authenticate.
 *
 * authState values handled here:
 *   'checking' — spinner while we ping the server
 *   'setup'    — first-ever launch: pick a password
 *   'login'    — password screen
 *   'offline'  — server not running; offer to continue offline
 */
export default function AuthGate({ authState, onSetup, onLogin, onContinueOffline, theme }) {
  const [password, setPassword]   = useState('');
  const [confirm,  setConfirm]    = useState('');
  const [error,    setError]      = useState('');
  const [loading,  setLoading]    = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (authState === 'setup' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    setLoading(true);
    try {
      if (authState === 'setup') await onSetup(password);
      else                        await onLogin(password);
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="flex items-center justify-center h-[100dvh] bg-gray-50 dark:bg-gray-900 px-4">
        <div className="w-full max-w-sm">

          {/* Logo / title */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PLS Calendar</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {authState === 'setup'   && 'Create a password to protect your calendar.'}
              {authState === 'login'   && 'Welcome back. Enter your password to continue.'}
              {authState === 'checking' && 'Connecting…'}
              {authState === 'offline' && 'Server is not reachable.'}
            </p>
          </div>

          {/* Checking spinner */}
          {authState === 'checking' && (
            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Offline notice */}
          {authState === 'offline' && (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-300">
                <p className="font-medium mb-1">Backend server is not running.</p>
                <p className="text-xs leading-relaxed">Your data is saved locally on this device. Start the server (<code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">npm run server</code>) to sync across devices.</p>
              </div>
              <button
                type="button"
                onClick={onContinueOffline}
                className="w-full py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Continue offline
              </button>
            </div>
          )}

          {/* Password form */}
          {(authState === 'setup' || authState === 'login') && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <input
                  autoFocus
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500 text-sm"
                />
              </div>
              {authState === 'setup' && (
                <div>
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError(''); }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500 text-sm"
                  />
                </div>
              )}

              {error && (
                <p className="text-xs text-red-500 dark:text-red-400 text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                {loading
                  ? 'Please wait…'
                  : authState === 'setup' ? 'Create password & continue' : 'Unlock'
                }
              </button>
            </form>
          )}

          {/* Footer hint */}
          {authState === 'setup' && (
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4 leading-relaxed">
              This password protects your calendar on this device.<br />
              You'll use it every time you open the app.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
