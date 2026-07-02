import { useState, useEffect, useCallback, useRef } from 'react';

const AUTO_UPDATE_KEY = 'pls_auto_update_enabled';
const PREVIOUS_VERSION_KEY = 'pls_previous_version';

const isTauri = () => typeof window !== 'undefined' && typeof window.__TAURI__ !== 'undefined';

const normalizeUpdate = update => ({
  version: update.version,
  currentVersion: update.current_version,
  body: update.body,
});

/**
 * Centralizes the Tauri desktop updater flow: startup checks, manual checks,
 * auto-install, and reverting to the last known-good version.
 */
export default function useDesktopUpdater() {
  const checkingRef = useRef(false);
  const installingRef = useRef(false);
  const [autoUpdate, setAutoUpdateState] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(AUTO_UPDATE_KEY) === 'true'
  );
  const [status, setStatus] = useState('idle'); // idle | checking | available | latest | installing | error
  const [pending, setPending] = useState(null); // { version, currentVersion, body }
  const [error, setError] = useState('');
  const [previousVersion, setPreviousVersion] = useState(
    () => (typeof localStorage !== 'undefined' && localStorage.getItem(PREVIOUS_VERSION_KEY)) || null
  );

  const setAutoUpdate = useCallback(value => {
    localStorage.setItem(AUTO_UPDATE_KEY, value ? 'true' : 'false');
    setAutoUpdateState(value);
  }, []);

  const install = useCallback(async updateInfo => {
    if (!isTauri() || installingRef.current) return;
    installingRef.current = true;
    setStatus('installing');
    setError('');
    try {
      if (updateInfo?.currentVersion) {
        localStorage.setItem(PREVIOUS_VERSION_KEY, updateInfo.currentVersion);
        setPreviousVersion(updateInfo.currentVersion);
      }
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('install_update');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      installingRef.current = false;
      setError(err?.message || String(err));
      setStatus('error');
    }
  }, []);

  const runCheck = useCallback(async ({ silent = false, installIfAvailable = false } = {}) => {
    if (!isTauri() || checkingRef.current) return null;
    checkingRef.current = true;
    if (!silent) setStatus('checking');
    setError('');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const update = await invoke('check_for_update');
      if (!update) {
        setPending(null);
        if (!silent) setStatus('latest');
        return null;
      }

      const normalized = normalizeUpdate(update);
      setPending(normalized);
      setStatus('available');
      if (installIfAvailable) await install(normalized);
      return normalized;
    } catch (err) {
      setError(err?.message || String(err));
      if (!silent) setStatus('error');
      return null;
    } finally {
      checkingRef.current = false;
    }
  }, [install]);

  const checkNow = useCallback(() => runCheck(), [runCheck]);

  const revert = useCallback(async () => {
    if (!isTauri() || !previousVersion) return;
    setStatus('installing');
    setError('');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('revert_update', { version: previousVersion });
      localStorage.removeItem(PREVIOUS_VERSION_KEY);
      setPreviousVersion(null);
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      setError(err?.message || String(err));
      setStatus('error');
    }
  }, [previousVersion]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      runCheck({ silent: true, installIfAvailable: autoUpdate });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autoUpdate, runCheck]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('update-available', event => {
        const normalized = normalizeUpdate(event.payload);
        setPending(normalized);
        setStatus('available');
        if (autoUpdate) install(normalized);
      }).then(fn => { unlisten = fn; });
    });
    return () => { unlisten?.(); };
  }, [autoUpdate, install]);

  useEffect(() => {
    if (!autoUpdate || !pending || status !== 'available') return undefined;
    const timer = window.setTimeout(() => {
      install(pending);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autoUpdate, install, pending, status]);

  return { autoUpdate, setAutoUpdate, status, pending, error, previousVersion, checkNow, install, revert };
}
