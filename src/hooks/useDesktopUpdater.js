import { useState, useEffect, useCallback } from 'react';

const AUTO_UPDATE_KEY = 'pls_auto_update_enabled';
const PREVIOUS_VERSION_KEY = 'pls_previous_version';

const isTauri = () => typeof window !== 'undefined' && typeof window.__TAURI__ !== 'undefined';

/**
 * Centralizes the Tauri desktop updater flow: manual "check now", the
 * auto-update toggle, and reverting to the last known-good version.
 * No-ops everywhere outside a Tauri window (web/PWA never touches this).
 */
export default function useDesktopUpdater() {
  const [autoUpdate, setAutoUpdateState] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(AUTO_UPDATE_KEY) === 'true'
  );
  const [status, setStatus] = useState('idle'); // idle | checking | available | latest | installing | error
  const [pending, setPending] = useState(null); // { version, currentVersion, body }
  const [previousVersion, setPreviousVersion] = useState(
    () => (typeof localStorage !== 'undefined' && localStorage.getItem(PREVIOUS_VERSION_KEY)) || null
  );

  const setAutoUpdate = useCallback(value => {
    localStorage.setItem(AUTO_UPDATE_KEY, value ? 'true' : 'false');
    setAutoUpdateState(value);
  }, []);

  const install = useCallback(async updateInfo => {
    if (!isTauri()) return;
    setStatus('installing');
    try {
      if (updateInfo?.currentVersion) {
        localStorage.setItem(PREVIOUS_VERSION_KEY, updateInfo.currentVersion);
        setPreviousVersion(updateInfo.currentVersion);
      }
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('install_update');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch {
      setStatus('error');
    }
  }, []);

  const checkNow = useCallback(async () => {
    if (!isTauri()) return;
    setStatus('checking');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const update = await invoke('check_for_update');
      if (update) {
        const normalized = { version: update.version, currentVersion: update.current_version, body: update.body };
        setPending(normalized);
        setStatus('available');
      } else {
        setPending(null);
        setStatus('latest');
      }
    } catch {
      setStatus('error');
    }
  }, []);

  const revert = useCallback(async () => {
    if (!isTauri() || !previousVersion) return;
    setStatus('installing');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('revert_update', { version: previousVersion });
      localStorage.removeItem(PREVIOUS_VERSION_KEY);
      setPreviousVersion(null);
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch {
      setStatus('error');
    }
  }, [previousVersion]);

  // The Rust side checks once on startup and emits this event regardless of
  // the auto-update setting — that decision is made here, in JS.
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('update-available', event => {
        const info = event.payload;
        const normalized = { version: info.version, currentVersion: info.current_version, body: info.body };
        setPending(normalized);
        setStatus('available');
        if (autoUpdate) install(normalized);
      }).then(fn => { unlisten = fn; });
    });
    return () => { unlisten?.(); };
  }, [autoUpdate, install]);

  return { autoUpdate, setAutoUpdate, status, pending, previousVersion, checkNow, install, revert };
}
