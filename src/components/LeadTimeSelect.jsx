import { useState } from 'react';
import { LEAD_TIME_PRESETS, LEAD_TIME_UNITS, splitMinutes } from '../lib/reminders.js';

/**
 * LeadTimeSelect — a preset dropdown ("10 minutes before" … "2 weeks before")
 * plus a Custom (value + unit) input, reporting the chosen lead time back as a
 * positive number of minutes via onChange.
 *
 * Controlled by `valueMinutes`. Used for both the desktop-tray reminder offset
 * and the server-push event-reminder schedules, so the two stay in lockstep.
 */
export default function LeadTimeSelect({ valueMinutes, onChange, selectClassName = '', inputClassName = '' }) {
  const isPreset = (m) => LEAD_TIME_PRESETS.some((p) => p.minutes === m);

  const seed = splitMinutes(valueMinutes);
  const [customValue, setCustomValue] = useState(seed.value);
  const [customUnit, setCustomUnit] = useState(seed.unit);
  // Whether the Custom inputs are showing. Sticky: picking "Custom…" keeps it
  // open even if the entered value happens to equal a preset.
  const [custom, setCustom] = useState(!isPreset(valueMinutes));

  function emitCustom(value, unit) {
    const safe = Math.max(1, Number.isFinite(value) ? value : 1);
    onChange(safe * LEAD_TIME_UNITS[unit]);
  }

  function handleSelect(e) {
    const next = e.target.value;
    if (next === 'custom') {
      // Seed the Custom inputs from the value currently in effect.
      const s = splitMinutes(valueMinutes);
      setCustomValue(s.value);
      setCustomUnit(s.unit);
      setCustom(true);
      emitCustom(s.value, s.unit);
    } else {
      setCustom(false);
      onChange(parseInt(next, 10));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select value={custom ? 'custom' : String(valueMinutes)} onChange={handleSelect} className={selectClassName}>
        {LEAD_TIME_PRESETS.map((p) => (
          <option key={p.minutes} value={p.minutes}>{p.label}</option>
        ))}
        <option value="custom">Custom…</option>
      </select>
      {custom && (
        <span className="flex items-center gap-1">
          <input
            type="number"
            min="1"
            value={customValue}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              setCustomValue(Number.isFinite(v) ? v : '');
              emitCustom(v, customUnit);
            }}
            className={inputClassName}
          />
          <select
            value={customUnit}
            onChange={(e) => { setCustomUnit(e.target.value); emitCustom(customValue, e.target.value); }}
            className={selectClassName}
          >
            {Object.keys(LEAD_TIME_UNITS).map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">before</span>
        </span>
      )}
    </div>
  );
}
