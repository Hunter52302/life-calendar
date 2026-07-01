const PB_BASE = (process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');

const CALENDAR_CONNECTIONS_PATH = `${PB_BASE}/api/collections/calendar_connections/records`;
const PUSH_SUBSCRIPTIONS_PATH = `${PB_BASE}/api/collections/push_subscriptions/records`;
const NOTIFICATION_LOG_PATH = `${PB_BASE}/api/collections/notification_log/records`;

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

function asNumber(value, fallback = null) {
  if (value === '' || value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function asJsonObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
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

function calendarConnectionFilter(userId, connectionId) {
  return `user = '${encodeFilter(userId)}' && connection_id = '${encodeFilter(connectionId)}'`;
}

function pushEndpointFilter(userId, endpoint) {
  return `user = '${encodeFilter(userId)}' && endpoint = '${encodeFilter(endpoint)}'`;
}

function notificationLogFilter(integrationId, entityId, triggerType, firedDate) {
  const entityPart = entityId === null || entityId === undefined
    ? "entity_id = ''"
    : `entity_id = '${encodeFilter(entityId)}'`;
  return [
    `integration_id = '${encodeFilter(integrationId)}'`,
    entityPart,
    `trigger_type = '${encodeFilter(triggerType)}'`,
    `fired_date = '${encodeFilter(firedDate)}'`,
  ].join(' && ');
}

function calendarConnectionFromRecord(record, includeTokens = false) {
  const base = {
    id: record.connection_id ?? record.id,
    provider: record.provider,
    accountEmail: asNullableString(record.account_email),
    createdAt: asNumber(record.created_at_epoch, 0) ?? 0,
  };
  if (!includeTokens) return base;
  return {
    ...base,
    access_token: asString(record.access_token),
    refresh_token: asString(record.refresh_token),
    token_expires_at: asNumber(record.token_expires_at, 0) ?? 0,
    scope: asNullableString(record.scope),
  };
}

function calendarConnectionToRecord(userId, conn) {
  return {
    user: userId,
    connection_id: asString(conn.id),
    provider: asString(conn.provider),
    account_email: conn.accountEmail ?? null,
    access_token: asString(conn.accessToken ?? conn.access_token),
    refresh_token: asString(conn.refreshToken ?? conn.refresh_token),
    token_expires_at: asNumber(conn.tokenExpiresAt ?? conn.token_expires_at, 0) ?? 0,
    scope: conn.scope ?? null,
    created_at_epoch: asNumber(conn.createdAt ?? conn.created_at_epoch, Math.floor(Date.now() / 1000)) ?? Math.floor(Date.now() / 1000),
  };
}

export const pocketbaseCalendarConnections = {
  async getAll(userId) {
    const items = await listAll(CALENDAR_CONNECTIONS_PATH, `user = '${encodeFilter(userId)}'`);
    return items
      .map(record => calendarConnectionFromRecord(record, false))
      .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  },

  async getById(userId, id) {
    const existing = await findOne(CALENDAR_CONNECTIONS_PATH, calendarConnectionFilter(userId, id));
    return existing ? calendarConnectionFromRecord(existing, true) : null;
  },

  async create(userId, conn) {
    const existing = await findOne(CALENDAR_CONNECTIONS_PATH, calendarConnectionFilter(userId, conn.id));
    if (existing) {
      const updated = await pbFetch(`${CALENDAR_CONNECTIONS_PATH}/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(calendarConnectionToRecord(userId, {
          ...calendarConnectionFromRecord(existing, true),
          ...conn,
        })),
      });
      return calendarConnectionFromRecord(updated, true);
    }

    const created = await pbFetch(CALENDAR_CONNECTIONS_PATH, {
      method: 'POST',
      body: JSON.stringify(calendarConnectionToRecord(userId, conn)),
    });
    return calendarConnectionFromRecord(created, true);
  },

  async updateTokens(id, { accessToken, tokenExpiresAt, refreshToken }) {
    const existing = await findOne(CALENDAR_CONNECTIONS_PATH, `connection_id = '${encodeFilter(id)}'`);
    if (!existing) return null;
    const updated = await pbFetch(`${CALENDAR_CONNECTIONS_PATH}/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
        ...(refreshToken !== undefined ? { refresh_token: refreshToken } : {}),
      }),
    });
    return calendarConnectionFromRecord(updated, true);
  },

  async delete(userId, id) {
    await deleteMatching(CALENDAR_CONNECTIONS_PATH, calendarConnectionFilter(userId, id));
  },
};

export const pocketbasePushSubscriptions = {
  async getAll(userId) {
    const items = await listAll(PUSH_SUBSCRIPTIONS_PATH, `user = '${encodeFilter(userId)}'`);
    return items.map(record => ({
      id: record.subscription_id ?? record.id,
      user_id: record.user ?? userId,
      subscription: asJsonObject(record.subscription, {}),
      created_at: asNumber(record.created_at_epoch, 0) ?? 0,
    }));
  },

  async upsert(userId, id, subscription) {
    const endpoint = subscription?.endpoint;
    if (!endpoint) return;
    const existing = await findOne(PUSH_SUBSCRIPTIONS_PATH, pushEndpointFilter(userId, endpoint));
    const body = {
      user: userId,
      subscription_id: id,
      endpoint,
      subscription,
      created_at_epoch: Math.floor(Date.now() / 1000),
    };

    if (existing) {
      await pbFetch(`${PUSH_SUBSCRIPTIONS_PATH}/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      return;
    }

    await pbFetch(PUSH_SUBSCRIPTIONS_PATH, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async deleteByEndpoint(userId, endpoint) {
    await deleteMatching(PUSH_SUBSCRIPTIONS_PATH, pushEndpointFilter(userId, endpoint));
  },
};

export const pocketbaseNotificationLog = {
  async wasFiredToday(integrationId, entityId, triggerType) {
    const today = new Date().toISOString().slice(0, 10);
    return !!(await findOne(
      NOTIFICATION_LOG_PATH,
      notificationLogFilter(integrationId, entityId ?? '', triggerType, today),
    ));
  },

  async record(id, userId, integrationId, triggerType, entityId, status = 'sent') {
    await pbFetch(NOTIFICATION_LOG_PATH, {
      method: 'POST',
      body: JSON.stringify({
        user: userId,
        log_id: id,
        integration_id: integrationId,
        trigger_type: triggerType,
        entity_id: entityId ?? '',
        fired_date: new Date().toISOString().slice(0, 10),
        status,
      }),
    });
  },
};
