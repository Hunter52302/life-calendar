import { pbAuthedFetch } from './pbClient.js';

const PB_BASE = (process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');

const HABITS_PATH = `${PB_BASE}/api/collections/habits/records`;
const COMPLETIONS_PATH = `${PB_BASE}/api/collections/habit_completions/records`;

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

function habitFilter(userId, habitId) {
  return `user = '${encodeFilter(userId)}' && habit_id = '${encodeFilter(habitId)}'`;
}

function completionByAppIdFilter(userId, completionId) {
  return `user = '${encodeFilter(userId)}' && completion_id = '${encodeFilter(completionId)}'`;
}

function completionByHabitDateFilter(userId, habitId, date) {
  return `user = '${encodeFilter(userId)}' && habit_id = '${encodeFilter(habitId)}' && date = '${encodeFilter(date)}'`;
}

function habitFromRecord(record) {
  return {
    id: record.habit_id ?? record.id,
    label: record.label ?? '',
    color: record.color ?? '#7C3AED',
    target_days: asJsonArray(record.target_days, [0, 1, 2, 3, 4, 5, 6]),
    active: asBool(record.active, true),
    sort_order: asNumber(record.sort_order, 0) ?? 0,
    integration_hint: asNullableString(record.integration_hint),
  };
}

function habitToRecord(userId, habit) {
  return {
    user: userId,
    habit_id: asString(habit.id),
    label: asString(habit.label),
    color: asString(habit.color, '#7C3AED'),
    target_days: asJsonArray(habit.target_days, [0, 1, 2, 3, 4, 5, 6]),
    active: habit.active !== false,
    sort_order: asNumber(habit.sort_order, 0) ?? 0,
    integration_hint: habit.integration_hint ?? null,
  };
}

function completionFromRecord(record) {
  return {
    id: record.completion_id ?? record.id,
    habit_id: record.habit_id,
    date: record.date,
  };
}

function completionToRecord(userId, habitId, completionId, date) {
  return {
    user: userId,
    completion_id: asString(completionId),
    habit_id: asString(habitId),
    date: asString(date),
  };
}

export const pocketbaseHabits = {
  async getAll(userId) {
    const items = await listAll(HABITS_PATH, `user = '${encodeFilter(userId)}'`);
    return items
      .map(record => ({ ...habitFromRecord(record), _created: record.created ?? '' }))
      .sort((a, b) => {
        const sortDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (sortDiff !== 0) return sortDiff;
        return String(a._created).localeCompare(String(b._created));
      })
      .map(({ _created, ...habit }) => habit);
  },

  async getById(userId, habitId) {
    const existing = await findOne(HABITS_PATH, habitFilter(userId, habitId));
    return existing ? habitFromRecord(existing) : null;
  },

  async create(userId, habit) {
    const existing = await findOne(HABITS_PATH, habitFilter(userId, habit.id));
    if (existing) {
      const updated = await pbFetch(`${HABITS_PATH}/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(habitToRecord(userId, { ...habitFromRecord(existing), ...habit })),
      });
      return habitFromRecord(updated);
    }

    const created = await pbFetch(HABITS_PATH, {
      method: 'POST',
      body: JSON.stringify(habitToRecord(userId, habit)),
    });
    return habitFromRecord(created);
  },

  async update(userId, habitId, updates) {
    const existing = await findOne(HABITS_PATH, habitFilter(userId, habitId));
    if (!existing) return null;
    const updated = await pbFetch(`${HABITS_PATH}/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(habitToRecord(userId, { ...habitFromRecord(existing), ...updates, id: habitId })),
    });
    return habitFromRecord(updated);
  },

  async delete(userId, habitId) {
    await deleteMatching(HABITS_PATH, habitFilter(userId, habitId));
    await deleteMatching(COMPLETIONS_PATH, `user = '${encodeFilter(userId)}' && habit_id = '${encodeFilter(habitId)}'`);
  },
};

export const pocketbaseHabitCompletions = {
  async getAll(userId) {
    return (await listAll(COMPLETIONS_PATH, `user = '${encodeFilter(userId)}'`)).map(completionFromRecord);
  },

  async upsert(userId, habitId, completionId, date) {
    const existing = await findOne(COMPLETIONS_PATH, completionByHabitDateFilter(userId, habitId, date))
      ?? await findOne(COMPLETIONS_PATH, completionByAppIdFilter(userId, completionId));

    if (existing) {
      const updated = await pbFetch(`${COMPLETIONS_PATH}/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(completionToRecord(userId, habitId, completionId, date)),
      });
      return completionFromRecord(updated);
    }

    const created = await pbFetch(COMPLETIONS_PATH, {
      method: 'POST',
      body: JSON.stringify(completionToRecord(userId, habitId, completionId, date)),
    });
    return completionFromRecord(created);
  },

  async delete(userId, habitId, date) {
    await deleteMatching(COMPLETIONS_PATH, completionByHabitDateFilter(userId, habitId, date));
  },
};
