import { useState, useEffect, useCallback } from 'react';
import { safeSetJSON } from '../lib/storage.js';

// Full-repaint color theming. The user picks three colors — primary (surfaces/
// background), accent (buttons, toggles, links, highlights) and text — and every
// other tone (panel, secondary panel, border, muted text, accent hover) is
// derived so a whole theme reads coherently from just those three. Mirrors the
// CSS-variable approach of the Go version, adapted to this Tailwind app: the
// derived values feed CSS variables that a gated override layer in index.css
// maps the app's Tailwind color classes onto (only while a non-default theme is
// active, so the default "Blue" look is left completely untouched).

const STORAGE_KEY = 'lc-theme-colors';

// `blue` is the app's native look — selecting it applies NO overrides at all.
export const THEME_PRESETS = {
  blue:     { label: 'Blue',          isDefault: true },
  green:    { label: 'Black / Green', primary: '#020403', accent: '#22c55e', text: '#ecfdf5' },
  graphite: { label: 'Graphite',      primary: '#111114', accent: '#14b8a6', text: '#f4f6f8' },
};

export const DEFAULT_CUSTOM = { primary: '#0b0f19', accent: '#3b82f6', text: '#f8fafc' };

// ── tiny hex-colour helpers ───────────────────────────────────────────────
function clampByte(n) { return Math.max(0, Math.min(255, Math.round(n))); }
function parseHex(hex) {
  const h = String(hex || '').replace('#', '');
  const s = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0');
  const int = parseInt(s.slice(0, 6), 16) || 0;
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}
function toHex({ r, g, b }) { return '#' + [r, g, b].map(v => clampByte(v).toString(16).padStart(2, '0')).join(''); }
function mix(a, b, t) {
  const A = parseHex(a), B = parseHex(b);
  return toHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t });
}
function luminance(hex) { const { r, g, b } = parseHex(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

// Expand the 3 base colours into the full set of CSS-variable values.
export function derivePalette({ primary, accent, text }) {
  return {
    '--lc-bg':           primary,
    '--lc-panel':        mix(primary, text, 0.055),
    '--lc-panel-2':      mix(primary, text, 0.11),
    '--lc-line':         mix(primary, text, 0.18),
    '--lc-muted':        mix(text, primary, 0.42),
    '--lc-text':         text,
    '--lc-accent':       accent,
    '--lc-accent-hover': mix(accent, '#000000', 0.15),
    '--lc-accent-soft':  mix(primary, accent, 0.22),
    '--lc-accent-text':  luminance(accent) > 0.6 ? '#0b0f19' : '#ffffff',
  };
}

const VAR_NAMES = Object.keys(derivePalette(DEFAULT_CUSTOM));

// Remap Tailwind v4's own colour tokens to the theme. Tailwind compiles every
// utility as e.g. `background-color: var(--color-blue-500)`, so overriding these
// tokens retints all of them at once — no per-class rules, no specificity fights.
// We set them as inline custom properties on <html> from JS (below) rather than
// in a stylesheet, because Tailwind's Lightning CSS minifier strips a build-time
// rule that redefines `--color-*` tokens. Inline props survive and still win over
// Tailwind's `@theme` `:root` declarations.
function tokenRemap(p) {
  return {
    '--color-gray-950': p['--lc-bg'],
    '--color-gray-900': p['--lc-bg'],
    '--color-gray-800': p['--lc-panel'],
    '--color-gray-700': p['--lc-panel-2'],
    '--color-gray-600': p['--lc-panel-2'],
    '--color-gray-500': p['--lc-muted'],
    '--color-gray-400': p['--lc-muted'],
    '--color-gray-300': p['--lc-text'],
    '--color-gray-200': p['--lc-text'],
    '--color-gray-100': p['--lc-text'],
    '--color-blue-50':    p['--lc-accent-soft'],
    '--color-blue-300':   p['--lc-accent'],
    '--color-blue-400':   p['--lc-accent'],
    '--color-blue-500':   p['--lc-accent'],
    '--color-blue-600':   p['--lc-accent-hover'],
    '--color-blue-700':   p['--lc-accent-hover'],
    '--color-blue-900':   p['--lc-accent-soft'],
    '--color-indigo-400': p['--lc-accent'],
    '--color-indigo-500': p['--lc-accent'],
    '--color-indigo-600': p['--lc-accent-hover'],
  };
}
const TOKEN_NAMES = Object.keys(tokenRemap(derivePalette(DEFAULT_CUSTOM)));

function paletteFor(preset, custom) {
  if (preset === 'custom') return derivePalette({ ...DEFAULT_CUSTOM, ...custom });
  const p = THEME_PRESETS[preset];
  if (!p || p.isDefault) return null; // blue / unknown → native look, no override
  return derivePalette(p);
}

function applyVars(preset, custom) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const palette = paletteFor(preset, custom);
  if (!palette) {
    [...VAR_NAMES, ...TOKEN_NAMES].forEach(name => root.style.removeProperty(name));
    if (document.body) document.body.style.removeProperty('background-color');
    return;
  }
  const all = { ...palette, ...tokenRemap(palette) };
  Object.entries(all).forEach(([name, value]) => root.style.setProperty(name, value));
  // Body sits outside the app root — tint it too so overscroll/gaps match.
  if (document.body) document.body.style.setProperty('background-color', palette['--lc-bg']);
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      preset: s?.preset && (THEME_PRESETS[s.preset] || s.preset === 'custom') ? s.preset : 'blue',
      custom: { ...DEFAULT_CUSTOM, ...(s?.custom || {}) },
    };
  } catch {
    return { preset: 'blue', custom: { ...DEFAULT_CUSTOM } };
  }
}

export function useTheme() {
  const [state, setState] = useState(load);

  useEffect(() => {
    safeSetJSON(STORAGE_KEY, state);
    applyVars(state.preset, state.custom);
  }, [state]);

  const setThemePreset = useCallback((preset) => setState(s => ({ ...s, preset })), []);
  const setCustomThemeColor = useCallback(
    (key, value) => setState(s => ({ ...s, preset: 'custom', custom: { ...s.custom, [key]: value } })),
    []
  );
  const resetCustomTheme = useCallback(() => setState(s => ({ ...s, custom: { ...DEFAULT_CUSTOM } })), []);

  return {
    themePreset: state.preset,
    customTheme: state.custom,
    isThemed: state.preset !== 'blue',
    setThemePreset,
    setCustomThemeColor,
    resetCustomTheme,
  };
}
