import * as chrono from 'chrono-node';

// Canonical local ("Tier 1") event parser, shared by the web app
// (src/lib/parseEvents.js) and the mobile app (mobile/src/lib/parseEvents.js),
// both of which re-export from here so the two platforms can never drift.
//
// It runs entirely on-device with no network call — this is the free, private,
// offline default that the LLM tier (parserRouter.js) falls back to.

// Matches lines containing a time range in military (HHMM) format
// e.g. "Thursday June 18: 3B 2300 – 0700"
//      "2A 1400 – 2200"
const SHIFT_RE = /^(.*?)\s+(\d{4})\s*[–\-—]+\s*(\d{4})/;

// chrono-node fails to merge a time phrase with a date phrased as
// "the Nth of MONTH" (ordinal-before-month order); rewrite to "MONTH N"
// so it merges into one match like every other phrasing order does.
const ORDINAL_OF_MONTH_RE = /\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\s+of\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi;

// chrono-node parses bare relative words (e.g. "now" inside "months from
// now") as their own standalone match; drop those once a real date match
// exists too, so a lone "lunch tomorrow" is still left alone.
const BARE_RELATIVE_RE = /^(now|today|tonight|tomorrow|yesterday)$/i;

// Trailing connector phrases anchored at the end of the pre-date text (e.g.
// "... months from now"). Stripped before the leading-filler pass below so
// "from" inside "months from now" never reaches it.
const TRAILING_FILLER_RE = /(\s*\b(?:for|at|on|from|about|regarding|re:|months from now|weeks from now|days from now|months from|weeks from|next week|next month|soon|months out|down the road)\b\s*)$/i;

