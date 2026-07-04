import { pbAuthedFetch } from './pbClient.js';

const PB_BASE = (process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
const EVENTS_PATH = `${PB_BASE}/api/collections/events/records`;

function encodeFilter(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildFilter(parts) {
  return parts.filter(Boolean).join(' && ');
}

function asNumber(value, fallback) {
  if (value === '' || value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function asString(value, fallback = '') {
  return value === null || value === undefined ? fallback : String(value);
}

function shouldApplyIncoming(existingUpdatedHlc, incomingUpdatedHlc) {
  if (incomingUpdatedHlc === undefined) return true;
  if (!existingUpdatedHlc) return true;
  if (!incomingUpdatedHlc) return false;
  return incomingUpdatedHlc > existingUpdatedHlc;
}

async function pbFetch(path, options = {}) {
  const res = await pbAuthedFetch(path, options);

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = body?.message ?? body?.data?.message ?? detail;
    } catch {}
    throw new Error(`PocketBase request failed: ${detail}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function listAll(filter) {
  const items = [];
  let page = 1;

  for (;;) {
    const url = new URL(EVENTS_PATH);
    url.searchParams.set('page', String(page));
    url.searchParams.set('perPage', '500');
    if (filter) url.searchParams.set('filter', filter);

    const data = await pbFetch(url.toString());
    items.push(...(data.items ?? []));

    if (!data.totalPages || page >= data.totalPages) break;
    page += 1;
  }

  return items;
}

function fromRecord(record) {
  if (!record) return null;
  return {
    id: record.event_id ?? record.id,
    label: record.label ?? '',
    category: record.category ?? null,
    color: record.color ?? null,
    calendar: record.calendar,
    series_id: record.series_id || null,
    week_start: record.week_start,
    day_of_week: record.day_of_week ?? 0,
    slot_start: record.slot_start ?? 0,
    slot_duration: record.slot_duration ?? 4,
    precision: record.precision ?? 1,
    is_all_day: !!record.is_all_day,
    source: record.source ?? null,
    source_calendar_id: record.source_calendar_id ?? null,
    plan_event_id: record.plan_event_id ?? null,
    notes: record.notes ?? null,
    location: record.location ?? '',
    meeting_url: record.meeting_url ?? '',
    travel_buffer_minutes: record.travel_buffer_minutes ?? 0,
    people: record.people ?? [],
    actions: record.actions ?? [],
    updatedAt: record.updated_hlc ?? null,
    deleted: !!record.deleted,
  };
}

function toRecord(userId, event) {
  const isAllDay = !!event.is_all_day;
  const slotStart = isAllDay ? 0 : asNumber(event.slot_start, 0);
  const slotDuration = isAllDay ? 1 : Math.max(1, asNumber(event.slot_duration, 4));

  return {
    event_id: asString(event.id),
    user: userId,
    label: asString(event.label),
    category: asString(event.category),
    color: asString(event.color),
    calendar: event.calendar,
    series_id: asString(event.series_id),
    week_start: asString(event.week_start),
    day_of_week: asNumber(event.day_of_week, 0),
    slot_start: slotStart,
    slot_duration: slotDuration,
    precision: asNumber(event.precision, 1),
    is_all_day: isAllDay,
    source: asString(event.source),
    source_calendar_id: asString(event.source_calendar_id),
    plan_event_id: asString(event.plan_event_id),
    notes: asString(event.notes),
    location: asString(event.location),
    meeting_url: asString(event.meeting_url),
    travel_buffer_minutes: asNumber(event.travel_buffer_minutes, 0),
    people: Array.isArray(event.people) ? event.people : [],
    actions: Array.isArray(event.actions) ? event.actions : [],
    updated_hlc: asString(event.updatedAt),
    deleted: event.deleted === true,
  };
}

async function findOneByEventId(userId, eventId) {
  const filter = buildFilter([
    `user = '${encodeFilter(userId)}'`,
    `event_id = '${encodeFilter(eventId)}'`,
  ]);
  const items = await listAll(filter);
  return items[0] ?? null;
}

async function deleteMatching(filter) {
  const items = await listAll(filter);
  await Promise.all(items.map(item => pbFetch(`${EVENTS_PATH}/${item.id}`, { method: 'DELETE' })));
}

export const pocketbaseEvents = {
  async getAll(userId) {
    const filter = `user = '${encodeFilter(userId)}'`;
    return (await listAll(filter)).map(fromRecord).filter(record => !record.deleted);
  },

  async getAllForSync(userId) {
    const filter = `user = '${encodeFilter(userId)}'`;
    return (await listAll(filter)).map(fromRecord);
  },

  async purgeExpiredTombstones(userId, retentionDays = 30) {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const tombstones = (await listAll(`user = '${encodeFilter(userId)}'`))
      .filter(item => !!item.deleted);
    await Promise.all(
      tombstones
        .filter(item => Date.parse(item.updated ?? item.created ?? '') < cutoff)
        .map(item => pbFetch(`${EVENTS_PATH}/${item.id}`, { method: 'DELETE' }))
    );
  },

  async create(userId, event) {
    const existing = await findOneByEventId(userId, event.id);
    if (existing) {
      if (!shouldApplyIncoming(existing.updated_hlc, event.updatedAt)) {
        return fromRecord(existing);
      }
      const updated = await pbFetch(`${EVENTS_PATH}/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(toRecord(userId, event)),
      });
      return fromRecord(updated);
    }

    const created = await pbFetch(EVENTS_PATH, {
      method: 'POST',
      body: JSON.stringify(toRecord(userId, event)),
    });
    return fromRecord(created);
  },

  async update(userId, eventId, updates) {
    const existing = await findOneByEventId(userId, eventId);
    if (!existing) return null;
    if (!shouldApplyIncoming(existing.updated_hlc, updates.updatedAt)) {
      return fromRecord(existing);
    }
    const updated = await pbFetch(`${EVENTS_PATH}/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(toRecord(userId, { ...fromRecord(existing), ...updates, id: eventId })),
    });
    return fromRecord(updated);
  },

  async delete(userId, eventId) {
    const existing = await findOneByEventId(userId, eventId);
    if (!existing) return;
    await pbFetch(`${EVENTS_PATH}/${existing.id}`, { method: 'DELETE' });
  },

  async deleteBySource(userId, source) {
    const items = await listAll(`user = '${encodeFilter(userId)}'`);
    await Promise.all(
      items
        .filter(item => (item.source ?? null) === source)
        .map(item => pbFetch(`${EVENTS_PATH}/${item.id}`, { method: 'DELETE' }))
    );
  },

  async deleteBySourceCalendar(userId, sourceCalendarId) {
    const items = await listAll(`user = '${encodeFilter(userId)}'`);
    await Promise.all(
      items
        .filter(item => (item.source_calendar_id ?? null) === sourceCalendarId)
        .map(item => pbFetch(`${EVENTS_PATH}/${item.id}`, { method: 'DELETE' }))
    );
  },

  async replaceBySource(userId, source, newEvents) {
    await this.deleteBySource(userId, source);
    await this.batchCreate(userId, newEvents.map(e => ({ ...e, source })));
  },

  async replaceBySourceCalendar(userId, sourceCalendarId, newEvents) {
    await this.deleteBySourceCalendar(userId, sourceCalendarId);
    await this.batchCreate(userId, newEvents.map(e => ({ ...e, source_calendar_id: sourceCalendarId })));
  },

  async batchCreate(userId, eventsArray) {
    for (const event of eventsArray) {
      const existing = await findOneByEventId(userId, event.id);
      if (existing) {
        if (!shouldApplyIncoming(existing.updated_hlc, event.updatedAt ?? null)) {
          continue;
        }
        await pbFetch(`${EVENTS_PATH}/${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(toRecord(userId, event)),
        });
      } else {
        await pbFetch(EVENTS_PATH, {
          method: 'POST',
          body: JSON.stringify(toRecord(userId, event)),
        });
      }
    }
  },
};
