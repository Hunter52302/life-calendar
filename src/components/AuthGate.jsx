import { useState } from 'react';
import AccountChoice from './AccountChoice';

/**
 * AuthGate — shown instead of the app when the user needs to authenticate or
 * unlock. Envelope zero-knowledge model:
 *
 *   'checking' — spinner while we ping the server
 *   'choose'   — first-ever launch: pick "no account" (local) or "account"
 *   'setup'    — first-ever launch: create the first (admin) account
 *   'login'    — email + password, with register / forgot-password toggles
 *   'unlock'   — token valid but the data key needs the password (after reload)
 *   'offline'  — server not running; offer to continue offline
 *
 * Plus a one-time recovery-code screen shown right after registration
 * (driven by the `recoveryCode` prop), which the user must save to continue.
 */

const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500 text-sm';

export default function AuthGate({
  authState, onLogin, onRegister, onUnlock, onResetPassword, onGoogleLogin,
  onContinueOffline, onLogout, recoveryCode, onRecoverySaved, theme,
  onChooseLocal, onChooseAccount, onBackToChoose, serverReachable = true,
}) {
  const [mode, setMode]         = useState(null); // 'login' | 'register' | 'reset'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [keepUnlocked, setKeepUnlocked]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [copied, setCopied]     = useState(false);

  const effectiveMode = authState === 'setup' ? 'register' : (mode ?? 'login');
  const isRegister = effectiveMode === 'register' && authState !== 'unlock';
  const isReset    = effectiveMode === 'reset' && authState !== 'unlock';

  function copyRecovery() {
    navigator.clipboard?.writeText(recoveryCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    try {
      if (authState === 'unlock') {
        if (!password) return;
        setLoading(true);
        await onUnlock(password, keepUnlocked);
        return;
      }
      if (isReset) {
        if (!email.trim()) return setError('Email is required.');
        if (!recoveryInput.trim()) return setError('Enter your recovery code.');
        if (password.length < 8) return setError('New password must be at least 8 characters.');
        if (password !== confirm) return setError('Passwords do not match.');
        setLoading(true);
        await onResetPassword(email.trim(), recoveryInput.trim(), password, keepUnlocked);
        return;
      }
      if (isRegister) {
        if (!email.trim()) return setError('Email is required.');
        if (password.length < 8) return setError('Password must be at least 8 characters.');
        if (password !== confirm) return setError('Passwords do not match.');
        setLoading(true);
        await onRegister(email.trim(), password, keepUnlocked);
        return;
      }
      // login
      if (!email.trim()) return setError('Email is required.');
      if (!password) return setError('Enter your password.');
      setLoading(true);
      await onLogin(email.trim(), password, keepUnlocked);
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next) {
    setMode(next); setError(''); setConfirm(''); setPassword(''); setRecoveryInput('');
  }

  const showForm = ['setup', 'login', 'unlock'].includes(authState);
  // Let an undecided user back out of the account/sign-in flow to the choice
  // screen. Not offered on 'unlock' (a returning account already has "Sign in as
  // someone else") nor 'checking'.
  const canGoBack = onBackToChoose && ['setup', 'login', 'offline'].includes(authState);

  // ── First-run choice: account vs local-only ────────────────────────────────
  if (authState === 'choose') {
    return (
      <AccountChoice
        onChooseLocal={onChooseLocal}
        onChooseAccount={onChooseAccount}
        serverReachable={serverReachable}
        theme={theme}
      />
    );
  }

  // ── One-time recovery-code screen (post-registration) ──────────────────────
  if (recoveryCode) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <div className="flex items-center justify-center h-[100dvh] bg-gray-50 dark:bg-gray-900 px-4">
          <div className="w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center mx-auto mb-4 shadow-lg text-2xl">🔑</div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Save your recovery code</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                This is the <span className="font-semibold">only</span> way to recover your data if you forget your password. We can't show it again.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
              <code className="block text-center text-lg font-mono tracking-wider text-gray-900 dark:text-white break-all select-all">{recoveryCode}</code>
            </div>
            <button type="button" onClick={copyRecovery}
              className="w-full py-2.5 mb-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              {copied ? '✓ Copied' : 'Copy to clipboard'}
            </button>
            <label className="flex items-start gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={savedConfirmed} onChange={e => setSavedConfirmed(e.target.checked)} className="mt-0.5 accent-indigo-500" />
              <span className="text-xs text-gray-600 dark:text-gray-400">I've saved my recovery code somewhere safe. I understand it cannot be recovered if lost.</span>
            </label>
            <button type="button" disabled={!savedConfirmed} onClick={onRecoverySaved}
              className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
              Continue to PLS Calendar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const subtitle = authState === 'checking' ? 'Connecting…'
    : authState === 'offline' ? 'Server is not reachable.'
    : authState === 'unlock' ? 'Enter your password to unlock your encrypted data.'
    : isReset ? 'Use your recovery code to set a new password — your data is preserved.'
    : isRegister ? 'Your password also encrypts your data. Only you can read it.'
    : 'Sign in to continue.';

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="flex items-center justify-center h-[100dvh] bg-gray-50 dark:bg-gray-900 px-4">
        <div className="w-full max-w-sm">
          {canGoBack && (
            <button
              type="button"
              onClick={onBackToChoose}
              className="inline-flex items-center gap-1.5 mb-6 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              Back to options
            </button>
          )}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PLS Calendar</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          </div>

          {authState === 'checking' && (
            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {authState === 'offline' && (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-300">
                <p className="font-medium mb-1">Backend server is not running.</p>
                <p className="text-xs leading-relaxed">Your data is saved locally on this device. Start the server (<code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">npm run server</code>) to sync across devices.</p>
              </div>
              <button type="button" onClick={onContinueOffline}
                className="w-full py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:opacity-90 transition-opacity">
                Continue offline
              </button>
            </div>
          )}

          {showForm && (
            <form onSubmit={handleSubmit} className="space-y-3">
              {authState !== 'unlock' && (
                <input autoFocus type="email" placeholder="Email" value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }} className={inputCls} />
              )}
              {isReset && (
                <input type="text" placeholder="Recovery code" value={recoveryInput}
                  onChange={e => { setRecoveryInput(e.target.value); setError(''); }} className={inputCls} />
              )}
              <input autoFocus={authState === 'unlock'} type="password"
                placeholder={isReset ? 'New password' : 'Password'} value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }} className={inputCls} />
              {(isRegister || isReset) && (
                <input type="password" placeholder="Confirm password" value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError(''); }} className={inputCls} />
              )}

              <label className="flex items-center gap-2 px-1 cursor-pointer">
                <input type="checkbox" checked={keepUnlocked} onChange={e => setKeepUnlocked(e.target.checked)} className="accent-indigo-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Stay unlocked on this device</span>
              </label>

              {error && <p className="text-xs text-red-500 dark:text-red-400 text-center">{error}</p>}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold transition-colors">
                {loading ? 'Please wait…'
                  : authState === 'unlock' ? 'Unlock'
                  : isReset ? 'Reset password'
                  : isRegister ? 'Create account' : 'Sign in'}
              </button>

              {authState === 'login' && !isReset && (
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
              {authState === 'login' && (
                <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                  {isReset ? (
                    <button type="button" onClick={() => switchMode('login')} className="text-indigo-500 hover:underline font-medium">Back to sign in</button>
                  ) : (
                    <button type="button" onClick={() => switchMode('reset')} className="text-indigo-500 hover:underline font-medium">Forgot password? Use recovery code</button>
                  )}
                </p>
              )}
              {authState === 'unlock' && (
                <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                  <button type="button" onClick={onLogout} className="text-indigo-500 hover:underline font-medium">Sign in as someone else</button>
                </p>
              )}
            </form>
          )}

          {/* Sign in with Google — only on the sign-in screen for already-linked accounts */}
          {authState === 'login' && !isRegister && !isReset && onGoogleLogin && (
            <div className="mt-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">or</span>
                <span className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setError('');
                  setLoading(true);
                  try { await onGoogleLogin(); }
                  catch (err) { setError(err.message ?? 'Could not start Google sign-in.'); setLoading(false); }
                }}
                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                  <path fill="#FBBC05" d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84Z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
                </svg>
                Sign in with Google
              </button>
              <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 mt-2">
                Only works if you've linked Google in Settings.
              </p>
            </div>
          )}

          {isRegister && showForm && (
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4 leading-relaxed">
              Zero-knowledge encryption is always on: your password encrypts your calendar and only you can read it.<br />
              <span className="text-amber-500 dark:text-amber-400">You'll get a one-time recovery code next — save it.</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
