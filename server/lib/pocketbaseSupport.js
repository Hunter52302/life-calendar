import { pbAuthedFetch } from './pbClient.js';

const PB_BASE = (process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');

const DEFAULT_CATEGORY_KEYWORDS = {
  sleep: ['sleep', 'bed', 'nap'],
  work: ['meeting', 'shift', 'work', 'standup', 'call'],
  school: ['class', 'lecture', 'homework', 'study', 'exam'],
  'free-time': ['free', 'hangout', 'relax', 'gym', 'workout'],
};

function collectionUrl(name) {
  return `${PB_BASE}/api/collections/${name}/records`;
}

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

function asJsonValue(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  return value;
}

async function pbFetch(path, options = {}) {
  const res = await pbAuthedFetch(path, options);

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = body?.message ?? body?.data?.message ?? detail;
      // PocketBase puts per-field validation errors in `data` (e.g.
      // { connection_id: { code, message } }). Append it so failures name the
      // offending field instead of the useless generic "Failed to create record".
      if (body?.data && Object.keys(body.data).length) {
        detail += ` ${JSON.stringify(body.data)}`;
      }
    } catch {}
    throw new Error(`PocketBase request failed: ${detail}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function listAll(collection, filter) {
  const items = [];
  let page = 1;

  for (;;) {
    const url = new URL(collectionUrl(collection));
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

async function findOne(collection, filter) {
  const items = await listAll(collection, filter);
  return items[0] ?? null;
}

async function deleteMatching(collection, filter) {
  const items = await listAll(collection, filter);
  await Promise.all(items.map(item => pbFetch(`${collectionUrl(collection)}/${item.id}`, { method: 'DELETE' })));
}

function customCategoryFilter(userId, id) {
  return `user = '${encodeFilter(userId)}' && custom_id = '${encodeFilter(id)}'`;
}

function linkedCalendarFilter(userId, id) {
  return `user = '${encodeFilter(userId)}' && calendar_id = '${encodeFilter(id)}'`;
}

function customCategoryFromRecord(record) {
  return {
    id: record.custom_id ?? record.id,
    label: record.label ?? '',
    color: record.color ?? '',
  };
}

function customCategoryToRecord(userId, category) {
  return {
    user: userId,
    custom_id: asString(category.id),
    label: asString(category.label),
    color: asString(category.color),
  };
}

function linkedCalendarFromRecord(record) {
  return {
    id: record.calendar_id ?? record.id,
    name: record.name ?? '',
    filename: asNullableString(record.filename),
    calendar: record.calendar ?? 'plan',
    importedAt: asNullableString(record.imported_at),
    color: asNullableString(record.color),
    excludeFromReality: asBool(record.exclude_from_reality),
    url: asNullableString(record.url),
    syncEnabled: asBool(record.sync_enabled),
    lastSyncedAt: asNumber(record.last_synced_at, null),
    source: record.source ?? 'ics',
    connectionId: asNullableString(record.connection_id),
    externalCalendarId: asNullableString(record.external_calendar_id),
  };
}

function linkedCalendarToRecord(userId, calendar) {
  return {
    user: userId,
    calendar_id: asString(calendar.id),
    name: asString(calendar.name),
    filename: calendar.filename ?? null,
    calendar: asString(calendar.calendar, 'plan'),
    imported_at: calendar.importedAt ?? null,
    color: calendar.color ?? null,
    exclude_from_reality: calendar.excludeFromReality === true,
    url: calendar.url ?? null,
    sync_enabled: calendar.syncEnabled === true,
    last_synced_at: asNumber(calendar.lastSyncedAt, null),
    source: asString(calendar.source, 'ics'),
    connection_id: calendar.connectionId ?? null,
    external_calendar_id: calendar.externalCalendarId ?? null,
  };
}

function userProfileDefault() {
  return {
    username: null,
    displayName: null,
    email: null,
    phones: [],
    birthday: null,
    homeAddress: null,
    otherAddresses: [],
  };
}

function userProfileFromRecord(record) {
  if (!record) return userProfileDefault();
  return {
    username: asNullableString(record.username),
    displayName: asNullableString(record.display_name),
    email: asNullableString(record.email),
    phones: asJsonValue(record.phone_numbers, []),
    birthday: asNullableString(record.birthday),
    homeAddress: asNullableString(record.home_address),
    otherAddresses: asJsonValue(record.other_addresses, []),
  };
}

function userProfileToRecord(userId, data) {
  return {
    user: userId,
    username: data.username ?? null,
    display_name: data.displayName ?? null,
    email: data.email ?? null,
    phone_numbers: data.phones ?? [],
    birthday: data.birthday ?? null,
    home_address: data.homeAddress ?? null,
    other_addresses: data.otherAddresses ?? [],
  };
}

function userLlmSettingsDefault() {
  return {
    provider: 'none',
    apiKey: null,
    endpoint: null,
    model: null,
  };
}

function userLlmSettingsFromRecord(record) {
  if (!record) return userLlmSettingsDefault();
  return {
    provider: record.provider ?? 'none',
    apiKey: asNullableString(record.api_key),
    endpoint: asNullableString(record.endpoint),
    model: asNullableString(record.model),
  };
}

function userLlmSettingsToRecord(userId, data) {
  return {
    user: userId,
    provider: data.provider ?? 'none',
    api_key: data.apiKey ?? null,
    endpoint: data.endpoint ?? null,
    model: data.model ?? null,
  };
}

// Appearance (background image + visual controls) is stored as one opaque JSON
// blob — the client owns its shape, and with zero-knowledge sync the `image`
// field arrives already encrypted, so the server never interprets it.
function userAppearanceFromRecord(record) {
  if (!record) return null;
  return asJsonValue(record.data, null);
}

function userAppearanceToRecord(userId, data) {
  return {
    user: userId,
    data: data ?? {},
  };
}

export const pbCustomCategories = {
  async getAll(userId) {
    return (await listAll('custom_categories', `user = '${encodeFilter(userId)}'`)).map(customCategoryFromRecord);
  },

  async create(userId, category) {
    const existing = await findOne('custom_categories', customCategoryFilter(userId, category.id));
    if (existing) {
      const updated = await pbFetch(`${collectionUrl('custom_categories')}/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(customCategoryToRecord(userId, category)),
      });
      return customCategoryFromRecord(updated);
    }

    const created = await pbFetch(collectionUrl('custom_categories'), {
      method: 'POST',
      body: JSON.stringify(customCategoryToRecord(userId, category)),
    });
    return customCategoryFromRecord(created);
  },

  async exists(userId, id) {
    return !!(await findOne('custom_categories', customCategoryFilter(userId, id)));
  },

  async update(userId, id, updates) {
    const existing = await findOne('custom_categories', customCategoryFilter(userId, id));
    if (!existing) return null;
    const updated = await pbFetch(`${collectionUrl('custom_categories')}/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(customCategoryToRecord(userId, {
        id,
        label: updates.label ?? existing.label,
        color: updates.color ?? existing.color,
      })),
    });
    return customCategoryFromRecord(updated);
  },

  async delete(userId, id) {
    await deleteMatching('custom_categories', customCategoryFilter(userId, id));
  },
};

export const pbCategoryOverrides = {
  async getAll(userId) {
    const rows = await listAll('category_overrides', `user = '${encodeFilter(userId)}'`);
    return Object.fromEntries(rows.map(row => [row.category_id, { label: row.label ?? null, color: row.color ?? null }]));
  },

  async set(userId, categoryId, updates) {
    const filter = `user = '${encodeFilter(userId)}' && category_id = '${encodeFilter(categoryId)}'`;
    const existing = await findOne('category_overrides', filter);

    if (existing) {
      await pbFetch(`${collectionUrl('category_overrides')}/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          user: userId,
          category_id: categoryId,
          label: updates.label !== undefined ? updates.label : existing.label,
          color: updates.color !== undefined ? updates.color : existing.color,
        }),
      });
      return;
    }

    await pbFetch(collectionUrl('category_overrides'), {
      method: 'POST',
      body: JSON.stringify({
        user: userId,
        category_id: categoryId,
        label: updates.label ?? null,
        color: updates.color ?? null,
      }),
    });
  },
};