// Leading "topic introduction" filler: the matched phrase and everything
// before it is dropped, keeping only what follows (e.g. "told me about
// thanksgiving dinner" → "thanksgiving dinner"). Deliberately excludes
// "from" -- it's also legitimately part of titles like "invite from Sarah".
const LEADING_FILLER_RE = /^.*?\b(?:for|about|regarding|re:|hi\s+\w+[\s,]+we(?:'re|are)?\s+\w+)\b\s*/i;
const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/i;

// Explicit duration phrases: "for 2 hours", "90 min", "1.5h", "45 minutes".
// The trailing \b after the bare "h"/"m" units keeps them from matching the
// start of an unrelated word ("3 managers", "2 miles" → no match). Only used
// when an event has no explicit end time of its own.
const DURATION_RE = /(?:\bfor\s+)?\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i;

// chrono parses a bare duration phrase ("for 2 hours", "45m") as its own
// standalone match relative to the reference date. Those are never events on
// their own — they modify a neighbouring event's end time — so they are
// dropped from the match list and re-read from each real match's line instead.
const DURATION_ONLY_RE = /^(?:for\s+)?\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m)$/i;

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Add one calendar day to a YYYY-MM-DD string. */
function addDayStr(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

/** "2300" → "23:00" */
function milToHHMM(hhmm) {
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`;
}

function padHHMM(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
}

/**
 * Add a minute count to a { date, time } pair, rolling the date forward across
 * midnight as needed. Returns { endDate, endTime }.
 */
function addMinutes(startDate, startTime, minutes) {
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const dayOffset = Math.floor(total / 1440);
  const minOfDay = ((total % 1440) + 1440) % 1440;
  let endDate = startDate;
  for (let i = 0; i < dayOffset; i++) endDate = addDayStr(endDate);
  return { endDate, endTime: padHHMM(Math.floor(minOfDay / 60), minOfDay % 60) };
}

/** Parse an explicit duration phrase into whole minutes, or null if none. */
function parseDurationMinutes(text) {
  const m = DURATION_RE.exec(text);
  if (!m) return null;
  const value = parseFloat(m[1]);
  const isHours = m[2][0].toLowerCase() === 'h';
  const minutes = Math.round(isHours ? value * 60 : value);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

function applyUntilStable(s, re) {
  let prev;
  do { prev = s; s = s.replace(re, ''); } while (s !== prev);
  return s;
}

/** Strip filler/connector text surrounding the real event subject. */
function extractLabel(precedingText) {
  let s = precedingText.replace(DURATION_RE, ' ');
  s = applyUntilStable(s, TRAILING_FILLER_RE);
  s = applyUntilStable(s, LEADING_FILLER_RE);
  return s.replace(/[\s\-–—:,]+$/, '').trim();
}

/**
 * Parse raw text into an array of event candidates.
 *
 * Pass 1: structured shift-schedule lines (HHMM – HHMM per line).
 * Pass 2: natural language via chrono-node (forwardDate=true), with
 *         explicit-duration and all-day/date-only handling.
 *
 * @param {string} rawText
 * @param {Date} [referenceDate]
 * @returns {{ label, startDate, startTime, endDate, endTime, allDay, confidence }[]}
 */
export function parseEvents(rawText, referenceDate = new Date()) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const meetingUrl = rawText.match(URL_RE)?.[0] ?? '';

  // ── Pass 1: structured HHMM shift format ───────────────────────────────────
  const shiftResults = [];
  for (const line of lines) {
    const m = SHIFT_RE.exec(line);
    if (!m) continue;

    const [, prefix, startHHMM, endHHMM] = m;

    // Parse the date portion of the prefix using chrono
    const dateMatches = chrono.parse(prefix, referenceDate, { forwardDate: true });
    const dateRef = dateMatches[0] ? dateMatches[0].start.date() : referenceDate;
    const startDate = toDateStr(dateRef);

    // Label: prefix minus the chrono-matched date text, strip leading ": "
    let label = prefix;
    if (dateMatches[0]) {
      label = prefix.replace(dateMatches[0].text, '').replace(/^[:\s]+/, '').trim();
    }
    if (!label) label = 'Event';

    const startTime = milToHHMM(startHHMM);
    const endTime   = milToHHMM(endHHMM);
    // Midnight crossing: end is numerically earlier than start
    const endDate = parseInt(endHHMM, 10) < parseInt(startHHMM, 10)
      ? addDayStr(startDate)
      : startDate;

    shiftResults.push({ label, startDate, startTime, endDate, endTime, allDay: false, confidence: 'high', ...(meetingUrl ? { meeting_url: meetingUrl } : {}) });
  }

  if (shiftResults.length > 0) return shiftResults;

  // ── Pass 2: natural language fallback ──────────────────────────────────────
  const nlResults = [];
  const text = rawText.replace(ORDINAL_OF_MONTH_RE, '$2 $1');
  let chronoMatches = chrono.parse(text, referenceDate, { forwardDate: true });
  chronoMatches = chronoMatches.filter(m => !DURATION_ONLY_RE.test(m.text.trim()));
  if (chronoMatches.length > 1) {
    chronoMatches = chronoMatches.filter(m => !BARE_RELATIVE_RE.test(m.text.trim()));
  }

  for (const r of chronoMatches) {
    const startDate = toDateStr(r.start.date());
    const hasTime   = r.start.isCertain('hour');

    // The full line the match sits on, split into the text before the match
    // and the whole line with the matched date/time phrase removed. The latter
    // is where we look for an explicit duration so we never re-read the time.
    const lineStart = text.lastIndexOf('\n', r.index - 1) + 1;
    let lineEnd = text.indexOf('\n', r.index);
    if (lineEnd === -1) lineEnd = text.length;
    const offsetInLine = r.index - lineStart;
    const fullLine = text.slice(lineStart, lineEnd);
    const precedingText = fullLine.slice(0, offsetInLine);
    const lineWithoutMatch = fullLine.slice(0, offsetInLine) + ' ' + fullLine.slice(offsetInLine + r.text.length);

    let allDay = false;
    let startTime, endDate, endTime, confidence;

    if (!hasTime) {
      // Date with no time of day → an all-day event, rather than a fabricated
      // 09:00 block. The UI understands the allDay flag natively.
      allDay = true;
      startTime = '00:00';
      endTime = '23:59';
      endDate = r.end ? toDateStr(r.end.date()) : startDate;
      confidence = 'medium';
    } else {
      const startH   = r.start.get('hour') ?? 9;
      const startMin = r.start.get('minute') ?? 0;
      startTime = padHHMM(startH, startMin);

      if (r.end) {
        // Explicit end time in the source (e.g. "8am to 9am") — the strongest signal.
        endDate = toDateStr(r.end.date());
        endTime = padHHMM(r.end.get('hour') ?? startH + 1, r.end.get('minute') ?? 0);
        confidence = 'high';
      } else {
        // No end time: honour an explicit duration ("for 2 hours"), else 1 hour.
        const durationMin = parseDurationMinutes(lineWithoutMatch);
        ({ endDate, endTime } = durationMin != null
          ? addMinutes(startDate, startTime, durationMin)
          : addMinutes(startDate, startTime, 60));
        confidence = 'medium';
      }
    }

    const label = extractLabel(precedingText) || r.text;
    nlResults.push({ label, startDate, startTime, endDate, endTime, allDay, confidence, ...(meetingUrl ? { meeting_url: meetingUrl } : {}) });
  }

  return nlResults;
}
