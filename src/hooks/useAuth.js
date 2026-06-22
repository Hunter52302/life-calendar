import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { storage } from '../lib/storage.js';

/**
 * Manages authentication state.
 *
 * States:
 *   checking  — verifying token with server on startup
 *   setup     — server reachable, no account created yet (first launch)
 *   login     — account(s) exist, token missing/expired
 *   locked    — token valid but the account uses ZK encryption and the
 *               master key hasn't been derived yet (Bitwarden-style lock)
 *   ready     — authenticated and good to go
 *   offline   — server unreachable; app works from localStorage cache
 *
 * ZK note: the master key itself lives in CryptoContext — App.jsx derives
 * it from the password (using zkInfo from here) and calls markUnlocked().
 */
export function useAuth() {
  const [authState, setAuthState] = useState('checking');
  const [zkInfo, setZkInfo]       = useState(null);   // { kdf_salt, zk_verify }
  const [accountRole, setAccountRole]   = useState(null);
  const [accountEmail, setAccountEmail] = useState(null);

  useEffect(() => {
    api.auth.status()
      .then(({ isSetup, tokenValid, zk_enabled, kdf_salt, zk_verify, role, email }) => {
        if (tokenValid) {
          setAccountRole(role ?? null);
          setAccountEmail(email ?? null);
          if (zk_enabled) {
            setZkInfo({ kdf_salt, zk_verify });
            setAuthState('locked');
          } else {
            setAuthState('ready');
          }
        } else if (!isSetup) {
          setAuthState('setup');
        } else {
          setAuthState('login');
        }
      })
      .catch(() => {
        // Server not running — app still works from localStorage cache
        setAuthState('offline');
      });
  }, []);

  function applyAuthResponse(res) {
    storage.setToken(res.token);
    setAccountRole(res.role ?? null);
    setAccountEmail(res.email ?? null);
    if (res.zk_enabled) {
      setZkInfo({ kdf_salt: res.kdf_salt, zk_verify: res.zk_verify });
      // Caller (App.jsx) derives the key and calls markUnlocked()
      setAuthState('locked');
    } else {
      setAuthState('ready');
    }
    return res;
  }

  /** Legacy single-user first launch (kept for compatibility). */
  async function setup(password) {
    const { token } = await api.auth.setup(password);
    storage.setToken(token);
    setAccountRole('admin');
    setAuthState('ready');
  }

  /** Multi-user registration. ZK material is derived client-side by the caller. */
  async function register(email, password, kdf_salt, zk_verify) {
    return applyAuthResponse(await api.auth.register(email, password, kdf_salt, zk_verify));
  }

  async function login(email, password) {
    return applyAuthResponse(await api.auth.login(email, password));
  }

  /** Called by App.jsx after the master key is derived + verified. */
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

  /** User chose to continue without the server running. */
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
    setup, register, login, logout, continueOffline,
    markUnlocked,
    setAccountEmail: setAccountEmailOnServer,
  };
}
