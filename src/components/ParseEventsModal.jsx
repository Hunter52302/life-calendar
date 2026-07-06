import { useState, useEffect, useRef } from 'react';
import { parseEventText } from '../lib/parserRouter.js';
import { buildSegments, dateToWeekData } from '../lib/calendarUtils.js';
import { generateId, generateRepeatInstances } from '../lib/utils.js';
import { useVoiceInput } from '../hooks/useVoiceInput.js';

// Repeat frequencies, matching generateRepeatInstances() and the Add Event form.
const REPEAT_OPTIONS = [
  { value: 'none',     label: 'Does not repeat' },
  { value: 'daily',    label: 'Daily' },
  { value: 'weekly',   label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly',  label: 'Monthly' },
  { value: 'yearly',   label: 'Yearly' },
];
// How many instances generateRepeatInstances() creates per frequency — shown on
// the badge so the number of events added is never a surprise.
const REPEAT_TOTAL = { daily: 365, weekly: 52, biweekly: 26, monthly: 12, yearly: 3 };
const REPEAT_SHORT = { daily: 'daily', weekly: 'weekly', biweekly: 'every 2 wks', monthly: 'monthly', yearly: 'yearly' };

// ── Tiny UI primitives (self-contained to avoid coupling to QuickAddFAB) ──────
const inputCls =
  'w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 ' +
  'dark:placeholder-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none ' +
  'focus:ring-2 focus:ring-purple-500 focus:border-transparent';

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      {children}
    </div>
  );
}

