import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { storage, safeSetItem } from '../lib/storage.js';

/**
 * Authentication state for the envelope zero-knowledge model.
 *
 * States:
 *   checking    — verifying token with the server on startup
 *   choose      — first launch, no choice made yet: pick "local only" or "account"
 *   setup       — no account exists yet (first launch → register the admin)
 *   login       — accounts exist, need email + password
 *   unlock      — token valid but the DEK isn't in memory (after a reload)
 *   ready       — authenticated AND unlocked
 *   offline     — server unreachable; offer to work from local cache
 *   offline-ok  — user chose to continue offline / picked account-free local mode
 *
 * The DEK itself lives in CryptoContext. App.jsx performs the crypto (derive
 * verifier, unwrap DEK) and calls markUnlocked() once the DEK is set; this hook
 * only tracks auth state, the token, and the unlock envelope (`zkInfo`).
 *
 * Account mode: the user's first-run choice ("local only" vs "account") is
 * persisted in localStorage under ACCOUNT_MODE_KEY so we don't re-prompt on
 * every launch. A valid token always implies account mode regardless of the
 * stored value.
 */
const ACCOUNT_MODE_KEY = 'lc-account-mode'; // 'local' | 'account' (absent = undecided)

export function useAuth() {
  const [authState, setAuthState] = useState('checking');
  const [zkInfo, setZkInfo]       = useState(null);   // { kdfSalt, wrappedDekPassword }
  const [accountRole, setAccountRole]   = useState(null);
  const [accountEmail, setAccountEmail] = useState(null);
  // Cached server status so the choice screen can route "account" to the right
  // screen (register the first account vs sign in to an existing one) and know
  // whether the server is even reachable.
  const [serverIsSetup, setServerIsSetup]     = useState(false);
  const [serverReachable, setServerReachable] = useState(true);

  useEffect(() => {
    const savedMode = localStorage.getItem(ACCOUNT_MODE_KEY);
    api.auth.status()
      .then(({ isSetup, tokenValid, role, email, auth_salt, kdf_salt, wrapped_dek_password }) => {
        setServerIsSetup(isSetup);
        setServerReachable(true);
        if (tokenValid) {
          // A live account session always wins — treat as account mode.
          safeSetItem(ACCOUNT_MODE_KEY, 'account');
          setAccountRole(role ?? null);
          setAccountEmail(email ?? null);
          setZkInfo({ authSalt: auth_salt, kdfSalt: kdf_salt, wrappedDekPassword: wrapped_dek_password });
          setAuthState('unlock');   // App will auto-unlock if a session DEK was restored
        } else if (savedMode === 'local') {
          setAuthState('offline-ok');            // returning account-free user
        } else if (savedMode === 'account') {
          setAuthState(isSetup ? 'login' : 'setup'); // wants an account, not signed in
        } else {
          setAuthState('choose');                // first ever launch → present the choice
        }
      })
      .catch(() => {
        setServerReachable(false);
        // Server unreachable. Local-only users keep working; undecided users can
        // still pick local (account creation just isn't available right now).
        if (savedMode === 'local') setAuthState('offline-ok');
        else if (savedMode === 'account') setAuthState('offline');
        else setAuthState('choose');
      });
  }, []);

  function applyAuthResponse(res) {
    storage.setToken(res.token);
    safeSetItem(ACCOUNT_MODE_KEY, 'account');
    setAccountRole(res.role ?? null);
    setAccountEmail(res.email ?? null);
    setZkInfo({ authSalt: res.auth_salt, kdfSalt: res.kdf_salt, wrappedDekPassword: res.wrapped_dek_password });
    return res; // App sets the DEK then calls markUnlocked()
  }

  /** Salts for deriving the auth verifier + KEK. */
  const prelogin = (email) => api.auth.prelogin(email);

  const register = (email, authVerifier, envelope) =>
    api.auth.register(email, authVerifier, envelope).then(applyAuthResponse);

  const login = (email, authVerifier) =>
    api.auth.login(email, authVerifier).then(applyAuthResponse);

  /**
   * Complete a "Sign in with Google" flow: exchange the one-time ticket for the
   * session token + Google unlock material. Returns the response (including
   * wrapped_dek_google + google_unlock_secret) so App can unwrap the DEK.
   */
  const loginWithGoogle = (ticket) =>
    api.authGoogle.loginComplete(ticket).then(applyAuthResponse);

  const recoveryEnvelope = (email) => api.auth.recoveryEnvelope(email);

  const resetPassword = (email, recoveryVerifier, envelope) =>
    api.auth.resetPassword(email, recoveryVerifier, envelope).then(applyAuthResponse);

  /** Called by App after the DEK is set in CryptoContext. */
  function markUnlocked() {
    setAuthState('ready');
  }

  function logout() {
    storage.removeToken();
    api.admin.clearAdminToken();
    setZkInfo(null);
    setAccountRole(null);
    setAccountEmail(null);
    setAuthState('login');
  }

  function continueOffline() {
    setAuthState('offline-ok');
  }

  // ── First-run choice ───────────────────────────────────────────────────────
  /** User picked "no account, local only". Remembered across launches. */
  function chooseLocal() {
    safeSetItem(ACCOUNT_MODE_KEY, 'local');
    setAuthState('offline-ok');
  }

  /** User picked "sign in / sign up". Route to register (first account) or login. */
  function chooseAccount() {
    safeSetItem(ACCOUNT_MODE_KEY, 'account');
    if (!serverReachable) { setAuthState('offline'); return; }
    setAuthState(serverIsSetup ? 'login' : 'setup');
  }

  /**
   * Upgrade an account-free (local) user to the account flow later on. Re-checks
   * server status so we route to the right screen even if it changed since
   * launch. Local data is migrated up on the first sync after they register.
   */
  async function switchToAccount() {
    safeSetItem(ACCOUNT_MODE_KEY, 'account');
    setAuthState('checking');
    try {
      const { isSetup, tokenValid } = await api.auth.status();
      setServerIsSetup(isSetup);
      setServerReachable(true);
      setAuthState(tokenValid ? 'unlock' : (isSetup ? 'login' : 'setup'));
    } catch {
      setServerReachable(false);
      setAuthState('offline');
    }
  }

  async function setAccountEmailOnServer(email) {
    const res = await api.auth.setEmail(email);
    setAccountEmail(res.email);
    return res;
  }

  async function deleteAccount(authVerifier) {
    const res = await api.auth.deleteAccount(authVerifier);
    storage.removeToken();
    api.admin.clearAdminToken();
    setZkInfo(null);
    setAccountRole(null);
    setAccountEmail(null);
    setAuthState(res.isSetup ? 'login' : 'setup');
    return res;
  }

  return {
    authState, zkInfo, serverReachable,
    isAdmin: accountRole === 'admin',
    accountEmail,
    prelogin, register, login, loginWithGoogle, recoveryEnvelope, resetPassword,
    markUnlocked, logout, continueOffline,
    chooseLocal, chooseAccount, switchToAccount,
    setAccountEmail: setAccountEmailOnServer,
    deleteAccount,
  };
}
