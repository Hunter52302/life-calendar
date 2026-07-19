import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { PROVIDERS, providerEventToAppEvent } from '../lib/calendarProviders';
import { addDays } from '../lib/utils.js';

/**
 * Connect & import a Google/Outlook calendar.
 *
 * Flow: pick a provider → browser redirects to consent → provider redirects
 * back to the SPA with ?connected=<provider>&connectionId=<id>, which App.jsx
 * detects and reopens this modal with `initialConnectionId` set → user picks
 * which of their provider calendars to import → we create a linked calendar and
 * pull its events.
 *
 * Tokens live only on the server; this component only ever sees event data.
 */
export default function ConnectCalendarModal({
  precision = 1,
  initialConnectionId = null,
  addLinkedCalendar,
  deleteLinkedCalendar,
  replaceEventsBySourceCalendar,
  linkedCalendars = [],
  events = [],
  showNotice,
  onClose,
}) {
  const [connections, setConnections] = useState(null); // null = loading
  const [activeConnId, setActiveConnId] = useState(initialConnectionId);
  const [calendars, setCalendars] = useState(null);      // provider calendars for activeConn
  // Connected calendars always import into Plan — Reality (LIVE) mirrors Plan by
  // default, so a synced source only ever writes to the Plan side.
  const target = 'plan';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingDisconnect, setPendingDisconnect] = useState(null);

  function connectionContents(connectionId) {
    const calendarsForConnection = linkedCalendars.filter(cal => String(cal.connectionId) === String(connectionId));
    const calendarIds = new Set(calendarsForConnection.map(cal => String(cal.id)));
    const affectedEvents = events
      .filter(event => calendarIds.has(String(event.source_calendar_id ?? event.sourceCalendarId)) && event.source !== 'auto-completed')
      .sort((a, b) => addDays(a.week_start, a.day_of_week).localeCompare(addDays(b.week_start, b.day_of_week)));
    return { calendarsForConnection, affectedEvents };
  }

  async function confirmDisconnect(connectionId) {
    const { calendarsForConnection } = connectionContents(connectionId);
    await api.calendarConnections.delete(connectionId);
    calendarsForConnection.forEach(calendar => deleteLinkedCalendar?.(calendar.id));
    setConnections(prev => prev.filter(connection => connection.id !== connectionId));
    setPendingDisconnect(null);
  }

  useEffect(() => {
    api.calendarConnections.list()
      .then(setConnections)
      .catch(() => setConnections([]));
  }, []);

  const loadCalendars = useCallback(async (connId) => {
    setCalendars(null);
    setError('');
    try {
      setCalendars(await api.calendarConnections.listCalendars(connId));
    } catch (err) {
      setError(err.message || 'Could not load calendars.');
      setCalendars([]);
    }
  }, []);

  // When a connection is active (freshly connected or picked), load its calendars.
  useEffect(() => {
    if (activeConnId) loadCalendars(activeConnId);
  }, [activeConnId, loadCalendars]);

  async function startConnect(provider) {
    setBusy(true);
    setError('');
    try {
      const { url } = await api.oauth.connectUrl(provider);
      window.location.href = url; // leaves the app; returns via OAuth redirect
    } catch (err) {
      setError(err.message || `Could not start ${provider} sign-in.`);
      setBusy(false);
    }
  }

  async function importCalendar(cal) {
    const conn = connections?.find(c => c.id === activeConnId);
    const provider = conn?.provider;
    setBusy(true);
    setError('');
    try {
      const { id } = addLinkedCalendar({
        name: cal.name,
        calendar: target,
        source: provider,
        connectionId: activeConnId,
        externalCalendarId: cal.id,
        syncEnabled: true,
        // Unix seconds, matching the ICS-subscribe path + the list's
        // `new Date(lastSyncedAt * 1000)` display (a date string would render NaN).
        lastSyncedAt: Math.floor(Date.now() / 1000),
      });
      const raw = await api.calendarConnections.listEvents(activeConnId, cal.id);
      const appEvents = raw
        .map(ev => providerEventToAppEvent(ev, target, precision))
        .filter(Boolean)
        .map(ev => ({ ...ev, source: provider }));
      replaceEventsBySourceCalendar(id, appEvents);
      showNotice?.(`${cal.name} connected — ${appEvents.length} event${appEvents.length !== 1 ? 's' : ''} imported`);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not import this calendar.');
      setBusy(false);
    }
  }

  const activeConn = connections?.find(c => c.id === activeConnId);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Connect a calendar</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Import events from Google or Outlook. Your account password and tokens stay private.
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Connected calendars import into Plan; Reality mirrors Plan. */}
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
            Imports into your <span className="font-medium text-gray-700 dark:text-gray-300">Plan</span>.
            Reality mirrors your Plan automatically, so a connected calendar only ever writes to the Plan side.
          </p>

          {/* Step 1: choose / add a connection */}
          {!activeConnId && (
            <div className="space-y-3">
              {Object.values(PROVIDERS).map(p => (
                <button key={p.id} type="button" disabled={busy} onClick={() => startConnect(p.id)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
                  <span className="font-medium text-gray-800 dark:text-gray-200">Connect {p.label}</span>
                  <span className="text-gray-400">→</span>
                </button>
              ))}

              {connections === null ? (
                <p className="text-xs text-gray-400">Loading connections…</p>
              ) : connections.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Already connected</p>
                  <div className="space-y-1.5">
                    {connections.map(c => {
                      const { calendarsForConnection, affectedEvents } = connectionContents(c.id);
                      const confirming = pendingDisconnect === c.id;
                      return (
                        <div key={c.id} className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <button type="button" onClick={() => setActiveConnId(c.id)}
                              className="flex-1 text-left text-sm text-gray-700 dark:text-gray-200 truncate">
                              {PROVIDERS[c.provider]?.short ?? c.provider}
                              {c.accountEmail ? ` · ${c.accountEmail}` : ''}
                            </button>
                            <button type="button" title="Disconnect"
                              onClick={() => setPendingDisconnect(confirming ? null : c.id)}
                              className="text-xs text-gray-400 hover:text-red-500 flex-shrink-0">✕</button>
                          </div>
                          {confirming && (
                            <div className="space-y-2">
                              <p className="text-xs text-red-500 dark:text-red-400">
                                Disconnecting removes {calendarsForConnection.length} imported calendar{calendarsForConnection.length !== 1 ? 's' : ''} and {affectedEvents.length} event{affectedEvents.length !== 1 ? 's' : ''}.
                              </p>
                              {affectedEvents.length > 0 && (
                                <div className="max-h-40 overflow-y-auto rounded-lg border border-red-100 dark:border-red-900/40 divide-y divide-red-100 dark:divide-red-900/30">
                                  {affectedEvents.map(event => (
                                    <div key={event.id} className="px-2 py-1.5">
                                      <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{event.label || 'Untitled event'}</p>
                                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{addDays(event.week_start, event.day_of_week)}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setPendingDisconnect(null)} className="text-xs text-gray-500 dark:text-gray-400">Cancel</button>
                                <button type="button" onClick={() => confirmDisconnect(c.id).catch(err => setError(err.message || 'Could not disconnect account.'))}
                                  className="text-xs px-2 py-1 rounded bg-red-500 hover:bg-red-600 text-white font-medium">Disconnect</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: pick which provider calendar to import */}
          {activeConnId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  {activeConn ? `${PROVIDERS[activeConn.provider]?.short ?? activeConn.provider} calendars` : 'Select a calendar'}
                </p>
                <button type="button" onClick={() => { setActiveConnId(null); setCalendars(null); }}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">← Back</button>
              </div>
              {calendars === null ? (
                <p className="text-xs text-gray-400">Loading calendars…</p>
              ) : calendars.length === 0 ? (
                <p className="text-xs text-gray-400">No calendars found.</p>
              ) : (
                calendars.map(cal => (
                  <button key={cal.id} type="button" disabled={busy} onClick={() => importCalendar(cal)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50">
                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                      {cal.name}{cal.primary ? ' (primary)' : ''}
                    </span>
                    <span className="text-xs text-blue-500 flex-shrink-0">{busy ? '…' : 'Import'}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