function CategoryPills({ allCategories, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {allCategories.map(cat => (
        <button
          key={cat.id} type="button" onClick={() => onChange(cat.id)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            value === cat.id ? 'text-white border-transparent' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
          }`}
          style={value === cat.id ? { backgroundColor: cat.color } : {}}
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
          {cat.label}
        </button>
      ))}
    </div>
  );
}

// ── Confidence badge ──────────────────────────────────────────────────────────
const CONFIDENCE_STYLES = {
  high:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  low:    'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};
const CONFIDENCE_LABELS = { high: 'exact', medium: 'approx', low: 'inferred' };

function ConfidenceBadge({ confidence }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${CONFIDENCE_STYLES[confidence] ?? CONFIDENCE_STYLES.low}`}>
      {CONFIDENCE_LABELS[confidence] ?? confidence}
    </span>
  );
}

// ── Format "YYYY-MM-DD" as a short readable date ──────────────────────────────
function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Format "HH:MM" as 12h or 24h string ────────────────────────────────────────
function fmtTime(hhmm, military) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (military) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const ap  = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

// ── Single parsed event card ──────────────────────────────────────────────────
function ParsedEventCard({ draft, allCategories, militaryTime, onChange, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const isMultiDay = draft.endDate !== draft.startDate;

  return (
    <div className={`border rounded-xl p-3 transition-opacity ${
      draft.enabled
        ? 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
        : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 opacity-50'
    }`}>
      <div className="flex items-start gap-3">
        {/* Toggle */}
        <button
          type="button"
          onClick={onToggle}
          className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
            draft.enabled ? 'bg-purple-600 border-purple-600' : 'border-gray-300 dark:border-gray-600'
          }`}
          aria-label={draft.enabled ? 'Exclude event' : 'Include event'}
        >
          {draft.enabled && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Summary row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{draft.label || '(no label)'}</span>
            <ConfidenceBadge confidence={draft.confidence} />
            {!draft.catId && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                uncategorized
              </span>
            )}
            {isMultiDay && (
              <span className="text-[10px] text-amber-500 font-medium">2 segments</span>
            )}
            {draft.meeting_url && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                Meeting link detected
              </span>
            )}
            {draft.recurrence && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                ↻ {REPEAT_SHORT[draft.recurrence] ?? draft.recurrence}
                {REPEAT_TOTAL[draft.recurrence] ? ` · ${REPEAT_TOTAL[draft.recurrence]}×` : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {draft.allDay ? (
              <>{fmtDate(draft.startDate)}{isMultiDay ? ` → ${fmtDate(draft.endDate)}` : ''} · All day</>
            ) : (
              <>
                {fmtDate(draft.startDate)} · {fmtTime(draft.startTime, militaryTime)}
                {' → '}
                {isMultiDay ? `${fmtDate(draft.endDate)} ` : ''}{fmtTime(draft.endTime, militaryTime)}
              </>
            )}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: allCategories.find(c => c.id === draft.catId)?.color ?? '#6B7280' }} />
            {allCategories.find(c => c.id === draft.catId)?.label ?? (draft.catId || 'Uncategorized')}
            {' · '}
            {draft.calendar === 'plan' ? 'Plan' : 'Live'}
          </p>
        </div>

        {/* Edit toggle */}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex-shrink-0"
        >
          {expanded ? 'Done' : 'Edit'}
        </button>
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div className="mt-3 space-y-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <Field label="Event name">
            <input
              type="text" value={draft.label} className={inputCls}
              onChange={e => onChange({ ...draft, label: e.target.value })}
            />
          </Field>
          <div className="flex gap-2">
            <Field label="Start date" className="flex-1">
              <input type="date" value={draft.startDate} className={inputCls}
                onChange={e => onChange({ ...draft, startDate: e.target.value })} />
            </Field>
            {!draft.allDay && (
              <Field label="Start time" className="flex-1">
                <input type="time" value={draft.startTime} className={inputCls}
                  onChange={e => onChange({ ...draft, startTime: e.target.value })} />
              </Field>
            )}
          </div>
          <div className="flex gap-2">
            <Field label="End date" className="flex-1">
              <input type="date" value={draft.endDate} className={inputCls}
                onChange={e => onChange({ ...draft, endDate: e.target.value })} />
            </Field>
            {!draft.allDay && (
              <Field label="End time" className="flex-1">
                <input type="time" value={draft.endTime} className={inputCls}
                  onChange={e => onChange({ ...draft, endTime: e.target.value })} />
              </Field>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={!!draft.allDay} className="w-4 h-4 rounded accent-blue-500"
              onChange={e => onChange(e.target.checked
                ? { ...draft, allDay: true, startTime: '00:00', endTime: '23:59' }
                : { ...draft, allDay: false })} />
            <span className="text-sm text-gray-600 dark:text-gray-300">All day <span className="text-gray-400 dark:text-gray-500">(midnight → 11:59 PM)</span></span>
          </label>
          <Field label="Category">
            <CategoryPills allCategories={allCategories} value={draft.catId}
              onChange={catId => onChange({ ...draft, catId: draft.catId === catId ? null : catId })} />
          </Field>
          <Field label="Repeat">
            <select
              value={draft.recurrence ?? 'none'}
              className={inputCls}
              onChange={e => onChange({ ...draft, recurrence: e.target.value === 'none' ? null : e.target.value })}
            >
              {REPEAT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            {draft.recurrence && isMultiDay && (
              <p className="text-[11px] text-amber-500 mt-1">Repeat applies to single-day events only; this multi-day event will be added once.</p>
            )}
          </Field>
          <Field label="Calendar">
            <div className="flex gap-2">
              {['plan', 'actual'].map(cal => (
                <button
                  key={cal} type="button"
                  onClick={() => onChange({ ...draft, calendar: cal })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    draft.calendar === cal
                      ? cal === 'plan'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {cal === 'plan' ? 'Plan' : 'Live'}
                </button>
              ))}
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function ParseEventsModal({ allCategories = [], initialText = '', militaryTime = false, keywordMap = {}, llmSettings = null, autoStartVoice = false, onAddEvents, onClose }) {
  const [rawText, setRawText] = useState(initialText);
  const [drafts,  setDrafts]  = useState(null); // null = input step
  const [detecting, setDetecting] = useState(false);
  const textareaRef = useRef(null);
  const voice = useVoiceInput();
  const voiceBaseRef = useRef('');
  const mountActionRanRef = useRef(false);

  // Auto-detect when initialText is pre-filled (e.g. from PWA share target);
  // auto-start the mic when launched from the FAB's "Record Voice" action.
  // Guarded against StrictMode's dev-mode double-invoke so the mic/parse
  // action (which has real side effects) only ever fires once per mount.
  useEffect(() => {
    if (mountActionRanRef.current) return;
    mountActionRanRef.current = true;
    if (initialText?.trim()) {
      runDetect(initialText);
    } else if (autoStartVoice && voice.supported) {
      toggleMic();
    } else {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, []); // eslint-disable-line

  // Live-append speech transcript into the textarea while listening
  useEffect(() => {
    if (!voice.listening) return;
    const base = voiceBaseRef.current;
    setRawText(base + (base && voice.transcript ? ' ' : '') + voice.transcript);
  }, [voice.transcript, voice.listening]);

  function toggleMic() {
    if (voice.listening) { voice.stop(); return; }
    voiceBaseRef.current = rawText;
    voice.start();
  }

  async function runDetect(text) {
    setDetecting(true);
    const results = await parseEventText(text ?? rawText, llmSettings, keywordMap);
    setDetecting(false);
    if (results.length === 0) {
      setDrafts([]);
      return;
    }
    setDrafts(results.map((r, i) => ({ ...r, id: i, calendar: 'plan', enabled: true })));
  }

  function toggleDraft(id) {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, enabled: !d.enabled } : d));
  }
  function updateDraft(updated) {
    setDrafts(prev => prev.map(d => d.id === updated.id ? updated : d));
  }

  function handleAdd() {
    const toAdd = (drafts ?? []).filter(d => d.enabled).flatMap(d => {
      const cat  = allCategories.find(c => c.id === d.catId);
      const extra = d.meeting_url ? { meeting_url: d.meeting_url } : {};

      // Recurring, single-day events expand into a linked series (one shared
      // series_id) via the same generator the Add Event form uses. Multi-day
      // recurrence isn't expressible in the series model, so those fall through
      // to the per-segment path below.
      if (d.recurrence && d.startDate === d.endDate) {
        const { week_start, day_of_week } = dateToWeekData(d.startDate);
        const [seg] = buildSegments(d.startDate, d.startTime, d.endDate, d.endTime);
        const base = {
          label: d.label.trim() || 'Event',
          category: d.catId,
          color: cat?.color ?? '#6B7280',
          week_start, day_of_week,
          slot_start:    seg.slotStart,
          slot_duration: seg.slotDuration,
          precision:  0.5,
          calendar:   d.calendar,
          source:     'paste',
          is_all_day: !!d.allDay,
          series_id:  generateId(),
        };
        return generateRepeatInstances(base, d.recurrence).map(e => ({ ...e, ...extra }));
      }

      const segs = buildSegments(d.startDate, d.startTime, d.endDate, d.endTime);
      return segs.map(seg => {
        const { week_start, day_of_week } = dateToWeekData(seg.date);
        return {
          label: d.label.trim() || 'Event',
          category: d.catId,
          color: cat?.color ?? '#6B7280',
          week_start, day_of_week,
          slot_start:    seg.slotStart,
          slot_duration: seg.slotDuration,
          precision:  0.5,
          calendar:   d.calendar,
          source:     'paste',
          is_all_day: !!d.allDay,
          ...extra,
        };
      });
    });
    onAddEvents(toAdd);
    onClose();
  }

  const enabledCount = drafts ? drafts.filter(d => d.enabled).length : 0;

  return (
    <div
      className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-end sm:items-center justify-center z-[150] p-4 pb-safe-4 sm:pb-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700"
          style={{ borderTopWidth: 3, borderTopColor: '#8B5CF6', borderTopStyle: 'solid' }}
        >
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {drafts === null ? 'Add Events from Text' : drafts.length === 0 ? 'No events detected' : `${drafts.length} event${drafts.length !== 1 ? 's' : ''} detected`}
          </h2>
          <button
            type="button" onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
          >×</button>
        </div>

        <div className="px-5 py-4 max-h-[75vh] overflow-y-auto">
          {/* ── Step 1: Input ── */}
          {drafts === null && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Paste any text containing dates and times. Works with shift schedules, emails, and messages. Multiple events are each shown as a separate card.
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                💡 On Android, once this app is installed to your home screen you can also highlight text in any app and use its Share button — it'll open straight to this screen. iOS does not support sharing into installed web apps, so paste here instead.
              </p>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  rows={7}
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder={'Thursday June 18: 3B 2300 – 0700\nFriday June 19: 2A 1400 – 2200\n\nor: "team meeting on May 19th from 8 am to 9 pm"'}
                  className={inputCls + ' resize-none font-mono text-xs pr-12'}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runDetect(); }}
                />
                {voice.supported && (
                  <button
                    type="button"
                    onClick={toggleMic}
                    title={voice.listening ? 'Stop listening' : 'Speak instead of typing'}
                    aria-label={voice.listening ? 'Stop listening' : 'Speak instead of typing'}
                    className={`absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-white transition-colors ${
                      voice.listening ? 'bg-red-500 animate-pulse' : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    🎤
                  </button>
                )}
              </div>
              {voice.listening && (
                <p className="text-[11px] text-purple-500 dark:text-purple-400">
                  Listening… speak now. Voice input only works while this tab stays open and focused.
                </p>
              )}
              {!voice.supported && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  Voice input isn't supported in this browser — paste or type instead.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => runDetect()}
                  disabled={!rawText.trim() || detecting}
                  className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                  style={{ backgroundColor: '#8B5CF6' }}
                >
                  {detecting ? 'Detecting…' : 'Detect events →'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: No results ── */}
          {drafts !== null && drafts.length === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No dates or times were found in the text. Try rephrasing or check that the text contains a date.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDrafts(null)}
                  className="px-4 py-2 text-sm text-purple-600 dark:text-purple-400 hover:underline">
                  ← Try again
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Review cards ── */}
          {drafts !== null && drafts.length > 0 && (
            <div className="space-y-3">
              {/* Select all / none */}
              <div className="flex items-center gap-3 pb-1">
                <button type="button" onClick={() => setDrafts(prev => prev.map(d => ({ ...d, enabled: true  })))}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline">Select all</button>
                <button type="button" onClick={() => setDrafts(prev => prev.map(d => ({ ...d, enabled: false })))}
                  className="text-xs text-gray-400 hover:underline">None</button>
                <button type="button" onClick={() => setDrafts(null)}
                  className="text-xs text-gray-400 hover:underline ml-auto">← Re-paste</button>
              </div>

              {drafts.map(d => (
                <ParsedEventCard
                  key={d.id}
                  draft={d}
                  allCategories={allCategories}
                  militaryTime={militaryTime}
                  onChange={updateDraft}
                  onToggle={() => toggleDraft(d.id)}
                />
              ))}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={enabledCount === 0}
                  className="px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                  style={{ backgroundColor: '#8B5CF6' }}
                >
                  Add {enabledCount} event{enabledCount !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