export const pbDeletedDefaults = {
  async getAll(userId) {
    const rows = await listAll('deleted_defaults', `user = '${encodeFilter(userId)}'`);
    return rows.map(row => row.category_id);
  },

  async add(userId, categoryId) {
    const filter = `user = '${encodeFilter(userId)}' && category_id = '${encodeFilter(categoryId)}'`;
    const existing = await findOne('deleted_defaults', filter);
    if (existing) return;

    await pbFetch(collectionUrl('deleted_defaults'), {
      method: 'POST',
      body: JSON.stringify({
        user: userId,
        category_id: categoryId,
      }),
    });
  },
};

export const pbLinkedCalendars = {
  async getAll(userId) {
    return (await listAll('linked_calendars', `user = '${encodeFilter(userId)}'`)).map(linkedCalendarFromRecord);
  },

  async create(userId, calendar) {
    const existing = await findOne('linked_calendars', linkedCalendarFilter(userId, calendar.id));
    if (existing) {
      const updated = await pbFetch(`${collectionUrl('linked_calendars')}/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(linkedCalendarToRecord(userId, calendar)),
      });
      return linkedCalendarFromRecord(updated);
    }

    const created = await pbFetch(collectionUrl('linked_calendars'), {
      method: 'POST',
      body: JSON.stringify(linkedCalendarToRecord(userId, calendar)),
    });
    return linkedCalendarFromRecord(created);
  },

  async update(userId, id, updates) {
    const existing = await findOne('linked_calendars', linkedCalendarFilter(userId, id));
    if (!existing) return null;
    const updated = await pbFetch(`${collectionUrl('linked_calendars')}/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(linkedCalendarToRecord(userId, {
        ...linkedCalendarFromRecord(existing),
        ...updates,
        id,
      })),
    });
    return linkedCalendarFromRecord(updated);
  },

  async delete(userId, id) {
    await deleteMatching('linked_calendars', linkedCalendarFilter(userId, id));
  },
};

