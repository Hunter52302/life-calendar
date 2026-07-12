import { randomBytes, randomUUID } from 'crypto';
import { pbAuthedFetch } from './pbClient.js';

const PB_BASE = (process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090').replace(/\/$/, '');
const USERS_PATH = `${PB_BASE}/api/collections/users/records`;
const AUTH_ENVELOPES_PATH = `${PB_BASE}/api/collections/user_auth_envelopes/records`;
const SECRETS_PATH = `${PB_BASE}/api/collections/secrets/records`;
const AUDIT_LOG_PATH = `${PB_BASE}/api/collections/admin_audit_log/records`;
const GOOGLE_TICKETS_PATH = `${PB_BASE}/api/collections/google_auth_tickets/records`;

const USER_OWNED_COLLECTIONS = [
  'events',
  'custom_categories',
  'category_overrides',
  'deleted_defaults',
  'linked_calendars',
  'habits',
  'habit_completions',
  'time_budgets',
  'user_integrations',
  'notification_schedules',
  'push_subscriptions',
  'notification_log',
  'user_profile',
  'category_keywords',
  'user_llm_settings',
  'calendar_connections',
  'discord_bot_users',
];

const LOGIN_LOCK_THRESHOLD = 5;
const LOGIN_LOCK_MINUTES = 15;

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

function epochFromIso(value, fallback = 0) {
  const ms = Date.parse(value ?? '');
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : fallback;
}

async function pbFetch(path, options = {}) {
  const res = await pbAuthedFetch(path, options);

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = JSON.stringify(body);
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

async function deleteByCollectionAndUser(collectionName, userId) {
  const path = `${PB_BASE}/api/collections/${collectionName}/records`;
  await deleteMatching(path, `user = '${encodeFilter(userId)}'`);
}

function authEnvelopeFilter(userId) {
  return `app_user_id = '${encodeFilter(userId)}'`;
}

function userIdFilter(userId) {
  return `app_user_id = '${encodeFilter(userId)}'`;
}

function emailFilter(email) {
  return `email = '${encodeFilter(email)}'`;
}

function nameFilter(name) {
  return `name = '${encodeFilter(name)}'`;
}

function feedTokenFilter(token) {
  return `ics_feed_token = '${encodeFilter(token)}'`;
}

function googleSubFilter(sub) {
  return `google_sub = '${encodeFilter(sub)}'`;
}

function secretKeyFilter(keyName) {
  return `key_name = '${encodeFilter(keyName)}'`;
}

function mapUser(authRecord, envelopeRecord = null) {
  if (!authRecord) return null;
  return {
    id: authRecord.app_user_id ?? authRecord.id,
    pb_id: authRecord.id,
    email: asNullableString(authRecord.email),
    role: authRecord.role ?? 'user',
    is_blocked: asBool(authRecord.is_blocked, false),
    zk_enabled: asBool(authRecord.zk_enabled, true),
    user_timezone: authRecord.user_timezone ?? 'UTC',
    created_at: epochFromIso(authRecord.created, 0),
    auth_salt: asNullableString(envelopeRecord?.auth_salt),
    kdf_salt: asNullableString(envelopeRecord?.kdf_salt),
    recovery_salt: asNullableString(envelopeRecord?.recovery_salt),
    recovery_auth_salt: asNullableString(envelopeRecord?.recovery_auth_salt),
    recovery_verifier: asNullableString(envelopeRecord?.recovery_verifier),
    wrapped_dek_password: asNullableString(envelopeRecord?.wrapped_dek_password),
    wrapped_dek_recovery: asNullableString(envelopeRecord?.wrapped_dek_recovery),
    wrapped_dek_google: asNullableString(envelopeRecord?.wrapped_dek_google),
    google_unlock_secret: asNullableString(envelopeRecord?.google_unlock_secret),
    password_hash: asNullableString(envelopeRecord?.password_hash),
    google_sub: asNullableString(authRecord.google_sub),
    google_email: asNullableString(authRecord.google_email),
    pending_google_sub: asNullableString(authRecord.pending_google_sub),
    pending_google_email: asNullableString(authRecord.pending_google_email),
    pending_google_expires: asNumber(authRecord.pending_google_expires, null),
    signup_ip: asNullableString(authRecord.signup_ip),
    ics_feed_token: asNullableString(authRecord.ics_feed_token),
    failed_login_attempts: asNumber(authRecord.failed_login_attempts, 0) ?? 0,
    locked_until: asNumber(authRecord.locked_until, null),
  };
}

async function getEnvelopeByUserId(userId) {
  return findOne(AUTH_ENVELOPES_PATH, authEnvelopeFilter(userId));
}

async function getUserRecordByAppUserId(userId) {
  return findOne(USERS_PATH, userIdFilter(userId));
}

async function getUserRecordByEmail(email) {
  const normalized = String(email ?? '').trim().toLowerCase();
  const byEmail = await findOne(USERS_PATH, emailFilter(normalized));
  if (byEmail) return byEmail;
  const byName = await findOne(USERS_PATH, nameFilter(normalized));
  if (byName) return byName;
  const allUsers = await listAll(USERS_PATH);
  return allUsers.find(record => {
    const recordEmail = asNullableString(record.email)?.trim().toLowerCase();
    const recordName = asNullableString(record.name)?.trim().toLowerCase();
    return recordEmail === normalized || recordName === normalized;
  }) ?? null;
}

async function getHydratedUserByRecord(record) {
  if (!record) return null;
  const envelope = await getEnvelopeByUserId(record.app_user_id ?? record.id);
  return mapUser(record, envelope);
}

async function upsertAuthEnvelope(userId, updates) {
  const existing = await getEnvelopeByUserId(userId);
  const body = {
    app_user_id: userId,
    ...(updates.password_hash !== undefined ? { password_hash: updates.password_hash } : {}),
    ...(updates.auth_salt !== undefined ? { auth_salt: updates.auth_salt } : {}),
    ...(updates.kdf_salt !== undefined ? { kdf_salt: updates.kdf_salt } : {}),
    ...(updates.recovery_salt !== undefined ? { recovery_salt: updates.recovery_salt } : {}),
    ...(updates.recovery_auth_salt !== undefined ? { recovery_auth_salt: updates.recovery_auth_salt } : {}),
    ...(updates.recovery_verifier !== undefined ? { recovery_verifier: updates.recovery_verifier } : {}),
    ...(updates.wrapped_dek_password !== undefined ? { wrapped_dek_password: updates.wrapped_dek_password } : {}),
    ...(updates.wrapped_dek_recovery !== undefined ? { wrapped_dek_recovery: updates.wrapped_dek_recovery } : {}),
    ...(updates.wrapped_dek_google !== undefined ? { wrapped_dek_google: updates.wrapped_dek_google } : {}),
    ...(updates.google_unlock_secret !== undefined ? { google_unlock_secret: updates.google_unlock_secret } : {}),
  };

  if (existing) {
    return pbFetch(`${AUTH_ENVELOPES_PATH}/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  return pbFetch(AUTH_ENVELOPES_PATH, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function randomAuthPassword() {
  return randomBytes(32).toString('hex');
}

function mapSecret(record) {
  if (!record) return null;
  return {
    key_name: record.key_name,
    service_name: record.service_name,
    description: asNullableString(record.description),
    encrypted_previous_value: asNullableString(record.encrypted_previous_value),
    expires_at: asNumber(record.expires_at, null),
    infisical_managed: asBool(record.infisical_managed, false) ? 1 : 0,
    created_at: asNumber(record.created_at_epoch, epochFromIso(record.created, 0)) ?? 0,
    updated_at: asNumber(record.updated_at_epoch, epochFromIso(record.updated, 0)) ?? 0,
  };
}

export const pocketbaseUsers = {
  async count() {
    const items = await listAll(USERS_PATH);
    return items.length;
  },

  async getById(id) {
    const record = await getUserRecordByAppUserId(id);
    return getHydratedUserByRecord(record);
  },

  async getByEmail(email) {
    const record = await getUserRecordByEmail(email);
    return getHydratedUserByRecord(record);
  },

  async create(id, verifierHash, opts = {}) {
    const { email = null, role = 'user', signupIp = null, env = {} } = opts;
    const dummyPassword = randomAuthPassword();
    const payload = {
      email,
      password: dummyPassword,
      passwordConfirm: dummyPassword,
      emailVisibility: false,
      name: email ?? id,
      app_user_id: id,
      role,
      is_blocked: false,
      zk_enabled: true,
      user_timezone: 'UTC',
      failed_login_attempts: 0,
    };
    if (signupIp) payload.signup_ip = signupIp;

    const created = await pbFetch(USERS_PATH, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    try {
      await upsertAuthEnvelope(id, {
        password_hash: verifierHash,
        auth_salt: env.authSalt ?? null,
        kdf_salt: env.kdfSalt ?? null,
        recovery_salt: env.recoverySalt ?? null,
        recovery_auth_salt: env.recoveryAuthSalt ?? null,
        recovery_verifier: env.recoveryVerifierHash ?? null,
        wrapped_dek_password: env.wrappedDekPassword ?? null,
        wrapped_dek_recovery: env.wrappedDekRecovery ?? null,
      });
      return this.getById(id);
    } catch (error) {
      await pbFetch(`${USERS_PATH}/${created.id}`, { method: 'DELETE' }).catch(() => {});
      throw error;
    }
  },

  async getLoginSalts(id) {
    const user = await this.getById(id);
    if (!user) return null;
    return {
      auth_salt: user.auth_salt,
      kdf_salt: user.kdf_salt,
      wrapped_dek_password: user.wrapped_dek_password,
    };
  },

  async getRecoveryEnvelope(id) {
    const user = await this.getById(id);
    if (!user) return null;
    return {
      recovery_salt: user.recovery_salt,
      recovery_auth_salt: user.recovery_auth_salt,
      recovery_verifier: user.recovery_verifier,
      wrapped_dek_recovery: user.wrapped_dek_recovery,
    };
  },

  async setPasswordEnvelope(id, { verifierHash, authSalt, kdfSalt, wrappedDekPassword }) {
    const record = await getUserRecordByAppUserId(id);
    if (!record) return null;

    await Promise.all([
      pbFetch(`${USERS_PATH}/${record.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          failed_login_attempts: 0,
          locked_until: null,
        }),
      }),
      upsertAuthEnvelope(id, {
        password_hash: verifierHash,
        auth_salt: authSalt,
        kdf_salt: kdfSalt,
        wrapped_dek_password: wrappedDekPassword,
      }),
    ]);

    return this.getById(id);
  },

  async listAll() {
    const items = await listAll(USERS_PATH);
    return items
      .map(record => ({
        id: record.app_user_id ?? record.id,
        email: asNullableString(record.email),
        role: record.role ?? 'user',
        is_blocked: asBool(record.is_blocked, false),
        zk_enabled: asBool(record.zk_enabled, true),
        created_at: epochFromIso(record.created, 0),
      }))
      .sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
  },

  async getAllForScheduler() {
    const items = await listAll(USERS_PATH);
    return items
      .filter(record => !asBool(record.is_blocked, false))
      .map(record => ({
        id: record.app_user_id ?? record.id,
        user_timezone: record.user_timezone ?? 'UTC',
      }));
  },

  async setBlocked(id, blocked) {
    const record = await getUserRecordByAppUserId(id);
    if (!record) return null;
    await pbFetch(`${USERS_PATH}/${record.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_blocked: blocked === true }),
    });
    return this.getById(id);
  },

  async setEmail(id, email) {
    const record = await getUserRecordByAppUserId(id);
    if (!record) return null;
    await pbFetch(`${USERS_PATH}/${record.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        email,
        verified: true,
        name: email ?? record.name ?? id,
      }),
    });
    return this.getById(id);
  },

  async deleteUser(id) {
    const record = await getUserRecordByAppUserId(id);
    if (!record) return;

    for (const collectionName of USER_OWNED_COLLECTIONS) {
      await deleteByCollectionAndUser(collectionName, id);
    }

    await Promise.all([
      deleteMatching(AUTH_ENVELOPES_PATH, authEnvelopeFilter(id)),
      deleteMatching(AUDIT_LOG_PATH, `admin_user_id = '${encodeFilter(id)}'`),
      deleteMatching(GOOGLE_TICKETS_PATH, `app_user_id = '${encodeFilter(id)}'`),
      pbFetch(`${USERS_PATH}/${record.id}`, { method: 'DELETE' }),
    ]);
  },

  async recordFailedLogin(id) {
    const record = await getUserRecordByAppUserId(id);
    if (!record) return { attempts: 0, lockedUntil: null };
    const attempts = (asNumber(record.failed_login_attempts, 0) ?? 0) + 1;
    const lockedUntil = attempts >= LOGIN_LOCK_THRESHOLD
      ? Math.floor(Date.now() / 1000) + LOGIN_LOCK_MINUTES * 60
      : null;

    await pbFetch(`${USERS_PATH}/${record.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        failed_login_attempts: attempts,
        locked_until: lockedUntil,
      }),
    });

    return { attempts, lockedUntil };
  },

  async resetLoginAttempts(id) {
    const record = await getUserRecordByAppUserId(id);
    if (!record) return null;
    await pbFetch(`${USERS_PATH}/${record.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        failed_login_attempts: 0,
        locked_until: null,
      }),
    });
    return this.getById(id);
  },

  async getSignupIpClusters() {
    const items = await listAll(USERS_PATH);
    const byIp = new Map();

    for (const record of items) {
      const ip = asNullableString(record.signup_ip);
      if (!ip) continue;
      const row = byIp.get(ip) ?? { signup_ip: ip, count: 0, emails: [] };
      row.count += 1;
      if (record.email) row.emails.push(record.email);
      byIp.set(ip, row);
    }

    return [...byIp.values()]
      .filter(row => row.count > 1)
      .sort((a, b) => b.count - a.count)
      .map(row => ({ ...row, emails: row.emails.join(', ') }));
  },

  async setFeedToken(id, token) {
    const record = await getUserRecordByAppUserId(id);
    if (!record) return null;
    await pbFetch(`${USERS_PATH}/${record.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ics_feed_token: token ?? null }),
    });
    return this.getById(id);
  },

  async getByFeedToken(token) {
    const record = await findOne(USERS_PATH, feedTokenFilter(token));
    return getHydratedUserByRecord(record);
  },

  // ── Google linked-login ────────────────────────────────────────────────────
  /** Look up a user by their committed (verified) Google account id. */
  async getByGoogleSub(sub) {
    if (!sub) return null;
    const record = await findOne(USERS_PATH, googleSubFilter(sub));
    return getHydratedUserByRecord(record);
  },

  /**
   * Stage a Google identity that proved ownership during the link redirect.
   * The commit (with the client-built DEK wrap) happens in a second,
   * authenticated step. Expires so an abandoned link can't be finalized later.
   */
  async setPendingGoogleLink(id, { sub, email, ttlSeconds = 600 }) {
    const record = await getUserRecordByAppUserId(id);
    if (!record) return null;
    await pbFetch(`${USERS_PATH}/${record.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        pending_google_sub: sub,
        pending_google_email: email ?? null,
        pending_google_expires: Math.floor(Date.now() / 1000) + ttlSeconds,
      }),
    });
    return this.getById(id);
  },

  /**
   * Commit a linked Google identity: moves the (still-valid) pending sub/email
   * onto the user and stores the client-built wrapped DEK + unlock secret on the
   * envelope. Clears the pending state.
   */
  async commitGoogleLink(id, { sub, email, wrappedDekGoogle, googleUnlockSecret }) {
    const record = await getUserRecordByAppUserId(id);
    if (!record) return null;
    await Promise.all([
      pbFetch(`${USERS_PATH}/${record.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          google_sub: sub,
          google_email: email ?? null,
          pending_google_sub: null,
          pending_google_email: null,
          pending_google_expires: null,
        }),
      }),
      upsertAuthEnvelope(id, {
        wrapped_dek_google: wrappedDekGoogle,
        google_unlock_secret: googleUnlockSecret,
      }),
    ]);
    return this.getById(id);
  },

  /** Unlink Google: wipe the identity, the DEK wrap, and any pending state. */
  async clearGoogleLink(id) {
    const record = await getUserRecordByAppUserId(id);
    if (!record) return null;
    await Promise.all([
      pbFetch(`${USERS_PATH}/${record.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          google_sub: null,
          google_email: null,
          pending_google_sub: null,
          pending_google_email: null,
          pending_google_expires: null,
        }),
      }),
      upsertAuthEnvelope(id, {
        wrapped_dek_google: null,
        google_unlock_secret: null,
      }),
    ]);
    return this.getById(id);
  },
};

