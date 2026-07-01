const PB_BASE = (process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');

const INTEGRATIONS_PATH = `${PB_BASE}/api/collections/user_integrations/records`;
const SCHEDULES_PATH = `${PB_BASE}/api/collections/notification_schedules/records`;

function encodeFilter(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function asString(value, fallback = '') {
  return value === null || value === undefined ? fallback : String(value);
}

function asNullableString(value) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function asBool(value, fallback = false) {
  return value === null || value === undefined ? fallback : !!value;
}

function asNumber(value, fallback = null) {
  if (value === '' || value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function asJsonArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

async function pbFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  });

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

async function listAll(path, filter) {
  const items = [];
  let page = 1;

  for (;;) {
    const url = new URL(path);
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

async function findOne(path, filter) {
  const items = await listAll(path, filter);
  return items[0] ?? null;
}

async function deleteMatching(path, filter) {
  const items = await listAll(path, filter);
  await Promise.all(items.map(item => pbFetch(`${path}/${item.id}`, { method: 'DELETE' })));
}

function integrationFilter(userId, integrationId) {
  return `user = '${encodeFilter(userId)}' && integration_id = '${encodeFilter(integrationId)}'`;
}

function scheduleFilter(userId, scheduleId) {
  return `user = '${encodeFilter(userId)}' && schedule_id = '${encodeFilter(scheduleId)}'`;
}

function integrationFromRecord(record) {
  return {
    id: record.integration_id ?? record.id,
    type: record.type ?? '',
    label: asNullableString(record.label),
    endpoint_url: asNullableString(record.endpoint_url),
    push_token: asNullableString(record.push_token),
    include_hints: asBool(record.include_hints, false),
    enabled: asBool(record.enabled, true),
  };
}

function integrationToRecord(userId, integration) {
  return {
    user: userId,
    integration_id: asString(integration.id),
    type: asString(integration.type),
    label: integration.label ?? null,
    endpoint_url: integration.endpoint_url ?? null,
    push_token: integration.push_token ?? null,
    include_hints: integration.include_hints === true,
    enabled: integration.enabled !== false,
  };
}

function scheduleFromRecord(record) {
  return {
    id: record.schedule_id ?? record.id,
    integration_id: asNullableString(record.integration_id),
    trigger_type: record.trigger_type ?? '',
    offset_minutes: asNumber(record.offset_minutes, -30) ?? -30,
    time_of_day: asNullableString(record.time_of_day),
    days_of_week: asJsonArray(record.days_of_week, [0, 1, 2, 3, 4, 5, 6]),
    enabled: asBool(record.enabled, true),
  };
}

function scheduleToRecord(userId, schedule) {
  return {
    user: userId,
    schedule_id: asString(schedule.id),
    integration_id: schedule.integration_id ?? null,
    trigger_type: asString(schedule.trigger_type),
    offset_minutes: asNumber(schedule.offset_minutes, -30) ?? -30,
    time_of_day: schedule.time_of_day ?? null,
    days_of_week: asJsonArray(schedule.days_of_week, [0, 1, 2, 3, 4, 5, 6]),
    enabled: schedule.enabled !== false,
  };
}

export const pocketbaseUserIntegrations = {
  async getAll(userId) {
    const items = await listAll(INTEGRATIONS_PATH, `user = '${encodeFilter(userId)}'`);
    return items
      .map(record => ({ ...integrationFromRecord(record), _created: record.created ?? '' }))
      .sort((a, b) => String(a._created).localeCompare(String(b._created)))
      .map(({ _created, ...integration }) => integration);
  },

  async getById(userId, integrationId) {
    const existing = await findOne(INTEGRATIONS_PATH, integrationFilter(userId, integrationId));
    return existing ? integrationFromRecord(existing) : null;
  },

  async findByType(userId, type) {
    const existing = await findOne(INTEGRATIONS_PATH, `user = '${encodeFilter(userId)}' && type = '${encodeFilter(type)}'`);
    return existing ? integrationFromRecord(existing) : null;
  },

  async create(userId, integration) {
    const existing = await findOne(INTEGRATIONS_PATH, integrationFilter(userId, integration.id));
    if (existing) {
      const updated = await pbFetch(`${INTEGRATIONS_PATH}/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(integrationToRecord(userId, { ...integrationFromRecord(existing), ...integration })),
      });
      return integrationFromRecord(updated);
    }

    const created = await pbFetch(INTEGRATIONS_PATH, {
      method: 'POST',
      body: JSON.stringify(integrationToRecord(userId, integration)),
    });
    return integrationFromRecord(created);
  },

  async update(userId, integrationId, updates) {
    const existing = await findOne(INTEGRATIONS_PATH, integrationFilter(userId, integrationId));
    if (!existing) return null;
    const updated = await pbFetch(`${INTEGRATIONS_PATH}/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(integrationToRecord(userId, { ...integrationFromRecord(existing), ...updates, id: integrationId })),
    });
    return integrationFromRecord(updated);
  },

  async delete(userId, integrationId) {
    await deleteMatching(INTEGRATIONS_PATH, integrationFilter(userId, integrationId));
  },
};

export const pocketbaseNotificationSchedules = {
  async getAll(userId) {
    const items = await listAll(SCHEDULES_PATH, `user = '${encodeFilter(userId)}'`);
    return items
      .map(record => ({ ...scheduleFromRecord(record), _created: record.created ?? '' }))
      .sort((a, b) => String(a._created).localeCompare(String(b._created)))
      .map(({ _created, ...schedule }) => schedule);
  },

  async getAllActive(userId) {
    return (await this.getAll(userId)).filter(schedule => schedule.enabled);
  },

  async create(userId, schedule) {
    const existing = await findOne(SCHEDULES_PATH, scheduleFilter(userId, schedule.id));
    if (existing) {
      const updated = await pbFetch(`${SCHEDULES_PATH}/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(scheduleToRecord(userId, { ...scheduleFromRecord(existing), ...schedule })),
      });
      return scheduleFromRecord(updated);
    }

    const created = await pbFetch(SCHEDULES_PATH, {
      method: 'POST',
      body: JSON.stringify(scheduleToRecord(userId, schedule)),
    });
    return scheduleFromRecord(created);
  },

  async update(userId, scheduleId, updates) {
    const existing = await findOne(SCHEDULES_PATH, scheduleFilter(userId, scheduleId));
    if (!existing) return null;
    const updated = await pbFetch(`${SCHEDULES_PATH}/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(scheduleToRecord(userId, { ...scheduleFromRecord(existing), ...updates, id: scheduleId })),
    });
    return scheduleFromRecord(updated);
  },

  async delete(userId, scheduleId) {
    await deleteMatching(SCHEDULES_PATH, scheduleFilter(userId, scheduleId));
  },
};
