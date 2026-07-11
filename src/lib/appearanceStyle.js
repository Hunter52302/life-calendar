import { normalizeLayout } from '../hooks/useAppearance.js';

// Translate a background layout into inline <img> styles. Shared by the live
// AppBackground layer and the editor preview so both render identically. The
// image element itself fills its container (the viewport, or the preview box),
// and object-fit/object-position + a zoom transform decide how the picture sits
// inside it — all relative, so the same layout re-fits whatever screen it's on.
export function backgroundImageStyle(layoutInput) {
  const layout = normalizeLayout(layoutInput);
  const objectFit =
    layout.fit === 'stretch' ? 'fill' :
    layout.fit === 'original' ? 'none' :
    layout.fit; // cover | contain
  return {
    width: '100%',
    height: '100%',
    objectFit,
    objectPosition: `${layout.positionX}% ${layout.positionY}%`,
    transform: `scale(${layout.zoom / 100})`,
    transformOrigin: `${layout.positionX}% ${layout.positionY}%`,
  };
}
