import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import { encryptField, decryptField, DECRYPT_FAILURE_PLACEHOLDER } from '../lib/crypto.js';
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

async function encryptProfile(key, profile) {
  let phones = profile.phones;
  let otherAddresses = profile.otherAddresses;
  return {
    username:       profile.username,
    displayName:    profile.displayName ? await encryptField(key, profile.displayName) : profile.displayName || null,
    email:          profile.email       ? await encryptField(key, profile.email)       : profile.email       || null,
    phones:         phones?.length      ? await encryptField(key, JSON.stringify(phones))          : phones,
    birthday:       profile.birthday    ? await encryptField(key, profile.birthday)    : profile.birthday    || null,
    homeAddress:    profile.homeAddress ? await encryptField(key, profile.homeAddress) : profile.homeAddress || null,
    otherAddresses: otherAddresses?.length ? await encryptField(key, JSON.stringify(otherAddresses)) : otherAddresses,
  };
}

async function decryptProfile(key, raw) {
  let phones = raw.phones;
  if (phones && typeof phones === 'string') {
    const decrypted = await decryptField(key, phones);
    try { phones = decrypted === null ? [] : JSON.parse(decrypted); } catch { phones = []; }
  }
  let otherAddresses = raw.otherAddresses;
  if (otherAddresses && typeof otherAddresses === 'string') {
    const decrypted = await decryptField(key, otherAddresses);
    try { otherAddresses = decrypted === null ? [] : JSON.parse(decrypted); } catch { otherAddresses = []; }
  }
  return {
    username:       raw.username    ?? '',
    displayName:    raw.displayName ? (await decryptField(key, raw.displayName)) ?? DECRYPT_FAILURE_PLACEHOLDER : '',
    email:          raw.email       ? (await decryptField(key, raw.email))       ?? DECRYPT_FAILURE_PLACEHOLDER : '',
    phones:         Array.isArray(phones)         ? phones         : [],
    birthday:       raw.birthday    ? (await decryptField(key, raw.birthday))    ?? DECRYPT_FAILURE_PLACEHOLDER : '',
    homeAddress:    raw.homeAddress ? (await decryptField(key, raw.homeAddress)) ?? DECRYPT_FAILURE_PLACEHOLDER : '',
    otherAddresses: Array.isArray(otherAddresses) ? otherAddresses : [],
  };
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
