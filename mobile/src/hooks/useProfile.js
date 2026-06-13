import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api.js';
import { encryptField, decryptField } from '../lib/crypto.js';

const STORAGE_KEY = 'lc-m-profile';

const EMPTY = {
  username: '',
  displayName: '',
  email: '',
  phones: [],
  birthday: '',
  homeAddress: '',
  otherAddresses: [],
};

async function asyncLoad() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const p = JSON.parse(raw);
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
  return {
    username:       profile.username,
    displayName:    profile.displayName ? await encryptField(key, profile.displayName) : profile.displayName || null,
    email:          profile.email       ? await encryptField(key, profile.email)       : profile.email       || null,
    phones:         profile.phones?.length ? await encryptField(key, JSON.stringify(profile.phones)) : profile.phones,
    birthday:       profile.birthday    ? await encryptField(key, profile.birthday)    : profile.birthday    || null,
    homeAddress:    profile.homeAddress ? await encryptField(key, profile.homeAddress) : profile.homeAddress || null,
    otherAddresses: profile.otherAddresses?.length ? await encryptField(key, JSON.stringify(profile.otherAddresses)) : profile.otherAddresses,
  };
}

async function decryptProfile(key, raw) {
  let phones = raw.phones;
  if (phones && typeof phones === 'string') {
    try { phones = JSON.parse(await decryptField(key, phones)); } catch { phones = []; }
  }
  let otherAddresses = raw.otherAddresses;
  if (otherAddresses && typeof otherAddresses === 'string') {
    try { otherAddresses = JSON.parse(await decryptField(key, otherAddresses)); } catch { otherAddresses = []; }
  }
  return {
    username:       raw.username    ?? '',
    displayName:    raw.displayName ? await decryptField(key, raw.displayName) : '',
    email:          raw.email       ? await decryptField(key, raw.email)       : '',
    phones:         Array.isArray(phones)         ? phones         : [],
    birthday:       raw.birthday    ? await decryptField(key, raw.birthday)    : '',
    homeAddress:    raw.homeAddress ? await decryptField(key, raw.homeAddress) : '',
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

export function useProfile(authState, masterKey = null, isZkEnabled = false) {
  const [profile, setProfileState] = useState({ ...EMPTY });
  const [ready, setReady] = useState(false);
  const zkActive = isZkEnabled && masterKey;

  useEffect(() => {
    asyncLoad().then(p => { setProfileState(p); setReady(true); });
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile)).catch(() => {});
  }, [profile, ready]);

  useEffect(() => {
    if (authState !== 'ready' || !ready) return;
    if (isZkEnabled && !masterKey) return;
    api.sync().then(async data => {
      if (!data.profile) return;
      let serverProfile = data.profile;
      if (zkActive) serverProfile = await decryptProfile(masterKey, serverProfile);
      serverProfile = normalize(serverProfile);
      if (isEmpty(serverProfile)) {
        const local = await asyncLoad();
        if (!isEmpty(local)) {
          setProfileState(local);
          const toSend = zkActive ? await encryptProfile(masterKey, local) : local;
          api.profile.set(toSend).catch(console.warn);
          return;
        }
      }
      setProfileState(serverProfile);
    }).catch(() => {});
  }, [authState, ready, isZkEnabled, masterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOnline = authState === 'ready';

  const setProfile = useCallback((updater) => {
    setProfileState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (isOnline) {
        (zkActive
          ? encryptProfile(masterKey, next)
          : Promise.resolve(next)
        ).then(toSend => api.profile.set(toSend)).catch(console.warn);
      }
      return next;
    });
  }, [isOnline, zkActive, masterKey]);

  return { profile, setProfile };
}
