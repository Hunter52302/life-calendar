import { backgroundImageStyle } from '../lib/appearanceStyle.js';

// Full-viewport layer that sits behind the whole app (z-index below the UI).
// Because the layer is fixed to the viewport and the image is positioned with
// percentages, the picture re-fits automatically to any screen or device.
// A separate dim overlay darkens it so foreground text stays legible.
export default function AppBackground({ appearance }) {
  if (!appearance?.enabled || !appearance.image) return null;

  return (
    <div className="app-background" aria-hidden="true">
      <img
        src={appearance.image}
        alt=""
        draggable="false"
        style={{
          ...backgroundImageStyle(appearance.layout),
          opacity: appearance.opacity ?? 1,
          filter: appearance.blur ? `blur(${appearance.blur}px)` : 'none',
        }}
      />
      <div
        className="app-background-dim"
        style={{ background: `rgba(0, 0, 0, ${appearance.dim ?? 0.35})` }}
      />
      {/* Theme-coloured tint; opacity comes from --lc-panel-alpha on the root. */}
      <div className="app-background-scrim" />
    </div>
  );
}
