/**
 * useAdminSecrets
 *
 * Manages the admin "No Touchy" secrets panel state.
 *
 * Admin token lives in sessionStorage (tab-scoped, clears on close).
 * When the token expires the server returns 401 → adminRequest() clears it
 * automatically → isAuthenticated becomes false → AdminGate re-appears.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';

const ADMIN_TOKEN_KEY = 'lc-admin-token';

export function useAdminSecrets() {
  const [adminToken, setAdminToken] = useState(
    () => sessionStorage.getItem(ADMIN_TOKEN_KEY)
  );
  const [secrets,         setSecrets]         = useState([]);
  const [infisicalStatus, setInfisicalStatus] = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);

  const isAuthenticated = !!adminToken;

  // ── Auth ──────────────────────────────────────────────────────────────────

  async function adminLogin(password) {
    setError(null);
    try {
      const { adminToken: token } = await api.admin.auth(password);
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
      setAdminToken(token);
    } catch (err) {
      setError(err.message ?? 'Login failed');
      throw err;
    }
  }

  function adminLogout() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminToken(null);
    setSecrets([]);
    setInfisicalStatus(null);
  }

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!sessionStorage.getItem(ADMIN_TOKEN_KEY)) return;
    setLoading(true);
    setError(null);
    try {
      const [secretsList, status] = await Promise.all([
        api.admin.listSecrets(),
        api.admin.infisicalStatus(),
      ]);
      setSecrets(secretsList);
      setInfisicalStatus(status);
    } catch (err) {
      if (err.adminExpired) {
        setAdminToken(null);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminToken) fetchAll();
  }, [adminToken, fetchAll]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  async function createSecret(data) {
    setError(null);
    try {
      const newSecret = await api.admin.createSecret(data);
      setSecrets(prev => [...prev, newSecret]);
      return newSecret;
    } catch (err) {
      if (err.adminExpired) setAdminToken(null);
      setError(err.message);
      throw err;
    }
  }

  async function updateSecret(keyName, data) {
    setError(null);
    try {
      const updated = await api.admin.updateSecret(keyName, data);
      setSecrets(prev => prev.map(s => s.keyName === keyName ? updated : s));
      return updated;
    } catch (err) {
      if (err.adminExpired) setAdminToken(null);
      setError(err.message);
      throw err;
    }
  }

  async function restoreSecret(keyName) {
    setError(null);
    try {
      await api.admin.restoreSecret(keyName);
      await fetchAll(); // Refresh to get updated hasPreviousValue
    } catch (err) {
      if (err.adminExpired) setAdminToken(null);
      setError(err.message);
      throw err;
    }
  }

  async function deleteSecret(keyName, opts = {}) {
    setError(null);
    try {
      await api.admin.deleteSecret(keyName, opts);
      setSecrets(prev => prev.filter(s => s.keyName !== keyName));
    } catch (err) {
      if (err.adminExpired) setAdminToken(null);
      setError(err.message);
      throw err;
    }
  }

  return {
    isAuthenticated,
    adminLogin,
    adminLogout,
    secrets,
    infisicalStatus,
    loading,
    error,
    createSecret,
    updateSecret,
    restoreSecret,
    deleteSecret,
    refresh: fetchAll,
  };
}
