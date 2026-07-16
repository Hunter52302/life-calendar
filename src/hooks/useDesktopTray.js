import { useEffect, useRef } from 'react';
import { formatApproxDuration } from '../lib/reminders.js';

/**
 * useDesktopTray — desktop-only (Tauri) "next event" tray reminder.
 *
 * Keeps the system-tray / menubar item showing the next upcoming planned event
 * so it's gently in view, and fires a native desktop notification a configurable
 * number of minutes before each event starts.
 *
 * Zero-knowledge friendly: event labels are already decrypted in the browser
 * layer, so the text we push to the tray / notifications never leaves the
 * desktop — the server is never involved. No-ops entirely outside a Tauri
 * window (web/PWA use server-side web-push instead).
 */

const isTauri = () => typeof window !== 'undefined' && typeof window.__TAURI__ !== 'undefined';

/** Absolute start time of an event from its (week_start, day_of_week, slot_start). */
function eventStart(ev) {
  const d = new Date(ev.week_start + 'T00:00:00');
  d.setDate(d.getDate() + (ev.day_of_week ?? 0));
  // slot_start is in the event's own precision (0.5h or 1h per slot), not fixed
  // 30-min slots — convert with precision so hourly-precision events aren't halved.
  d.setMinutes((ev.slot_start ?? 0) * (ev.precision || 0.5) * 60);
  return d;
}

function fmtTime(d, military) {
  const h = d.getHours();
  const m = d.getMinutes();
  if (military) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const ap  = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

/** "today 3:00 PM" / "tomorrow 9:00 AM" / "Fri 9:00 AM" */
function fmtWhen(d, military) {
  const now = new Date();
  const t   = fmtTime(d, military);
  if (d.toDateString() === now.toDateString()) return `today ${t}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow ${t}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${t}`;
}

/** Compact label for the always-visible menu-bar title (kept short on purpose). */
function fmtBarTitle(ev, start, military) {
  const name = (ev.label || 'Event').trim();
  const short = name.length > 22 ? name.slice(0, 21) + '…' : name;
  const mins = Math.round((start - Date.now()) / 60000);
  let when;
  if (mins < 60) when = `${Math.max(0, mins)}m`;
  else if (mins < 24 * 60) when = fmtTime(new Date(start), military);
  else when = fmtWhen(new Date(start), military);
  return `${short} · ${when}`;
}

export default function useDesktopTray(planEvents, { enabled = true, offsetMinutes = 10, militaryTime = false, showTitleInBar = false } = {}) {
  // Track which (event,instance) reminders we've already fired this session.
  const notifiedRef = useRef(new Set());
  // Latest events without re-subscribing the interval on every change.
  const eventsRef = useRef(planEvents);
  eventsRef.current = planEvents;

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let invoke = null;
    let sendNotification = null;

    // Reminders turned off: stop updating AND clear whatever "Next: …" line /
    // menu-bar title we last pushed, so the tray doesn't keep showing a stale
    // reminder. (Returning early without this left the last event stuck there.)
    if (!enabled) {
      (async () => {
        try {
          ({ invoke } = await import('@tauri-apps/api/core'));
          if (!cancelled) {
            await invoke('update_next_event', { label: 'No upcoming events', tooltip: 'PLS Calendar', title: '' });
          }
        } catch { /* tray not ready yet */ }
      })();
      // Forget fired reminders so re-enabling starts fresh for future events.
      notifiedRef.current.clear();
      return () => { cancelled = true; };
    }

    async function load() {
      ({ invoke } = await import('@tauri-apps/api/core'));
      const notif = await import('@tauri-apps/plugin-notification');
      sendNotification = notif.sendNotification;
      try {
        let granted = await notif.isPermissionGranted();
        if (!granted) granted = (await notif.requestPermission()) === 'granted';
      } catch { /* permission API unavailable — sendNotification will still try */ }
    }

    function nextUpcoming(now) {
      let best = null;
      for (const ev of eventsRef.current || []) {
        if (ev.is_all_day) continue;
        const start = eventStart(ev).getTime();
        if (start <= now) continue;
        if (!best || start < best.start) best = { ev, start };
      }
      return best;
    }

    async function tick() {
      if (cancelled || !invoke) return;
      const now = Date.now();

      // 1) Refresh the tray's "next event" line + tooltip.
      const next = nextUpcoming(now);
      try {
        if (next) {
          const label   = `Next: ${next.ev.label || 'Event'} — ${fmtWhen(new Date(next.start), militaryTime)}`;
          const tooltip = `PLS Calendar\n${label}`;
          const title   = showTitleInBar ? fmtBarTitle(next.ev, next.start, militaryTime) : '';
          await invoke('update_next_event', { label, tooltip, title });
        } else {
          await invoke('update_next_event', { label: 'No upcoming events', tooltip: 'PLS Calendar', title: '' });
        }
      } catch { /* tray not ready yet */ }

      // 2) Fire a reminder for any event crossing the (start - offset) threshold.
      for (const ev of eventsRef.current || []) {
        if (ev.is_all_day) continue;
        const start    = eventStart(ev).getTime();
        const remindAt = start - offsetMinutes * 60 * 1000;
        const key      = `${ev.id}-${start}`;
        if (now >= remindAt && now < start && !notifiedRef.current.has(key)) {
          notifiedRef.current.add(key);
          const mins = Math.max(1, Math.round((start - now) / 60000));
          try {
            sendNotification?.({ title: 'Upcoming event', body: `${ev.label || 'Event'} starts in ${formatApproxDuration(mins)}` });
          } catch { /* ignore */ }
        }
      }
    }

    load().then(() => tick());
    const iv = setInterval(tick, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [enabled, offsetMinutes, militaryTime, showTitleInBar]);
}
