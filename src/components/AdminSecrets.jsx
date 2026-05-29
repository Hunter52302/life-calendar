/**
 * AdminSecrets — "No Touchy" panel
 *
 * Shown inside the Settings dropdown after admin re-authentication.
 * Manages API keys and secrets backed by Infisical + local SQLite metadata.
 */

import { useState } from 'react';
import { useAdminSecrets } from '../hooks/useAdminSecrets.js';

// ── Expiry badge ──────────────────────────────────────────────────────────────

function ExpiryBadge({ daysUntilExpiry, expiresAt }) {
  if (!expiresAt) {
    return <span className="text-[10px] text-gray-400 dark:text-gray-500">no expiry</span>;
  }
  const days = daysUntilExpiry;
  let cls, label;
  if (days === null)    { cls = 'text-gray-400 dark:text-gray-500'; label = 'no expiry'; }
  else if (days <= 0)   { cls = 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-semibold'; label = 'EXPIRED'; }
  else if (days <= 7)   { cls = 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'; label = `${days}d left`; }
  else if (days <= 30)  { cls = 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'; label = `${days}d left`; }
  else                  { cls = 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'; label = `${days}d left`; }

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cls}`}>{label}</span>
  );
}

// ── Infisical status badge ────────────────────────────────────────────────────

function InfisicalStatusBadge({ status }) {
  if (!status) return null;
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 mb-2">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.connected ? 'bg-green-500' : 'bg-amber-400'}`} />
      <span className="text-xs text-gray-600 dark:text-gray-400">
        {status.connected
          ? `Infisical connected — ${status.environment} / ${status.projectId}`
          : 'Infisical not configured — keys stored in .env only'}
      </span>
    </div>
  );
}

// ── Admin Gate (password re-entry) ────────────────────────────────────────────

function AdminGate({ onLogin }) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setSubmitting(true);
    try {
      await onLogin(password);
    } catch (error) {
      setErr(error.message ?? 'Incorrect password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-2 py-2">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Re-enter your password to access the secrets vault. This session lasts 1 hour.
      </p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Your password"
          autoComplete="current-password"
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500"
        />
        {err && <p className="text-xs text-red-500">{err}</p>}
        <button
          type="submit"
          disabled={submitting || !password}
          className="w-full py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {submitting ? 'Verifying…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}

// ── Add Secret form ───────────────────────────────────────────────────────────

function AddSecretForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    keyName: '', serviceName: '', description: '', value: '', expiresAt: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      // Convert date string → unix timestamp (or null)
      const expiresAt = form.expiresAt
        ? Math.floor(new Date(form.expiresAt).getTime() / 1000)
        : null;
      await onSave({ ...form, expiresAt });
    } catch (error) {
      setErr(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20">
      <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">Add Secret</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          required
          value={form.keyName}
          onChange={e => set('keyName', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
          placeholder="KEY_NAME"
          className="col-span-2 text-xs font-mono px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-400"
        />
        <input
          required
          value={form.serviceName}
          onChange={e => set('serviceName', e.target.value)}
          placeholder="Service name (e.g. Google Maps)"
          className="col-span-2 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-400"
        />
        <input
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Description (optional)"
          className="col-span-2 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-400"
        />
        <input
          required
          type="password"
          value={form.value}
          onChange={e => set('value', e.target.value)}
          placeholder="Secret value"
          autoComplete="off"
          className="col-span-2 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-400"
        />
        <div className="col-span-2">
          <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5">Expiration date (optional)</label>
          <input
            type="date"
            value={form.expiresAt}
            onChange={e => set('expiresAt', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-400"
          />
        </div>
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving}
          className="flex-1 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-medium transition-colors">
          {saving ? 'Saving…' : 'Save Secret'}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs font-medium transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Secret Row ────────────────────────────────────────────────────────────────

function SecretRow({ secret, onUpdate, onRestore, onDelete }) {
  const [rotating,      setRotating]      = useState(false);
  const [newValue,      setNewValue]      = useState('');
  const [expiryEdit,    setExpiryEdit]    = useState(false);
  const [newExpiry,     setNewExpiry]     = useState(
    secret.expiresAt ? new Date(secret.expiresAt * 1000).toISOString().split('T')[0] : ''
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [err,           setErr]           = useState('');

  const maskedKey = secret.keyName.length > 12
    ? secret.keyName.slice(0, 6) + '***' + secret.keyName.slice(-4)
    : secret.keyName;

  async function handleRotate(e) {
    e.preventDefault();
    if (!newValue.trim()) return;
    setSaving(true);
    setErr('');
    try {
      await onUpdate(secret.keyName, { value: newValue.trim() });
      setNewValue('');
      setRotating(false);
    } catch (error) { setErr(error.message); }
    finally { setSaving(false); }
  }

  async function handleExpiryUpdate(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const expiresAt = newExpiry
        ? Math.floor(new Date(newExpiry).getTime() / 1000)
        : null;
      await onUpdate(secret.keyName, { expiresAt });
      setExpiryEdit(false);
    } catch (error) { setErr(error.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    setSaving(true);
    try { await onDelete(secret.keyName); }
    catch (error) { setErr(error.message); setSaving(false); setConfirmDelete(false); }
  }

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{secret.serviceName}</span>
            {secret.infisicalManaged && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-medium">Infisical</span>
            )}
            {secret.infisicalOnly && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 font-medium">unregistered</span>
            )}
          </div>
          <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">{maskedKey}</span>
          {secret.description && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{secret.description}</p>
          )}
        </div>
        <ExpiryBadge daysUntilExpiry={secret.daysUntilExpiry} expiresAt={secret.expiresAt} />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => { setRotating(v => !v); setErr(''); }}
          className="text-[10px] px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-medium transition-colors"
        >
          🔄 Rotate
        </button>
        <button
          type="button"
          onClick={() => { setExpiryEdit(v => !v); setErr(''); }}
          className="text-[10px] px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 font-medium transition-colors"
        >
          📅 Expiry
        </button>
        {secret.hasPreviousValue && (
          <button
            type="button"
            onClick={() => onRestore(secret.keyName)}
            className="text-[10px] px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-600 dark:text-amber-400 font-medium transition-colors"
          >
            ↩ Restore prev
          </button>
        )}
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-[10px] px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 dark:hover:text-red-400 font-medium transition-colors ml-auto"
          >
            ✕
          </button>
        ) : (
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[10px] text-gray-500">Remove?</span>
            <button onClick={handleDelete} disabled={saving}
              className="text-[10px] px-2 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors">
              Yes
            </button>
            <button onClick={() => setConfirmDelete(false)}
              className="text-[10px] px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium transition-colors">
              No
            </button>
          </div>
        )}
      </div>

      {/* Rotate form */}
      {rotating && (
        <form onSubmit={handleRotate} className="flex gap-2">
          <input
            type="password"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            placeholder="New secret value"
            autoComplete="off"
            className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-400"
          />
          <button type="submit" disabled={saving || !newValue.trim()}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium transition-colors">
            {saving ? '…' : 'Save'}
          </button>
        </form>
      )}

      {/* Expiry edit form */}
      {expiryEdit && (
        <form onSubmit={handleExpiryUpdate} className="flex gap-2 items-center">
          <input
            type="date"
            value={newExpiry}
            onChange={e => setNewExpiry(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-indigo-400"
          />
          <button type="submit" disabled={saving}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium transition-colors">
            {saving ? '…' : 'Set'}
          </button>
          {newExpiry && (
            <button type="button" onClick={() => { setNewExpiry(''); handleExpiryUpdate({ preventDefault: () => {} }); }}
              className="text-[10px] text-gray-400 hover:text-red-400 transition-colors">
              Clear
            </button>
          )}
        </form>
      )}

      {err && <p className="text-xs text-red-500">{err}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminSecrets() {
  const {
    isAuthenticated, adminLogin, adminLogout,
    secrets, infisicalStatus,
    loading, error,
    createSecret, updateSecret, restoreSecret, deleteSecret,
    refresh,
  } = useAdminSecrets();

  const [showAddForm, setShowAddForm] = useState(false);

  if (!isAuthenticated) {
    return <AdminGate onLogin={adminLogin} />;
  }

  return (
    <div className="px-1 pb-2 space-y-2">
      {/* Infisical status */}
      <InfisicalStatusBadge status={infisicalStatus} />

      {/* Global error */}
      {error && (
        <p className="text-xs text-red-500 px-1">{error}</p>
      )}

      {/* Secrets list */}
      {loading && secrets.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 px-1 py-2 text-center">Loading…</p>
      ) : secrets.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 px-1 py-2 text-center">
          No secrets registered yet.
        </p>
      ) : (
        <div className="space-y-2">
          {secrets.map(s => (
            <SecretRow
              key={s.keyName}
              secret={s}
              onUpdate={updateSecret}
              onRestore={restoreSecret}
              onDelete={deleteSecret}
            />
          ))}
        </div>
      )}

      {/* Add secret */}
      {showAddForm ? (
        <AddSecretForm
          onSave={async (data) => { await createSecret(data); setShowAddForm(false); }}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="w-full py-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-600 text-xs text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
        >
          + Add Secret
        </button>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
        <button type="button" onClick={refresh}
          className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          ↻ Refresh
        </button>
        <button type="button" onClick={adminLogout}
          className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-red-400 dark:hover:text-red-400 transition-colors">
          Lock session
        </button>
      </div>
    </div>
  );
}
