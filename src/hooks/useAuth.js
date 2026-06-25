import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { storage } from '../lib/storage.js';

/**
 * Authentication state for the envelope zero-knowledge model.
 *
 * States:
 *   checking    — verifying token with the server on startup
 *   setup       — no account exists yet (first launch → register the admin)
 *   login       — accounts exist, need email + password
 *   unlock      — token valid but the DEK isn't in memory (after a reload)
 *   ready       — authenticated AND unlocked
 *   offline     — server unreachable; offer to work from local cache
 *   offline-ok  — user chose to continue offline
 *
 * The DEK itself lives in CryptoContext. App.jsx performs the crypto (derive
 * verifier, unwrap DEK) and calls markUnlocked() once the DEK is set; this hook
 * only tracks auth state, the token, and the unlock envelope (`zkInfo`).
 */
export function useAuth() {
  const [authState, setAuthState] = useState('checking');
  const [zkInfo, setZkInfo]       = useState(null);   // { kdfSalt, wrappedDekPassword }
  const [accountRole, setAccountRole]   = useState(null);
  const [accountEmail, setAccountEmail] = useState(null);

  useEffect(() => {
    api.auth.status()
      .then(({ isSetup, tokenValid, role, email, kdf_salt, wrapped_dek_password }) => {
        if (tokenValid) {
          setAccountRole(role ?? null);
          setAccountEmail(email ?? null);
          setZkInfo({ kdfSalt: kdf_salt, wrappedDekPassword: wrapped_dek_password });
          setAuthState('unlock');   // App will auto-unlock if a session DEK was restored
        } else if (!isSetup) {
          setAuthState('setup');
        } else {
          setAuthState('login');
        }
      })
      .catch(() => setAuthState('offline'));
  }, []);

  function applyAuthResponse(res) {
    storage.setToken(res.token);
    setAccountRole(res.role ?? null);
    setAccountEmail(res.email ?? null);
    setZkInfo({ kdfSalt: res.kdf_salt, wrappedDekPassword: res.wrapped_dek_password });
    return res; // App sets the DEK then calls markUnlocked()
  }

  /** Salts for deriving the auth verifier + KEK. */
  const prelogin = (email) => api.auth.prelogin(email);

  const register = (email, authVerifier, envelope) =>
    api.auth.register(email, authVerifier, envelope).then(applyAuthResponse);

  const login = (email, authVerifier) =>
    api.auth.login(email, authVerifier).then(applyAuthResponse);

  const recoveryEnvelope = (email) => api.auth.recoveryEnvelope(email);

  const resetPassword = (email, recoveryVerifier, envelope) =>
    api.auth.resetPassword(email, recoveryVerifier, envelope).then(applyAuthResponse);

  /** Called by App after the DEK is set in CryptoContext. */
  function markUnlocked() {
    setAuthState('ready');
  }

  function logout() {
    storage.removeToken();
    setZkInfo(null);
    setAccountRole(null);
    setAccountEmail(null);
    setAuthState('login');
  }

  function continueOffline() {
    setAuthState('offline-ok');
  }

  async function setAccountEmailOnServer(email) {
    const res = await api.auth.setEmail(email);
    setAccountEmail(res.email);
    return res;
  }

  return {
    authState, zkInfo,
    isAdmin: accountRole === 'admin',
    accountEmail,
    prelogin, register, login, recoveryEnvelope, resetPassword,
    markUnlocked, logout, continueOffline,
    setAccountEmail: setAccountEmailOnServer,
  };
}
