import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api.js';
import { encryptRecord, decryptRecord, encryptJsonField, decryptJsonField } from '../lib/cryptoRecord.js';

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
