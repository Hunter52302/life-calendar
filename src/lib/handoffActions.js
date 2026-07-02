export const MAP_PROVIDERS = [
  { id: 'apple', label: 'Apple Maps' },
  { id: 'google', label: 'Google Maps' },
  { id: 'waze', label: 'Waze' },
  { id: 'copy', label: 'Copy address' },
];

export function buildMapUrl(provider, destination) {
  const encoded = encodeURIComponent(String(destination || '').trim());
  if (!encoded) return '';

  switch (provider) {
    case 'apple':
      return `https://maps.apple.com/?daddr=${encoded}&dirflg=d`;
    case 'google':
      return `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`;
    case 'waze':
      return `https://waze.com/ul?q=${encoded}&navigate=yes`;
    default:
      return '';
  }
}

export function isLikelyUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export async function openExternalUrl(url) {
  if (!url) return;

  if (typeof window !== 'undefined' && typeof window.__TAURI__ !== 'undefined') {
    const { open } = await import('@tauri-apps/plugin-opener');
    await open(url);
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function copyText(value) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
}
