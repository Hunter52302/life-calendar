import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api.js';
import { encryptRecord, decryptRecord } from '../lib/cryptoRecord.js';

const STORAGE_KEY = 'lc-m-llm-settings';

const EMPTY = { provider: 'none', apiKey: '', endpoint: '', model: '' };

const LLM_TEXT_FIELDS = ['apiKey'];

function normalize(p) {
  return {
    provider: p.provider ?? 'none',
    apiKey:   p.apiKey   ?? '',
    endpoint: p.endpoint ?? '',
    model:    p.model    ?? '',
  };
}

async function asyncLoad() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    return normalize(JSON.parse(raw));
  } catch {
    return { ...EMPTY };
  }
}

async function encryptLlmSettings(key, settings) {
  return encryptRecord(key, settings, LLM_TEXT_FIELDS);
}

async function decryptLlmSettings(key, raw) {
  return decryptRecord(key, raw, LLM_TEXT_FIELDS);
}

export function useLlmSettings(authState, masterKey = null, isZkEnabled = false) {
  const [llmSettings, setLlmSettingsState] = useState({ ...EMPTY });
  const [ready, setReady] = useState(false);
  const zkActive = isZkEnabled && masterKey;

  useEffect(() => {
    asyncLoad().then(s => { setLlmSettingsState(s); setReady(true); });
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(llmSettings)).catch(() => {});
  }, [llmSettings, ready]);

  useEffect(() => {
    if (authState !== 'ready' || !ready) return;
    if (isZkEnabled && !masterKey) return;
    api.sync().then(async data => {
      if (!data.llmSettings) return;
      let serverSettings = data.llmSettings;
      if (zkActive) serverSettings = await decryptLlmSettings(masterKey, serverSettings);
      setLlmSettingsState(normalize(serverSettings));
    }).catch(() => {});
  }, [authState, ready, isZkEnabled, masterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOnline = authState === 'ready';

  const setLlmSettings = useCallback((updater) => {
    setLlmSettingsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (isOnline) {
        (zkActive
          ? encryptLlmSettings(masterKey, next)
          : Promise.resolve(next)
        ).then(toSend => api.llmSettings.set(toSend)).catch(console.warn);
      }
      return next;
    });
  }, [isOnline, zkActive, masterKey]);

  return { llmSettings, setLlmSettings };
}
