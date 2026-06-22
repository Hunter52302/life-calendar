import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import { encryptRecord, decryptRecord } from '../lib/cryptoRecord.js';
import { useCrypto } from '../context/CryptoContext.jsx';

const STORAGE_KEY = 'lc-llm-settings';

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

function loadFromStorage() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return { ...EMPTY };
    return normalize(JSON.parse(s));
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

export function useLlmSettings(authState) {
  const { masterKey, isZkEnabled } = useCrypto();
  const [llmSettings, setLlmSettingsState] = useState(loadFromStorage);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(llmSettings));
  }, [llmSettings]);

  useEffect(() => {
    if (authState !== 'ready') return;
    api.sync().then(async (data) => {
      if (!data.llmSettings) return;
      let serverSettings = data.llmSettings;
      if (isZkEnabled && masterKey) {
        serverSettings = await decryptLlmSettings(masterKey, serverSettings);
      }
      setLlmSettingsState(normalize(serverSettings));
    }).catch(() => {});
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOnline = authState === 'ready';

  const setLlmSettings = useCallback((updater) => {
    setLlmSettingsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (isOnline) {
        (isZkEnabled && masterKey
          ? encryptLlmSettings(masterKey, next)
          : Promise.resolve(next)
        ).then(toSend => api.llmSettings.set(toSend)).catch(console.warn);
      }
      return next;
    });
  }, [isOnline, isZkEnabled, masterKey]);

  return { llmSettings, setLlmSettings };
}
