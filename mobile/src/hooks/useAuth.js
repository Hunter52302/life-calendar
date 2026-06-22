import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { storage } from '../lib/storage.js';
import { deriveKey, verifyKey, generateSalt, generateVerifyBlob } from '../lib/crypto.js';

/**
 * Authentication + zero-knowledge key management for mobile.
 *
 * States: checking | setup | login | locked | ready | offline | offline-ok
 *
 * Unlike the web (which splits this across useAuth + CryptoContext), the
 * mobile hook owns the master key directly: `masterKey` is a Uint8Array
 * held in JS memory only — never written to SecureStore or AsyncStorage.
 */
export function useAuth() {
  const [authState, setAuthState] = useState('checking');
  const [zkInfo, setZkInfo]       = useState(null); // { kdf_salt, zk_verify }
  const [masterKey, setMasterKey] = useState(null);
  const [isZkEnabled, setIsZkEnabled] = useState(false);

  useEffect(() => {
    api.auth.status()
      .then(({ isSetup, tokenValid, zk_enabled, kdf_salt, zk_verify }) => {
        if (tokenValid) {
          if (zk_enabled) {
            setZkInfo({ kdf_salt, zk_verify });
            setIsZkEnabled(true);
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
      .catch(() => setAuthState('offline'));
  }, []);

  /** Derive + verify the master key from a password. Throws when wrong. */
  async function unlock(password) {
    const info = zkInfo;
    if (!info) return;
    const key = await deriveKey(password, info.kdf_salt);
    if (!(await verifyKey(key, info.zk_verify))) {
      throw new Error('Incorrect password — your data stays encrypted until the right one is entered.');
    }
    setMasterKey(key);
    setIsZkEnabled(true);
    setAuthState('ready');
  }

  async function login(email, password) {
    const res = await api.auth.login(email, password);
    await storage.setToken(res.token);
    if (res.zk_enabled) {
      setZkInfo({ kdf_salt: res.kdf_salt, zk_verify: res.zk_verify });
      setIsZkEnabled(true);
      const key = await deriveKey(password, res.kdf_salt);
      if (await verifyKey(key, res.zk_verify)) {
        setMasterKey(key);
        setAuthState('ready');
      } else {
        // Password was admin-reset: data is under the previous password
        setAuthState('locked');
      }
    } else {
      setAuthState('ready');
    }
  }

  /** ZK is on by default: the key is derived locally before the account exists. */
  async function register(email, password) {
    const salt = generateSalt();
    const key  = await deriveKey(password, salt);
    const blob = await generateVerifyBlob(key);
    const res  = await api.auth.register(email, password, salt, blob);
    await storage.setToken(res.token);
    setZkInfo({ kdf_salt: salt, zk_verify: blob });
    setMasterKey(key);
    setIsZkEnabled(true);
    setAuthState('ready');
  }

  /** Legacy single-user first launch (password only). */
  async function setup(password) {
    const { token } = await api.auth.setup(password);
    await storage.setToken(token);
    setAuthState('ready');
  }

  async function logout() {
    await storage.removeToken();
    setMasterKey(null);
    setZkInfo(null);
    setIsZkEnabled(false);
    setAuthState('login');
  }

  function continueOffline() {
    setAuthState('offline-ok');
  }

  async function retry() {
    setAuthState('checking');
    try {
      const { isSetup, tokenValid, zk_enabled, kdf_salt, zk_verify } = await api.auth.status();
      if (tokenValid) {
        if (zk_enabled) {
          setZkInfo({ kdf_salt, zk_verify });
          setIsZkEnabled(true);
          setAuthState('locked');
        } else {
          setAuthState('ready');
        }
      } else if (!isSetup) setAuthState('setup');
      else                 setAuthState('login');
    } catch {
      setAuthState('offline');
    }
  }

  return {
    authState, masterKey, isZkEnabled,
    setup, register, login, unlock, logout, continueOffline, retry,
  };
}
