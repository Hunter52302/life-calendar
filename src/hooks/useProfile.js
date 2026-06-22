import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import { encryptRecord, decryptRecord, encryptJsonField, decryptJsonField } from '../lib/cryptoRecord.js';
import { useCrypto } from '../context/CryptoContext.jsx';

const STORAGE_KEY = 'lc-profile';

const EMPTY = {
  username: '',
  displayName: '',
  email: '',
  phones: [],
  birthday: '',
  homeAddress: '',
  otherAddresses: [],
};

function loadFromStorage() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return { ...EMPTY };
    const p = JSON.parse(s);
    return {
      username:       p.username       ?? '',
      displayName:    p.displayName    ?? '',
      email:          p.email          ?? '',
      phones:         Array.isArray(p.phones)         ? p.phones         : [],
      birthday:       p.birthday       ?? '',
      homeAddress:    p.homeAddress    ?? '',
      otherAddresses: Array.isArray(p.otherAddresses) ? p.otherAddresses : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

const PROFILE_TEXT_FIELDS = ['displayName', 'email', 'birthday', 'homeAddress'];
const PROFILE_JSON_FIELDS = ['phones', 'otherAddresses'];

async function encryptProfile(key, profile) {
  const out = await encryptRecord(key, profile, PROFILE_TEXT_FIELDS);
  for (const f of PROFILE_JSON_FIELDS) out[f] = await encryptJsonField(key, profile[f]);
  return out;
}

// Callers always run normalize() on the result, which fills in '' / [] for any
// field left untouched here (absent, or not actually encrypted on the server).
async function decryptProfile(key, raw) {
  const out = await decryptRecord(key, raw, PROFILE_TEXT_FIELDS);
  for (const f of PROFILE_JSON_FIELDS) out[f] = await decryptJsonField(key, raw[f]);
  return out;
}

function normalize(p) {
  return {
    username:       p.username       ?? '',
    displayName:    p.displayName    ?? '',
    email:          p.email          ?? '',
    phones:         Array.isArray(p.phones)         ? p.phones         : [],
    birthday:       p.birthday       ?? '',
    homeAddress:    p.homeAddress    ?? '',
    otherAddresses: Array.isArray(p.otherAddresses) ? p.otherAddresses : [],
  };
}

function isEmpty(p) {
  return !p.username && !p.displayName && !p.email &&
    (!p.phones || p.phones.length === 0) &&
    !p.birthday && !p.homeAddress &&
    (!p.otherAddresses || p.otherAddresses.length === 0);
}

export function useProfile(authState) {
  const { masterKey, isZkEnabled } = useCrypto();
  const [profile, setProfileState] = useState(loadFromStorage);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    if (authState !== 'ready') return;
    api.sync().then(async (data) => {
      if (!data.profile) return;
      let serverProfile = data.profile;
      if (isZkEnabled && masterKey) {
        serverProfile = await decryptProfile(masterKey, serverProfile);
      }
      serverProfile = normalize(serverProfile);
      if (isEmpty(serverProfile)) {
        const local = loadFromStorage();
        if (!isEmpty(local)) {
          setProfileState(local);
          const toSend = isZkEnabled && masterKey
            ? await encryptProfile(masterKey, local)
            : local;
          api.profile.set(toSend).catch(console.warn);
          return;
        }
      }
      setProfileState(serverProfile);
    }).catch(() => {});
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOnline = authState === 'ready';

  const setProfile = useCallback((updater) => {
    setProfileState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (isOnline) {
        (isZkEnabled && masterKey
          ? encryptProfile(masterKey, next)
          : Promise.resolve(next)
        ).then(toSend => api.profile.set(toSend)).catch(console.warn);
      }
      return next;
    });
  }, [isOnline, isZkEnabled, masterKey]);

  // Pass key directly to avoid race condition when called immediately after setMasterKey
  const syncProfile = useCallback(async (key) => {
    if (!isOnline) return;
    try {
      const raw = await api.profile.get();
      const effectiveKey = key ?? masterKey;
      let serverProfile = isZkEnabled && effectiveKey
        ? await decryptProfile(effectiveKey, raw)
        : raw;
      setProfileState(normalize(serverProfile));
    } catch { /* ignore */ }
  }, [isOnline, isZkEnabled, masterKey]);

  return { profile, setProfile, syncProfile };
}