export const pbTimeBudgets = {
  async getAll(userId) {
    const rows = await listAll('time_budgets', `user = '${encodeFilter(userId)}'`);
    return Object.fromEntries(rows.map(row => [row.category_id, asNumber(row.weekly_hours, 0)]));
  },

  async set(userId, categoryId, weeklyHours) {
    const filter = `user = '${encodeFilter(userId)}' && category_id = '${encodeFilter(categoryId)}'`;
    const existing = await findOne('time_budgets', filter);

    if (existing) {
      await pbFetch(`${collectionUrl('time_budgets')}/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          user: userId,
          category_id: categoryId,
          weekly_hours: weeklyHours,
        }),
      });
      return;
    }

    await pbFetch(collectionUrl('time_budgets'), {
      method: 'POST',
      body: JSON.stringify({
        user: userId,
        category_id: categoryId,
        weekly_hours: weeklyHours,
      }),
    });
  },

  async delete(userId, categoryId) {
    await deleteMatching('time_budgets', `user = '${encodeFilter(userId)}' && category_id = '${encodeFilter(categoryId)}'`);
  },
};

export const pbUserProfile = {
  async get(userId) {
    const record = await findOne('user_profile', `user = '${encodeFilter(userId)}'`);
    return userProfileFromRecord(record);
  },

  async set(userId, data) {
    const existing = await findOne('user_profile', `user = '${encodeFilter(userId)}'`);
    const body = userProfileToRecord(userId, data);

    if (existing) {
      await pbFetch(`${collectionUrl('user_profile')}/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      return;
    }

    await pbFetch(collectionUrl('user_profile'), {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

export const pbCategoryKeywords = {
  async getAll(userId) {
    let rows = await listAll('category_keywords', `user = '${encodeFilter(userId)}'`);

    if (!rows.length) {
      for (const [categoryId, keywords] of Object.entries(DEFAULT_CATEGORY_KEYWORDS)) {
        for (const keyword of keywords) {
          await pbFetch(collectionUrl('category_keywords'), {
            method: 'POST',
            body: JSON.stringify({
              user: userId,
              category_id: categoryId,
              keyword,
            }),
          }).catch(() => {});
        }
      }
      rows = await listAll('category_keywords', `user = '${encodeFilter(userId)}'`);
    }

    const out = {};
    for (const row of rows) (out[row.category_id] ??= []).push(row.keyword);
    return out;
  },
};

export const pbUserLlmSettings = {
  async get(userId) {
    const record = await findOne('user_llm_settings', `user = '${encodeFilter(userId)}'`);
    return userLlmSettingsFromRecord(record);
  },

  async set(userId, data) {
    const existing = await findOne('user_llm_settings', `user = '${encodeFilter(userId)}'`);
    const body = userLlmSettingsToRecord(userId, data);

    if (existing) {
      await pbFetch(`${collectionUrl('user_llm_settings')}/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      return;
    }

    await pbFetch(collectionUrl('user_llm_settings'), {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

export const pbUserAppearance = {
  async get(userId) {
    const record = await findOne('user_appearance', `user = '${encodeFilter(userId)}'`);
    return userAppearanceFromRecord(record);
  },

  async set(userId, data) {
    const existing = await findOne('user_appearance', `user = '${encodeFilter(userId)}'`);
    const body = userAppearanceToRecord(userId, data);

    if (existing) {
      await pbFetch(`${collectionUrl('user_appearance')}/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      return;
    }

    await pbFetch(collectionUrl('user_appearance'), {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};
