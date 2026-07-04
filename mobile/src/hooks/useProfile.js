import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api.js';
import { encryptRecord, decryptRecord, encryptJsonField, decryptJsonField } from '../lib/cryptoRecord.js';
import { encryptField, decryptField } from '../lib/crypto.js';

const STORAGE_KEY = 'lc-m-profile';

const EMPTY = {
  email: '',
  phones: [],
  birthday: '',
  homeAddress: {},
  otherAddresses: [],
};

function normalizeAddress(value) {
  if (!value) return {};
  if (typeof value === 'string') return value ? { line1: value } : {};
  return {
    line1: value.line1 ?? value.primary ?? value.address ?? '',
    line2: value.line2 ?? value.secondary ?? '',
    city: value.city ?? value.locality ?? '',
    region: value.region ?? value.stateProvince ?? value.state ?? value.province ?? '',
    postalCode: value.postalCode ?? value.zipCode ?? value.zip ?? '',
    country: value.country ?? '',
  };
}

function normalizeAddressList(list) {
  return Array.isArray(list)
    ? list.map(item => ({ ...item, address: normalizeAddress(item.address ?? item) }))
    : [];
}

async function asyncLoad() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const p = JSON.parse(raw);
    return {
      email:          p.email          ?? '',
      phones:         Array.isArray(p.phones)         ? p.phones         : [],
      birthday:       p.birthday       ?? '',
      homeAddress:    normalizeAddress(p.homeAddress),
      otherAddresses: normalizeAddressList(p.otherAddresses),
    };
  } catch {
    return { ...EMPTY };
  }
}

const PROFILE_TEXT_FIELDS = ['email', 'birthday'];
const PROFILE_JSON_FIELDS = ['phones', 'otherAddresses'];

async function encryptProfile(key, profile) {
  const out = await encryptRecord(key, profile, PROFILE_TEXT_FIELDS);
  for (const f of PROFILE_JSON_FIELDS) out[f] = await encryptJsonField(key, profile[f]);
  if (profile.homeAddress && Object.values(profile.homeAddress).some(Boolean)) {
    out.homeAddress = await encryptField(key, JSON.stringify(normalizeAddress(profile.homeAddress)));
  } else {
    out.homeAddress = null;
  }
  return out;
}

// Callers always run normalize() on the result, which fills in '' / [] for any
// field left untouched here (absent, or not actually encrypted on the server).
async function decryptProfile(key, raw) {
  const out = await decryptRecord(key, raw, PROFILE_TEXT_FIELDS);
  for (const f of PROFILE_JSON_FIELDS) out[f] = await decryptJsonField(key, raw[f]);
  if (raw.homeAddress && typeof raw.homeAddress === 'string') {
    const decrypted = await decryptField(key, raw.homeAddress);
    if (decrypted) {
      try { out.homeAddress = JSON.parse(decrypted); }
      catch { out.homeAddress = decrypted; }
    }
  }
  return out;
}

function normalize(p) {
  return {
    email:          p.email          ?? '',
    phones:         Array.isArray(p.phones)         ? p.phones         : [],
    birthday:       p.birthday       ?? '',
    homeAddress:    normalizeAddress(p.homeAddress),
    otherAddresses: normalizeAddressList(p.otherAddresses),
  };
}

function isEmpty(p) {
  return !p.email &&
    (!p.phones || p.phones.length === 0) &&
    !p.birthday && !Object.values(normalizeAddress(p.homeAddress)).some(Boolean) &&
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
