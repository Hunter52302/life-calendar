import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { storage } from '../lib/storage.js';
import { createEnvelope, deriveAuthVerifier, unlockWithPassword } from '../lib/zkEnvelope.js';

/**
 * Mobile auth aligned with the current server envelope model.
 *
 * States:
 *   checking | setup | login | unlock | recovery | ready | offline | offline-ok
 */
export function useAuth() {
  const [authState, setAuthState] = useState('checking');
  const [zkInfo, setZkInfo] = useState(null); // { kdfSalt, wrappedDekPassword }
  const [masterKey, setMasterKey] = useState(null); // raw DEK bytes
  const [recoveryCode, setRecoveryCode] = useState(null);

  useEffect(() => {
    api.auth.status()
      .then(applyStatus)
      .catch(() => setAuthState('offline'));
  }, []);

  function applyStatus({ isSetup, tokenValid, auth_salt, kdf_salt, wrapped_dek_password }) {
    if (tokenValid) {
      setZkInfo({
        authSalt: auth_salt ?? null,
        kdfSalt: kdf_salt ?? null,
        wrappedDekPassword: wrapped_dek_password ?? null,
      });
      setMasterKey(null);
      setAuthState('unlock');
      return;
    }

    setMasterKey(null);
    setZkInfo(null);
    setRecoveryCode(null);
    setAuthState(isSetup ? 'login' : 'setup');
  }

  async function unlock(password) {
    if (!zkInfo?.kdfSalt || !zkInfo?.wrappedDekPassword) {
      throw new Error('This account is missing its unlock envelope.');
    }

    try {
      const dek = await unlockWithPassword(zkInfo, password);
      setMasterKey(dek);
      setAuthState('ready');
    } catch {
      throw new Error('Incorrect password.');
    }
  }

  async function login(email, password) {
    const salts = await api.auth.prelogin(email);
    const authVerifier = await deriveAuthVerifier(password, salts.auth_salt);
    const res = await api.auth.login(email, authVerifier);
    await storage.setToken(res.token);

    const nextInfo = {
      authSalt: salts.auth_salt,
      kdfSalt: res.kdf_salt,
      wrappedDekPassword: res.wrapped_dek_password,
    };
    setZkInfo(nextInfo);

    try {
      const dek = await unlockWithPassword(nextInfo, password);
      setMasterKey(dek);
      setAuthState('ready');
    } catch {
      setMasterKey(null);
      setAuthState('unlock');
      throw new Error('Signed in, but this password could not unlock your data.');
    }
  }

  async function register(email, password) {
    const envelope = await createEnvelope(password);
    const res = await api.auth.register(email, envelope.authVerifier, {
      authSalt: envelope.authSalt,
      kdfSalt: envelope.kdfSalt,
      recoverySalt: envelope.recoverySalt,
      recoveryAuthSalt: envelope.recoveryAuthSalt,
      recoveryVerifier: envelope.recoveryVerifier,
      wrappedDekPassword: envelope.wrappedDekPassword,
      wrappedDekRecovery: envelope.wrappedDekRecovery,
    });

    await storage.setToken(res.token);
    setZkInfo({
      authSalt: envelope.authSalt,
      kdfSalt: envelope.kdfSalt,
      wrappedDekPassword: envelope.wrappedDekPassword,
    });
    setMasterKey(envelope.dek);
    setRecoveryCode(envelope.recoveryCode);
    setAuthState('recovery');
  }

  function acknowledgeRecoveryCode() {
    setRecoveryCode(null);
    setAuthState('ready');
  }

  async function logout() {
    await storage.removeToken();
    setMasterKey(null);
    setZkInfo(null);
    setRecoveryCode(null);
    setAuthState('login');
  }

  async function deleteAccount(authVerifier) {
    const res = await api.auth.deleteAccount(authVerifier);
    await storage.removeToken();
    setMasterKey(null);
    setZkInfo(null);
    setRecoveryCode(null);
    setAuthState(res.isSetup ? 'login' : 'setup');
    return res;
  }

  function continueOffline() {
    setAuthState('offline-ok');
  }

  async function retry() {
    setAuthState('checking');
    try {
      applyStatus(await api.auth.status());
    } catch {
      setAuthState('offline');
    }
  }

  return {
    authState,
    zkInfo,
    masterKey,
    isZkEnabled: true,
    recoveryCode,
    register,
    login,
    unlock,
    logout,
    deleteAccount,
    continueOffline,
    retry,
    acknowledgeRecoveryCode,
  };
}
