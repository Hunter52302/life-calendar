import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';

/**
 * Manages authentication state.
 *
 * States:
 *   checking  — verifying token with server on startup
 *   setup     — server reachable, no user created yet
 *   login     — user exists, token missing/expired
 *   ready     — authenticated and good to go
 *   offline   — server unreachable; app works from localStorage cache
 */
export function useAuth() {
  const [authState, setAuthState] = useState('checking');
  // 'checking' | 'setup' | 'login' | 'ready' | 'offline'

  useEffect(() => {
    api.auth.status()
      .then(({ isSetup, tokenValid }) => {
        if (!isSetup)        setAuthState('setup');
        else if (tokenValid) setAuthState('ready');
        else                 setAuthState('login');
      })
      .catch(() => {
        // Server not running — app still works from localStorage cache
        setAuthState('offline');
      });
  }, []);

  async function setup(password) {
    const { token } = await api.auth.setup(password);
    localStorage.setItem('lc-auth-token', token);
    setAuthState('ready');
  }

  async function login(password) {
    const { token } = await api.auth.login(password);
    localStorage.setItem('lc-auth-token', token);
    setAuthState('ready');
  }

  function logout() {
    localStorage.removeItem('lc-auth-token');
    setAuthState('login');
  }

  /** User chose to continue without the server running. */
  function continueOffline() {
    setAuthState('offline-ok');
  }

  return { authState, setup, login, logout, continueOffline };
}
