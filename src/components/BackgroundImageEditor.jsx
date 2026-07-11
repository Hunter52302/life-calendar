import { useRef } from 'react';
import { backgroundImageStyle } from '../lib/appearanceStyle.js';
import { DEFAULT_LAYOUT, DEFAULT_APPEARANCE_VISUALS } from '../hooks/useAppearance.js';

const FIT_OPTIONS = [
  ['cover', 'Cover'],
  ['contain', 'Contain'],
  ['stretch', 'Stretch'],
  ['original', 'Original size'],
];

// [label, positionX, positionY]
const POSITION_PRESETS = [
  ['Center', 50, 50],
  ['Top', 50, 0],
  ['Bottom', 50, 100],
  ['Left', 0, 50],
  ['Right', 100, 50],
];

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function Range({ label, min, max, step = 1, value, onChange, format }) {
  return (
    <label className="block space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
        <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-blue-500"
      />
    </label>
  );
}

// Small faux-calendar overlay so the user can judge how the image sits behind
// real UI while dragging/adjusting.
function CalendarPreviewOverlay() {
  return (
    <div className="absolute inset-0 p-2 flex flex-col gap-1.5 pointer-events-none">
      <div className="h-3 rounded bg-white/70 dark:bg-gray-800/70" />
      <div className="flex-1 grid grid-cols-7 gap-1">
        {Array.from({ length: 28 }).map((_, i) => (
          <div key={i} className="rounded bg-white/45 dark:bg-gray-800/45" />
        ))}
      </div>
    </div>
  );
}

export default function BackgroundImageEditor({ appearance, setAppearance, onClose }) {
  const previewRef = useRef(null);
  const dragRef = useRef(null);
  const { layout } = appearance;

  function patchLayout(patch) {
    setAppearance(a => ({ ...a, layout: { ...a.layout, ...patch } }));
  }

  function setVisual(patch) {
    setAppearance(a => ({ ...a, ...patch }));
  }

  function resetLayout() {
    setAppearance(a => ({ ...a, layout: { ...DEFAULT_LAYOUT } }));
  }

  function resetAppearanceOnly() {
    setAppearance(a => ({ ...a, ...DEFAULT_APPEARANCE_VISUALS }));
  }

  // Drag inside the preview to reposition the image (writes position %, so the
  // result is device-relative and survives on any screen size).
  function onPointerDown(e) {
    previewRef.current?.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      positionX: layout.positionX,
      positionY: layout.positionY,
    };
  }

  function onPointerMove(e) {
    const drag = dragRef.current;
    const box = previewRef.current;
    if (!drag || !box) return;
    const rect = box.getBoundingClientRect();
    // Dragging right should reveal the right side of the image, i.e. move the
    // focal point left — hence the subtraction.
    const dx = ((e.clientX - drag.startX) / rect.width) * 100;
    const dy = ((e.clientY - drag.startY) / rect.height) * 100;
    patchLayout({
      positionX: clamp(drag.positionX - dx, 0, 100),
      positionY: clamp(drag.positionY - dy, 0, 100),
    });
  }

  function onPointerUp(e) {
    previewRef.current?.releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Background image</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">Drag the preview to reposition.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Live preview */}
          <div
            ref={previewRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-move touch-none select-none"
          >
            <img
              src={appearance.image}
              alt=""
              draggable="false"
              style={{
                ...backgroundImageStyle(layout),
                opacity: appearance.opacity,
                filter: appearance.blur ? `blur(${appearance.blur}px)` : 'none',
              }}
            />
            <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${appearance.dim})` }} />
            <div style={{ opacity: appearance.panelAlpha }}>
              <CalendarPreviewOverlay />
            </div>
          </div>

          {/* Fit */}
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">Fit</span>
            <select
              value={layout.fit}
              onChange={e => patchLayout({ fit: e.target.value })}
              className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-2 py-1 outline-none focus:border-blue-400"
            >
              {FIT_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          {/* Position presets */}
          <div className="space-y-1.5">
            <span className="text-sm text-gray-600 dark:text-gray-300">Position</span>
            <div className="flex flex-wrap gap-1.5">
              {POSITION_PRESETS.map(([label, px, py]) => {
                const active = layout.positionX === px && layout.positionY === py;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => patchLayout({ positionX: px, positionY: py })}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                      active
                        ? 'border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <Range label="Zoom" min={50} max={300} value={layout.zoom}
            onChange={zoom => patchLayout({ zoom })} format={v => `${v}%`} />

          <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-4">
            <Range label="Opacity" min={0.1} max={1} step={0.05} value={appearance.opacity}
              onChange={opacity => setVisual({ opacity })} format={v => `${Math.round(v * 100)}%`} />
            <Range label="Blur" min={0} max={20} value={appearance.blur}
              onChange={blur => setVisual({ blur })} format={v => `${v}px`} />
            <Range label="Darkness overlay" min={0} max={0.9} step={0.05} value={appearance.dim}
              onChange={dim => setVisual({ dim })} format={v => `${Math.round(v * 100)}%`} />
            <Range label="Calendar-panel transparency" min={0.3} max={1} step={0.05} value={appearance.panelAlpha}
              onChange={panelAlpha => setVisual({ panelAlpha })} format={v => `${Math.round((1 - v) * 100)}%`} />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={resetLayout}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Reset image layout
            </button>
            <button
              type="button"
              onClick={resetAppearanceOnly}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Reset appearance only
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto text-sm px-4 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
