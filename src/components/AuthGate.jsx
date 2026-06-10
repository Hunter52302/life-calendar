import { useState } from 'react';

/**
 * AuthGate — shown instead of the app when the user needs to authenticate.
 *
 * authState values handled here:
 *   'checking' — spinner while we ping the server
 *   'setup'    — first-ever launch: create the first (admin) account
 *   'login'    — email + password screen, with a "create account" toggle
 *   'locked'   — token is valid but the ZK master key needs the password
 *   'offline'  — server not running; offer to continue offline
 */

const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500 text-sm';

export default function AuthGate({ authState, onLogin, onRegister, onUnlock, onContinueOffline, onLogout, theme }) {
  // 'login' | 'register' — only meaningful when authState is 'login'/'setup'
  const [mode, setMode]           = useState(null);
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm,  setConfirm]    = useState('');
  const [error,    setError]      = useState('');
  const [loading,  setLoading]    = useState(false);

  // First launch forces register; otherwise default to login with a toggle.
  const effectiveMode = authState === 'setup' ? 'register' : (mode ?? 'login');
  const isRegister = effectiveMode === 'register' && authState !== 'locked';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (authState === 'locked') {
      if (!password) return;
      setLoading(true);
      try {
        await onUnlock(password);
      } catch (err) {
        setError(err.message ?? 'Incorrect password.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isRegister) {
      if (!email.trim()) { setError('Email is required.'); return; }
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
      if (password !== confirm) { setError('Passwords do not match.'); return; }
    } else if (password.length < 4) {
      setError('Enter your password.');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) await onRegister(email.trim(), password);
      else            await onLogin(email.trim(), password);
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError('');
    setConfirm('');
  }

  const showForm = ['setup', 'login', 'locked'].includes(authState);

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
              {authState === 'checking' && 'Connecting…'}
              {authState === 'offline'  && 'Server is not reachable.'}
              {authState === 'locked'   && 'Enter your password to unlock your encrypted data.'}
              {showForm && authState !== 'locked' && (
                isRegister
                  ? 'Create your account. Your password also encrypts your data.'
                  : 'Welcome back. Sign in to continue.'
              )}
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

          {/* Auth form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-3">
              {authState !== 'locked' && (
                <input
                  autoFocus
                  type="email"
                  placeholder={isRegister ? 'Email' : 'Email (blank if set up before accounts)'}
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  className={inputCls}
                />
              )}
              <input
                autoFocus={authState === 'locked'}
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className={inputCls}
              />
              {isRegister && (
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError(''); }}
                  className={inputCls}
                />
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
                  : authState === 'locked' ? 'Unlock'
                  : isRegister ? 'Create account' : 'Sign in'
                }
              </button>

              {/* Mode toggle / logout link */}
              {authState === 'login' && (
                <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                  {isRegister ? (
                    <>Already have an account?{' '}
                      <button type="button" onClick={() => switchMode('login')} className="text-indigo-500 hover:underline font-medium">Sign in</button>
                    </>
                  ) : (
                    <>New here?{' '}
                      <button type="button" onClick={() => switchMode('register')} className="text-indigo-500 hover:underline font-medium">Create an account</button>
                    </>
                  )}
                </p>
              )}
              {authState === 'locked' && (
                <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                  <button type="button" onClick={onLogout} className="text-indigo-500 hover:underline font-medium">Sign in as someone else</button>
                </p>
              )}
            </form>
          )}

          {/* Footer hint */}
          {isRegister && showForm && (
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4 leading-relaxed">
              Zero-knowledge encryption is on by default: your password encrypts
              your calendar and only you can read it.<br />
              <span className="text-amber-500 dark:text-amber-400">If you forget your password, your encrypted data cannot be recovered.</span>
            </p>
          )}
          {authState === 'locked' && (
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4 leading-relaxed">
              Your data is encrypted with a key derived from your password.<br />
              If an admin reset your password, enter your <span className="font-medium">previous</span> password here to unlock.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
