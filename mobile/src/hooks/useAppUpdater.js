import { useState, useEffect, useCallback } from 'react';
import * as Updates from 'expo-updates';
import { usePersistentState } from './usePersistentState.js';

/**
 * Wraps expo-updates (EAS Update OTA) for the mobile app: a manual "check
 * now", an auto-update toggle, and detection of a server-issued rollback
 * (an `eas update:roll-back-to-embedded` run by a maintainer shows up here
 * as `status === 'rollback'` and is applied the same way as a normal update —
 * there's no client-side "go back one version" in expo-updates, so reverting
 * a bad release is a maintainer action that every device then picks up).
 */
export function useAppUpdater() {
  const [autoUpdate, setAutoUpdate] = usePersistentState('lc-m-auto-update', false);
  const [status, setStatus] = useState('idle'); // idle | checking | available | rollback | latest | installing | error
  const [manifest, setManifest] = useState(null);

  const checkNow = useCallback(async () => {
    if (!Updates.isEnabled) { setStatus('latest'); return; }
    setStatus('checking');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isRollBackToEmbedded) {
        setManifest(null);
        setStatus('rollback');
      } else if (result.isAvailable) {
        setManifest(result.manifest);
        setStatus('available');
      } else {
        setManifest(null);
        setStatus('latest');
      }
    } catch {
      setStatus('error');
    }
  }, []);

  const apply = useCallback(async () => {
    if (!Updates.isEnabled) return;
    setStatus('installing');
    try {
      const result = await Updates.fetchUpdateAsync();
      if (result.isNew || result.isRollBackToEmbedded) {
        await Updates.reloadAsync();
      } else {
        setStatus('latest');
      }
    } catch {
      setStatus('error');
    }
  }, []);

  // Check once on launch.
  useEffect(() => { checkNow(); }, [checkNow]);

  // When auto-update is on, silently fetch + reload as soon as something's found.
  useEffect(() => {
    if (autoUpdate && (status === 'available' || status === 'rollback')) apply();
  }, [autoUpdate, status, apply]);

  return { autoUpdate, setAutoUpdate, status, manifest, checkNow, apply };
}
