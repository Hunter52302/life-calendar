import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import { encryptRecord, decryptRecord } from '../lib/cryptoRecord.js';
import { useCrypto } from '../context/CryptoContext.jsx';
import { safeSetJSON } from '../lib/storage.js';

const STORAGE_KEY = 'lc-appearance';

// The image is stored as a (downscaled) data URL. When zero-knowledge sync is
// enabled it is encrypted like any other sensitive text field, so the server
// only ever sees ciphertext.
const APPEARANCE_TEXT_FIELDS = ['image'];

export const DEFAULT_LAYOUT = {
  fit: 'cover',        // cover | contain | stretch | original
  positionX: 50,       // 0..100  (% — device-relative, so it re-fits any screen)
  positionY: 50,       // 0..100
  zoom: 100,           // 50..300 (%)
};

// Visual-appearance controls that "Reset appearance only" restores.
export const DEFAULT_APPEARANCE_VISUALS = {
  opacity: 1,          // 0.1..1  image opacity
  blur: 0,             // 0..20   px
  dim: 0.15,           // 0..0.9  extra darkness on the image (scrim does most tinting)
  // 0.3..1 calendar-surface opacity (the scrim). Default below 1 so an uploaded
  // wallpaper shows through the calendar right away while staying readable; 1 =
  // fully solid (wallpaper hidden).
  panelAlpha: 0.6,
  // 0..100. At 0 the app uses solid panels; higher values make the main
  // surfaces clearer and increase the backdrop blur/saturation.
  glassIntensity: 0,
};

export const DEFAULT_APPEARANCE = {
  enabled: false,
  image: '',
  layout: { ...DEFAULT_LAYOUT },
  ...DEFAULT_APPEARANCE_VISUALS,
};

const clamp = (n, lo, hi, fallback) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
};

export function normalizeLayout(layout) {
  const l = layout || {};
  return {
    fit: ['cover', 'contain', 'stretch', 'original'].includes(l.fit) ? l.fit : 'cover',
    positionX: clamp(l.positionX, 0, 100, 50),
    positionY: clamp(l.positionY, 0, 100, 50),
    zoom: clamp(l.zoom, 50, 300, 100),
  };
}

export function normalize(a) {
  const s = a || {};
  return {
    enabled: !!s.enabled,
    image: typeof s.image === 'string' ? s.image : '',
    layout: normalizeLayout(s.layout),
    opacity: clamp(s.opacity, 0.1, 1, 1),
    blur: clamp(s.blur, 0, 20, 0),
    dim: clamp(s.dim, 0, 0.9, 0.35),
    panelAlpha: clamp(s.panelAlpha, 0.3, 1, 1),
    // Migrate the abandoned Go build's older boolean/strength pair when it is
    // present in synced appearance data.
    glassIntensity: clamp(
      s.glassIntensity ?? (s.glassEffect ? Number(s.glassStrength ?? 0.55) * 100 : 0),
      0, 100, 0
    ),
  };
}

function loadFromStorage() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return normalize(DEFAULT_APPEARANCE);
    return normalize(JSON.parse(s));
  } catch {
    return normalize(DEFAULT_APPEARANCE);
  }
}

function isEmpty(a) {
  return !a.image && !a.enabled;
}

async function encryptAppearance(key, appearance) {
  return encryptRecord(key, appearance, APPEARANCE_TEXT_FIELDS);
}

async function decryptAppearance(key, raw) {
  return decryptRecord(key, raw, APPEARANCE_TEXT_FIELDS);
}

export function useAppearance(authState) {
  const { masterKey, isZkEnabled } = useCrypto();
  const [appearance, setAppearanceState] = useState(loadFromStorage);

  useEffect(() => {
    safeSetJSON(STORAGE_KEY, appearance);
  }, [appearance]);

  // On login, pull the server copy. If the server has nothing yet but this
  // device has a local appearance, push the local one up (matches useProfile).
  useEffect(() => {
    if (authState !== 'ready') return;
    api.sync().then(async (data) => {
      if (!data.appearance) return;
      let server = data.appearance;
      if (isZkEnabled && masterKey) {
        server = await decryptAppearance(masterKey, server);
      }
      server = normalize(server);
      if (isEmpty(server)) {
        const local = loadFromStorage();
        if (!isEmpty(local)) {
          setAppearanceState(local);
          const toSend = isZkEnabled && masterKey
            ? await encryptAppearance(masterKey, local)
            : local;
          api.appearance.set(toSend).catch(console.warn);
          return;
        }
      }
      setAppearanceState(server);
    }).catch(() => {});
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOnline = authState === 'ready';

  const setAppearance = useCallback((updater) => {
    setAppearanceState(prev => {
      const next = normalize(typeof updater === 'function' ? updater(prev) : updater);
      if (isOnline) {
        (isZkEnabled && masterKey
          ? encryptAppearance(masterKey, next)
          : Promise.resolve(next)
        ).then(toSend => api.appearance.set(toSend)).catch(console.warn);
      }
      return next;
    });
  }, [isOnline, isZkEnabled, masterKey]);

  return { appearance, setAppearance };
}
