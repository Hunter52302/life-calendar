import { createContext, useContext, useState, useEffect } from 'react';
import { exportDek, importDek } from '../lib/zkEnvelope.js';

/**
 * Holds the in-memory data-encryption key (DEK) for the unlocked session.
 *
 * The DEK lives only in memory by default, so a reload re-prompts for the
 * password (the "unlock" screen). If the user opts into "stay unlocked on this
 * device", we stash the raw DEK in sessionStorage (per-tab, cleared on close —
 * never localStorage, never disk) and restore it on reload.
 *
 * The hooks consume the DEK as `masterKey` and gate on `isZkEnabled`, so those
 * names are kept here. Encryption is always on, so isZkEnabled is always true.
 */
const SESSION_KEY = 'lc-dek-session';

const CryptoContext = createContext({
  masterKey: null, isZkEnabled: true, dek: null,
  setDek: () => {}, lock: () => {}, sessionRestored: false,
});

export function CryptoProvider({ children }) {
  const [dek, setDekState] = useState(null);
  const [sessionRestored, setSessionRestored] = useState(false);

  // Attempt to restore a "stay unlocked" DEK once on mount.
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) { setSessionRestored(true); return; }
    importDek(stored)
      .then(k => setDekState(k))
      .catch(() => sessionStorage.removeItem(SESSION_KEY))
      .finally(() => setSessionRestored(true));
  }, []);

  /** Set the live DEK. `persist` opts into staying unlocked on this device. */
  async function setDek(key, persist = false) {
    setDekState(key);
    if (key && persist) {
      try { sessionStorage.setItem(SESSION_KEY, await exportDek(key)); } catch { /* ignore quota */ }
    }
  }

  function lock() {
    setDekState(null);
    sessionStorage.removeItem(SESSION_KEY);
  }

  return (
    <CryptoContext.Provider value={{
      dek,
      masterKey: dek,        // alias consumed by the data hooks
      isZkEnabled: true,     // encryption is mandatory
      setDek, lock, sessionRestored,
    }}>
      {children}
    </CryptoContext.Provider>
  );
}

export function useCrypto() {
  return useContext(CryptoContext);
}