/**
 * Single-use, short-lived tickets for the Google *login* exchange. The OAuth
 * callback is a top-level browser navigation, so it can't return JSON; it bounces
 * a signed ticket to the SPA, which POSTs it back to receive the session token +
 * unlock material. Consuming deletes the row, so a ticket works exactly once.
 */
export const pocketbaseGoogleTickets = {
  async create(userId, jti) {
    await pbFetch(GOOGLE_TICKETS_PATH, {
      method: 'POST',
      body: JSON.stringify({
        jti,
        app_user_id: userId,
        expires: Math.floor(Date.now() / 1000) + 120, // 2 min, well past the redirect
      }),
    });
  },

  /** Returns the app_user_id if the ticket exists and is unexpired, else null. Always deletes it. */
  async consume(jti) {
    const record = await findOne(GOOGLE_TICKETS_PATH, `jti = '${encodeFilter(jti)}'`);
    if (!record) return null;
    await pbFetch(`${GOOGLE_TICKETS_PATH}/${record.id}`, { method: 'DELETE' }).catch(() => {});
    const expires = asNumber(record.expires, 0) ?? 0;
    if (expires < Math.floor(Date.now() / 1000)) return null;
    return record.app_user_id ?? null;
  },
};

export const pocketbaseUserZk = {
  async getUnlockEnvelope(userId) {
    const user = await pocketbaseUsers.getById(userId);
    if (!user) return null;
    return {
      kdf_salt: user.kdf_salt,
      wrapped_dek_password: user.wrapped_dek_password,
      user_timezone: user.user_timezone ?? 'UTC',
    };
  },

  async setTimezone(userId, tz) {
    const record = await getUserRecordByAppUserId(userId);
    if (!record) return null;
    await pbFetch(`${USERS_PATH}/${record.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ user_timezone: tz }),
    });
    return pocketbaseUsers.getById(userId);
  },
};

export const pocketbaseSecrets = {
  async getAll() {
    const items = await listAll(SECRETS_PATH);
    return items
      .map(mapSecret)
      .sort((a, b) =>
        `${a.service_name}:${a.key_name}`.localeCompare(`${b.service_name}:${b.key_name}`)
      );
  },

  async getByKey(keyName) {
    const record = await findOne(SECRETS_PATH, secretKeyFilter(keyName));
    return mapSecret(record);
  },

  async upsert(keyName, data) {
    const existing = await findOne(SECRETS_PATH, secretKeyFilter(keyName));
    const body = {
      key_name: keyName,
      service_name: data.serviceName,
      description: data.description ?? null,
      encrypted_previous_value: data.encryptedPreviousValue ?? null,
      expires_at: data.expiresAt ?? null,
      infisical_managed: data.infisicalManaged === true,
      ...(existing ? {} : { created_at_epoch: Math.floor(Date.now() / 1000) }),
      updated_at_epoch: Math.floor(Date.now() / 1000),
    };

    const saved = existing
      ? await pbFetch(`${SECRETS_PATH}/${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      : await pbFetch(SECRETS_PATH, {
          method: 'POST',
          body: JSON.stringify(body),
        });

    return mapSecret(saved);
  },

  async patch(keyName, fields) {
    const existing = await findOne(SECRETS_PATH, secretKeyFilter(keyName));
    if (!existing) return null;

    const body = {
      ...(fields.service_name !== undefined ? { service_name: fields.service_name } : {}),
      ...(fields.description !== undefined ? { description: fields.description } : {}),
      ...(fields.encrypted_previous_value !== undefined ? { encrypted_previous_value: fields.encrypted_previous_value } : {}),
      ...(fields.expires_at !== undefined ? { expires_at: fields.expires_at } : {}),
      ...(fields.infisical_managed !== undefined ? { infisical_managed: !!fields.infisical_managed } : {}),
      updated_at_epoch: Math.floor(Date.now() / 1000),
    };

    const saved = await pbFetch(`${SECRETS_PATH}/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return mapSecret(saved);
  },

  async delete(keyName) {
    await deleteMatching(SECRETS_PATH, secretKeyFilter(keyName));
  },
};

export const pocketbaseAdminAuditLog = {
  async record(adminUserId, action, targetUserId = null) {
    await pbFetch(AUDIT_LOG_PATH, {
      method: 'POST',
      body: JSON.stringify({
        audit_id: randomUUID(),
        admin_user_id: adminUserId,
        action,
        target_user_id: targetUserId ?? null,
        created_at_epoch: Math.floor(Date.now() / 1000),
      }),
    });
  },

  async listRecent(limit = 200) {
    const items = await listAll(AUDIT_LOG_PATH);
    const sorted = items
      .map(item => ({
        id: item.audit_id ?? item.id,
        action: item.action,
        admin_user_id: item.admin_user_id,
        target_user_id: item.target_user_id ?? null,
        created_at: asNumber(item.created_at_epoch, epochFromIso(item.created, 0)) ?? 0,
      }))
      .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
      .slice(0, limit);

    const userIds = [...new Set(sorted.flatMap(row => [row.admin_user_id, row.target_user_id]).filter(Boolean))];
    const usersById = new Map(
      (await Promise.all(userIds.map(async userId => [userId, await pocketbaseUsers.getById(userId)])))
        .map(([userId, user]) => [userId, user])
    );

    return sorted.map(row => ({
      id: row.id,
      action: row.action,
      created_at: row.created_at,
      admin_email: usersById.get(row.admin_user_id)?.email ?? '(deleted account)',
      target_email: row.target_user_id ? (usersById.get(row.target_user_id)?.email ?? null) : null,
    }));
  },
};
