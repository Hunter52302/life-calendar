/**
 * Notification Service
 * Runs a cron-like scheduler (every 60 seconds) that checks for pending
 * reminders and dispatches them to configured integrations.
 *
 * The server only knows TIMING metadata (slot_start, week_start, etc.) —
 * never event labels unless the user has set an integration_hint.
 */
import webpush from 'web-push';
import { randomUUID } from 'crypto';
import { userIntegrations, notificationSchedules, notificationLog, pushSubscriptions, habits, habitCompletions, events } from '../db/queries.js';
import { users } from '../db/queries.js';

// ── VAPID setup ───────────────────────────────────────────────────────────────

let vapidConfigured = false;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  vapidConfigured = true;
}

// ── Timezone helpers ──────────────────────────────────────────────────────────

function nowInTz(tz) {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      hour: parseInt(parts.hour, 10),
      minute: parseInt(parts.minute, 10),
      dayOfWeek: new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`).getDay(),
      timeStr: `${parts.hour}:${parts.minute}`,
    };
  } catch {
    const now = new Date();
    return {
      date: now.toISOString().slice(0, 10),
      hour: now.getHours(),
      minute: now.getMinutes(),
      dayOfWeek: now.getDay(),
      timeStr: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
    };
  }
}

function addDaysToDate(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Dispatch functions ────────────────────────────────────────────────────────

function discordPayload(title, body) {
  return { embeds: [{ title, description: body, color: 0x6d28d9, footer: { text: 'PLS Calendar' } }] };
}

function slackPayload(title, body) {
  return { text: `*${title}*\n${body}` };
}

async function dispatchWebhook(url, payload, label) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`${label} webhook responded ${res.status}`);
  } catch (err) {
    console.warn(`[notify] ${label} webhook failed:`, err.message);
    throw err;
  }
}

async function dispatchWebPush(userId, title, body) {
  if (!vapidConfigured) return;
  const subs = pushSubscriptions.getAll(userId);
  await Promise.allSettled(
    subs.map(({ subscription }) =>
      webpush.sendNotification(subscription, JSON.stringify({ title, body, url: '/' }))
        .catch(err => {
          console.warn('[notify] Web push failed:', err.message);
        })
    )
  );
}

async function dispatchExpoPush(token, title, body) {
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, title, body, sound: 'default' }),
    });
    if (!res.ok) throw new Error(`Expo push responded ${res.status}`);
  } catch (err) {
    console.warn('[notify] Expo push failed:', err.message);
    throw err;
  }
}

// ── Dispatch router ───────────────────────────────────────────────────────────

async function dispatchToIntegration(integration, title, body, entityId, userId) {
  const alreadySent = notificationLog.wasFiredToday(integration.id, entityId, title);
  if (alreadySent) return;

  let status = 'sent';
  try {
    if (integration.type === 'discord_webhook' && integration.endpoint_url) {
      await dispatchWebhook(integration.endpoint_url, discordPayload(title, body), 'Discord');
    } else if (integration.type === 'slack_webhook' && integration.endpoint_url) {
      await dispatchWebhook(integration.endpoint_url, slackPayload(title, body), 'Slack');
    } else if (integration.type === 'generic_webhook' && integration.endpoint_url) {
      await dispatchWebhook(integration.endpoint_url, { title, body, entity_id: entityId, timestamp: new Date().toISOString() }, 'Generic');
    } else if (integration.type === 'web_push') {
      await dispatchWebPush(userId, title, body);
    } else if (integration.type === 'expo_push' && integration.push_token) {
      await dispatchExpoPush(integration.push_token, title, body);
    }
  } catch {
    status = 'failed';
  }

  notificationLog.record(randomUUID(), userId, integration.id, title, entityId, status);
}

// ── Label helper (respects ZK) ────────────────────────────────────────────────

function resolveLabel(entity, integration) {
  if (integration.include_hints && entity.integration_hint) return entity.integration_hint;
  return null;
}

// ── Trigger checkers ──────────────────────────────────────────────────────────

function getEventsDueForReminder(userId, tzNow, offsetMinutes) {
  const allEvents = events.getAll(userId).filter(e => e.calendar === 'plan' && !e.is_all_day);
  const results = [];
  for (const ev of allEvents) {
    // Compute event's absolute datetime string in UTC
    const eventDate = addDaysToDate(ev.week_start, ev.day_of_week);
    const slotMinutes = ev.slot_start * 30;
    const eventHour = Math.floor(slotMinutes / 60);
    const eventMin  = slotMinutes % 60;
    // Check if (eventHour:eventMin + offsetMinutes) ≈ now in user's timezone
    const reminderHour   = Math.floor((slotMinutes + offsetMinutes) / 60);
    const reminderMinute = (slotMinutes + offsetMinutes) % 60;
    if (
      eventDate === tzNow.date &&
      tzNow.hour === reminderHour &&
      Math.abs(tzNow.minute - reminderMinute) < 1
    ) {
      results.push(ev);
    }
  }
  return results;
}

function getHabitsNotDoneToday(userId, tzNow) {
  const allHabits = habits.getAll(userId).filter(h => h.active && (h.target_days ?? [0,1,2,3,4,5,6]).includes(tzNow.dayOfWeek));
  const done = new Set(
    habitCompletions.getAll(userId).filter(c => c.date === tzNow.date).map(c => c.habit_id)
  );
  return allHabits.filter(h => !done.has(h.id));
}

// ── Main scheduler tick ───────────────────────────────────────────────────────

async function tick() {
  try {
    const allUsers = users.getAllForScheduler();
    for (const user of allUsers) {
      const tz = user.user_timezone ?? 'UTC';
      const tzNow = nowInTz(tz);
      const integrations = userIntegrations.getAll(user.id).filter(i => i.enabled);
      const schedules = notificationSchedules.getAllActive(user.id);

      if (!integrations.length || !schedules.length) continue;

      for (const sched of schedules) {
        if (!sched.days_of_week.includes(tzNow.dayOfWeek)) continue;

        const targets = sched.integration_id
          ? integrations.filter(i => i.id === sched.integration_id)
          : integrations;

        if (sched.trigger_type === 'event_reminder') {
          const dueEvents = getEventsDueForReminder(user.id, tzNow, sched.offset_minutes);
          for (const ev of dueEvents) {
            for (const integration of targets) {
              const hint = resolveLabel(ev, integration);
              const title = 'Upcoming Event';
              const body  = hint
                ? `${hint} starts in ${Math.abs(sched.offset_minutes)} min`
                : `You have an event starting in ${Math.abs(sched.offset_minutes)} min`;
              await dispatchToIntegration(integration, title, body, ev.id, user.id);
            }
          }
        }

        if (sched.trigger_type === 'habit_reminder') {
          const hhmm = tzNow.timeStr;
          if (sched.time_of_day && Math.abs(parseInt(hhmm.replace(':',''),10) - parseInt((sched.time_of_day ?? '').replace(':',''),10)) > 1) continue;
          const pending = getHabitsNotDoneToday(user.id, tzNow);
          if (!pending.length) continue;
          for (const integration of targets) {
            const hints = pending.map(h => resolveLabel(h, integration)).filter(Boolean);
            const title = 'Habit Check-in';
            const body  = hints.length
              ? `Still pending: ${hints.join(', ')}`
              : `You have ${pending.length} habit${pending.length > 1 ? 's' : ''} pending today`;
            const entityKey = `habits-${tzNow.date}`;
            await dispatchToIntegration(integration, title, body, entityKey, user.id);
          }
        }

        if (sched.trigger_type === 'daily_summary') {
          const hhmm = tzNow.timeStr;
          if (sched.time_of_day && Math.abs(parseInt(hhmm.replace(':',''),10) - parseInt((sched.time_of_day ?? '').replace(':',''),10)) > 1) continue;
          const todayEvents = events.getAll(user.id).filter(e => e.calendar === 'plan' && addDaysToDate(e.week_start, e.day_of_week) === tzNow.date);
          const pending = getHabitsNotDoneToday(user.id, tzNow);
          for (const integration of targets) {
            const title = `Daily Summary — ${tzNow.date}`;
            const body  = `${todayEvents.length} event${todayEvents.length !== 1 ? 's' : ''} planned · ${pending.length} habit${pending.length !== 1 ? 's' : ''} pending`;
            await dispatchToIntegration(integration, title, body, `daily-${tzNow.date}`, user.id);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[notify] Scheduler tick error:', err.message);
  }
}

// ── Streak milestone check (called directly from habits route) ─────────────────

export async function checkStreakMilestone(userId, habitId, currentStreak) {
  const milestones = [7, 30, 100, 365];
  if (!milestones.includes(currentStreak)) return;
  const emojis = { 7: '🔥', 30: '⭐', 100: '💎', 365: '👑' };
  const integrations = userIntegrations.getAll(userId).filter(i => i.enabled);
  const habit = habits.getById(userId, habitId);
  for (const integration of integrations) {
    const hint = resolveLabel(habit ?? {}, integration);
    const title = `Streak Milestone ${emojis[currentStreak]}`;
    const body  = hint
      ? `${hint}: ${currentStreak}-day streak!`
      : `You hit a ${currentStreak}-day streak on one of your habits!`;
    await dispatchToIntegration(integration, title, body, `streak-${habitId}-${currentStreak}`, userId);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

let intervalHandle = null;

export function startScheduler() {
  if (intervalHandle) return;
  intervalHandle = setInterval(tick, 60_000);
  console.log('[notify] Notification scheduler started (60s interval)');
}

export function stopScheduler() {
  if (intervalHandle) { clearInterval(intervalHandle); intervalHandle = null; }
}

export { dispatchToIntegration, dispatchWebhook, discordPayload, slackPayload, dispatchWebPush, dispatchExpoPush };
