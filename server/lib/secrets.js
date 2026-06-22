/**
 * Secrets resolution with Infisical + process.env fallback.
 *
 * Priority:
 *   1. Infisical SDK  (if INFISICAL_CLIENT_ID is set and auth succeeded)
 *   2. process.env    (dev / Infisical not configured)
 *
 * Features:
 *   - Singleton client initialized once at server startup
 *   - 5-minute in-memory cache to avoid per-request Infisical calls
 *   - Graceful degradation: any Infisical failure falls back to process.env
 *   - Blocked keys (JWT_SECRET, etc.) can never be managed via the admin UI
 */

import { InfisicalSDK } from '@infisical/sdk';

// ── Module-level state ────────────────────────────────────────────────────────

/** @type {InfisicalSDK|null} */
let client       = null;
let _projectId   = null;
let _environment = null;
let _connected   = false;

/** Simple TTL cache: keyName → { value: string, expiresAt: number } */
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Keys that must never be managed through the admin secrets UI.
 * These are startup-critical env vars — changing them requires a restart.
 */
export const BLOCKED_KEY_NAMES = new Set([
  'JWT_SECRET',
  'DATABASE_PATH',
  'PORT',
  'INFISICAL_CLIENT_ID',
  'INFISICAL_CLIENT_SECRET',
  'INFISICAL_PROJECT_ID',
  'INFISICAL_ENVIRONMENT',
  'INFISICAL_URL',
  'FRONTEND_URL',
]);

// ── Initialization ────────────────────────────────────────────────────────────

/**
 * Call once at server startup (top-level await in index.js).
 * No-ops silently if INFISICAL_CLIENT_ID is not set.
 */
export async function initializeInfisical() {
  const clientId     = process.env.INFISICAL_CLIENT_ID;
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET;
  const projectId    = process.env.INFISICAL_PROJECT_ID;
  const environment  = process.env.INFISICAL_ENVIRONMENT ?? 'dev';
  const siteUrl      = process.env.INFISICAL_URL; // optional, for self-hosted

  if (!clientId || !clientSecret || !projectId) {
    console.log('Infisical     →  not configured (using process.env for secrets)');
    return;
  }

  try {
    const sdk = new InfisicalSDK(siteUrl ? { siteUrl } : undefined);
    await sdk.auth().universalAuth.login({ clientId, clientSecret });

    client       = sdk;
    _projectId   = projectId;
    _environment = environment;
    _connected   = true;

    console.log(`Infisical     →  ✓ connected (project: ${projectId}, env: ${environment})`);
  } catch (err) {
    console.warn(`Infisical     →  ✗ auth failed — falling back to process.env`);
    console.warn(`               ${err.message}`);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get a secret value. Checks cache → Infisical → process.env.
 * @param {string} keyName  e.g. "GOOGLE_MAPS_API_KEY"
 * @returns {Promise<string|null>}
 */
export async function getSecret(keyName) {
  // 1. Check cache
  const cached = cache.get(keyName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // 2. Try Infisical
  if (client) {
    try {
      const result = await client.secrets().getSecret({
        environment:      _environment,
        projectId:        _projectId,
        secretName:       keyName,
        viewSecretValue:  true,
      });
      const value = result.secretValue ?? null;
      cache.set(keyName, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      return value;
    } catch {
      // Secret not found in Infisical, or network error — fall through
    }
  }

  // 3. Fall back to process.env
  return process.env[keyName] ?? null;
}

/**
 * List all secrets in the Infisical project.
 * Returns [] if Infisical is not connected.
 * @returns {Promise<Array<{secretName:string, secretComment:string, version:number}>>}
 */
export async function listInfisicalSecrets() {
  if (!client) return [];
  try {
    const secrets = await client.secrets().listSecrets({
      environment:     _environment,
      projectId:       _projectId,
      viewSecretValue: false,  // Don't fetch values for the list — metadata only
    });
    return secrets.map(s => ({
      secretName:    s.secretName,
      secretComment: s.secretComment ?? '',
      version:       s.version,
    }));
  } catch (err) {
    console.warn('[secrets] listInfisicalSecrets failed:', err.message);
    return [];
  }
}

/**
 * Create a secret in Infisical.
 * @param {string} keyName
 * @param {string} value
 */
export async function createInfisicalSecret(keyName, value) {
  if (!client) throw new Error('Infisical is not connected');
  await client.secrets().createSecret(keyName, {
    environment:  _environment,
    projectId:    _projectId,
    secretValue:  value,
  });
  // Bust cache
  cache.delete(keyName);
}

/**
 * Update a secret in Infisical.
 * @param {string} keyName
 * @param {string} value
 */
export async function updateInfisicalSecret(keyName, value) {
  if (!client) throw new Error('Infisical is not connected');
  await client.secrets().updateSecret(keyName, {
    environment:  _environment,
    projectId:    _projectId,
    secretValue:  value,
  });
  // Bust cache
  cache.delete(keyName);
}

/**
 * Delete a secret from Infisical.
 * @param {string} keyName
 */
export async function deleteInfisicalSecret(keyName) {
  if (!client) throw new Error('Infisical is not connected');
  await client.secrets().deleteSecret(keyName, {
    environment: _environment,
    projectId:   _projectId,
  });
  cache.delete(keyName);
}

/**
 * @returns {{ connected: boolean, projectId: string|null, environment: string|null }}
 */
export function getInfisicalStatus() {
  return {
    connected:   _connected,
    projectId:   _projectId,
    environment: _environment,
  };
}
