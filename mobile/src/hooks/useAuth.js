import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { storage } from '../lib/storage.js';

export function useAuth() {
  const [authState, setAuthState] = useState('checking');

  useEffect(() => {
    api.auth.status()
      .then(({ isSetup, tokenValid }) => {
        if (!isSetup)        setAuthState('setup');
        else if (tokenValid) setAuthState('ready');
        else                 setAuthState('login');
      })
      .catch(() => setAuthState('offline'));
  }, []);

  async function setup(password) {
    const { token } = await api.auth.setup(password);
    await storage.setToken(token);
    setAuthState('ready');
  }

  async function login(password) {
    const { token } = await api.auth.login(password);
    await storage.setToken(token);
    setAuthState('ready');
  }

  async function logout() {
    await storage.removeToken();
    setAuthState('login');
  }

  function continueOffline() {
    setAuthState('offline-ok');
  }

  async function retry() {
    setAuthState('checking');
    try {
      const { isSetup, tokenValid } = await api.auth.status();
      if (!isSetup)        setAuthState('setup');
      else if (tokenValid) setAuthState('ready');
      else                 setAuthState('login');
    } catch {
      setAuthState('offline');
    }
  }

  return { authState, setup, login, logout, continueOffline, retry };
}
