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

// "Third Monday in January", "Last Monday in May", "Fourth Thursday of November"
// — nth-weekday-of-month phrases chrono splinters into two wrong matches. We
// compute the concrete date ourselves and rewrite it to "Month D, YYYY".
const NTH_WEEKDAY_RE = /\b(first|second|third|fourth|fifth|last)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(?:in|of)\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const ORDINALS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, last: 'last' };

/** Date of the nth (or last) given weekday in a month. weekday: 0=Sun..6=Sat. */
function nthWeekdayDate(n, weekday, year, month) {
  if (n === 'last') {
    const last = new Date(year, month + 1, 0);
    return new Date(year, month, last.getDate() - ((last.getDay() - weekday + 7) % 7));
  }
  const firstDow = new Date(year, month, 1).getDay();
  return new Date(year, month, 1 + ((weekday - firstDow + 7) % 7) + (n - 1) * 7);
}

/** Resolve an nth-weekday phrase to a concrete forward date, as "Month D, YYYY". */
function resolveNthWeekday(ordWord, weekdayIdx, month, ref) {
  const n = ORDINALS[ordWord.toLowerCase()];
  const refDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  let date = nthWeekdayDate(n, weekdayIdx, ref.getFullYear(), month);
  if (date < refDay) date = nthWeekdayDate(n, weekdayIdx, ref.getFullYear() + 1, month); // forwardDate
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// chrono-node parses bare relative words (e.g. "now" inside "months from
// now") as their own standalone match; drop those once a real date match
// exists too, so a lone "lunch tomorrow" is still left alone.
const BARE_RELATIVE_RE = /^(now|today|tonight|tomorrow|yesterday)$/i;

// Vague relative ranges chrono pulls out of prose ("earlier this week",
// "starting next week" → "this week"/"next week"). Like BARE_RELATIVE_RE, these
// are only dropped when a more concrete match is also present, so a lone
// "vacation next week" still parses.
const VAGUE_RELATIVE_RE = /^(?:this|next|last)\s+(?:week|month|year|weekend)$/i;

// A bare interval chrono extracts from phrases like "every 4 years following..."
// ("4 years"). Never an event on its own; dropped when a real match is present.
const INTERVAL_ONLY_RE = /^\d+\s+(?:year|month|week|day)s?$/i;

// Trailing connector phrases anchored at the end of the pre-date text (e.g.
// "... months from now"). Stripped before the leading-filler pass below so
// "from" inside "months from now" never reaches it.
const TRAILING_FILLER_RE = /(\s*\b(?:for|at|on|from|about|regarding|re:|is|are|was|that'?s|too|confirmed|scheduled|planned|booked|happening|months from now|weeks from now|days from now|months from|weeks from|next week|next month|soon|months out|down the road)\b[\s,;]*)$/i;

// Leading "topic introduction" filler: the matched phrase and everything
// before it is dropped, keeping only what follows (e.g. "told me about
// thanksgiving dinner" → "thanksgiving dinner", "let's hold the workshop" →
// "workshop"). Deliberately excludes "from" -- it's also legitimately part of
// titles like "invite from Sarah".
const LEADING_FILLER_RE = /^.*?\b(?:for|about|regarding|re:|also known as|also|let'?s|please|don'?t forget(?:\s+the)?|remember to|reminder that|we(?:'ll| will| should| need to| want to)|i'?ll(?:\s+add)?|i\s+will(?:\s+add)?|i(?:'d like to| want to| need to| plan to)|like to|planning to|going to|do|hold(?:\s+the)?|set up|lock in|hi\s+\w+[\s,]+we(?:'re|are)?\s+\w+)\b\s*/i;
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
const DURATION_ONLY_RE = /^(?:(?:for|about|around|approx\.?|approximately|~)\s*)?\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m)$/i;

// Recurrence connector words to strip out of an extracted label ("standup
// every Monday" → "standup", "rent monthly" → "rent"). Includes a bare
// trailing "every"/"each" because chrono usually swallows the day/period into
// its own match, leaving just the connector behind on the label side.
const RECURRENCE_STRIP_RE = /\b(?:every\s+other\s+\w+|every\s+other|every\s+\d+\s+weeks?|bi-?weekly|fortnightly|weekly|daily|monthly|yearly|annually|every\s+(?:day|week|month|year|mon\w*|tue\w*|wed\w*|thu\w*|fri\w*|sat\w*|sun\w*)|each\s+(?:day|week|month|year)|every|each)\b/gi;

// Attendees: "with <name>[, <name>][ and <name>]". A name is a Capitalized word
// or one of a small set of lowercase relationship words ("dad", "mom") — so
// "with dad" is captured while ordinary phrases ("with the team", "with coffee")
// are not. Case-sensitive on purpose: the capitalized branch must not match
// arbitrary lowercase words.
// Longer / hyphenated forms first so alternation matches them before a shorter
// prefix (e.g. "father-in-law" before "father").
const RELATION_WORDS = [
  'mother-in-law', 'father-in-law', 'sister-in-law', 'brother-in-law', 'daughter-in-law', 'son-in-law', 'in-laws', 'in-law',
  'grandmother', 'grandfather', 'granddaughter', 'grandson', 'granddad', 'grandma', 'grandpa', 'grandkids',
  'stepmother', 'stepfather', 'stepbrother', 'stepsister', 'stepmom', 'stepdad', 'stepson', 'stepdaughter',
  'girlfriend', 'boyfriend', 'partner', 'fiancee', 'fiance', 'fiancée', 'fiancé', 'spouse', 'hubby',
  'mother', 'father', 'brother', 'sister', 'siblings', 'sibling', 'daughter', 'son',
  'mommy', 'daddy', 'mama', 'papa', 'mum', 'mom', 'dad', 'nana', 'granny', 'gramps', 'pops', 'folks',
  'wife', 'husband', 'uncle', 'auntie', 'aunt', 'cousin', 'nephew', 'niece', 'godmother', 'godfather',
  'boss', 'manager', 'coworker', 'colleague', 'teammate', 'mentor', 'coach', 'roommate', 'neighbor', 'neighbour',
].join('|');
const NAME_TOKEN = `(?:[A-Z][a-zA-Z.'-]+|${RELATION_WORDS})`;
// Allow an optional possessive ("with my mom", "with our daughter") before the
// name list; it's dropped from the captured names.
const ATTENDEE_RE = new RegExp(`\\bwith\\s+(?:my\\s+|our\\s+)?(${NAME_TOKEN}(?:(?:\\s*,\\s*|\\s+and\\s+|\\s+&\\s+)(?:my\\s+|our\\s+)?${NAME_TOKEN})*)`);

// Location: "at|@|in <Place>", where the time-of-day "at" has already been
// consumed by chrono. Each word of the place must start uppercase or a digit so
// the capture stops at the next lowercase connector ("at Nobu with Sarah" →
// "Nobu"). The stop-list rejects time words chrono occasionally leaves behind.
const LOCATION_RE = /\b(?:at|@|in)\s+((?:the\s+)?[A-Z][\w'&#-]*(?:\s+[A-Z0-9][\w'&#-]*)*)/;
const LOCATION_STOP_RE = /^(?:the\s+)?(?:morning|afternoon|evening|night|noon|midnight|midday|tonight|today|tomorrow|yesterday|jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i;

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Add one calendar day to a YYYY-MM-DD string. Anchored at noon so a DST
 * transition can't shift the day, and formatted with the same local-time
 * helper as toDateStr — never round-tripping through UTC — so the result is
 * correct in every timezone, including UTC+13/+14 where a UTC round-trip
 * would land on the wrong calendar day.
 */
function addDayStr(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return toDateStr(d);
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

/**
 * Classify an explicit recurrence phrase on a line into a repeat frequency
 * matching the app's series model ('daily' | 'weekly' | 'biweekly' | 'monthly'
 * | 'yearly'), or null when there is none. Order matters: the bi-weekly forms
 * contain the word "week", so they are checked before plain weekly.
 * "every weekday" is intentionally not matched — the series model can't express
 * a Mon–Fri-only cadence, so those stay single events.
 */
function detectRecurrence(line) {
  const s = line.toLowerCase();
  if (/\bevery\s+other\s+(?:week|\w*day)\b|\bbi-?weekly\b|\bfortnightly\b|\bevery\s+(?:2|two)\s+weeks?\b/.test(s)) return 'biweekly';
  if (/\bdaily\b|\bevery\s+day\b|\beach\s+day\b/.test(s)) return 'daily';
  if (/\bweekly\b|\bevery\s+week\b|\beach\s+week\b|\bevery\s+(?:mon|tue|wed|thu|fri|sat|sun)/.test(s)) return 'weekly';
  if (/\bmonthly\b|\bevery\s+month\b|\beach\s+month\b/.test(s)) return 'monthly';
  if (/\byearly\b|\bannually\b|\bevery\s+year\b|\beach\s+year\b/.test(s)) return 'yearly';
  return null;
}

/** Extract attendee display names from a "with ..." clause, or [] if none. */
function extractAttendees(text) {
  const m = ATTENDEE_RE.exec(text);
  if (!m) return [];
  const seen = new Set();
  return m[1]
    .split(/\s*,\s*|\s+and\s+|\s+&\s+/)
    .map(n => n.trim().replace(/^(?:my|our)\s+/i, ''))
    .filter(n => n.length > 1 && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()))
    // Title-case so a lowercase relationship word ("dad") reads as a name ("Dad").
    .map(n => ({ displayName: n.charAt(0).toUpperCase() + n.slice(1), source: 'paste' }));
}

/** Extract a location from an "at/@/in <Place>" clause, or null if none. */
function extractLocation(text) {
  const m = LOCATION_RE.exec(text);
  if (!m) return null;
  const place = m[1].trim();
  return LOCATION_STOP_RE.test(place) ? null : place;
}

/**
 * Keep only the final sentence/clause of the text before the date, so a whole
 * paragraph of prose ("Thanks for the call. As discussed, let's hold the
 * workshop June 18") doesn't get swept into the label — just the clause the
 * date belongs to ("let's hold the workshop").
 */
// Sentence/clause boundaries: sentence-enders, a colon, or a newline. Two
// deliberate exceptions: an em-dash is NOT a boundary (it usually joins related
// content within one sentence — "2pm — for about 90 minutes"), and a period is
// NOT a boundary when it follows a common abbreviation or single initial, so
// "Martin Luther King Jr. Day" and "St. Marks Church" stay in one piece.
const CLAUSE_SPLIT_RE = /(?<!\b(?:jr|sr|dr|mr|mrs|ms|st|mt|ave|rd|blvd|vs|etc|no|inc|ltd|co|[a-z]))\.\s+|[!?;:]\s+|\n/i;

function lastClause(text) {
  const parts = text.split(CLAUSE_SPLIT_RE).filter(p => p.trim());
  return parts.length ? parts[parts.length - 1] : text;
}

/** The first clause of the text that follows the date match, for the same
 * sentence-bounding reason as lastClause. */
function firstClause(text) {
  return text.split(CLAUSE_SPLIT_RE)[0] ?? text;
}

/**
 * For vertically-listed items (a name on one line, the date a few lines below,
 * blank/tab lines between), the date's own line has no label. Walk back to the
 * nearest non-blank line and use that as the label.
 */
function labelFromPreviousLines(text, lineStart) {
  const lines = text.slice(0, lineStart).split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line) return line;
  }
  return '';
}

/**
 * Light cleaning for a label pulled from a list (a preceding line or a trailing
 * column) — a complete title, not intro-then-subject prose, so it deliberately
 * does NOT run the aggressive leading/trailing filler that would eat proper
 * names like "National Day for ...". Just drops an "Also known as" prefix and
 * trims surrounding bullets/dashes/punctuation.
 */
function cleanListLabel(s) {
  return String(s ?? '')
    .replace(/^(?:also\s+known\s+as|aka)\s+/i, '')
    .replace(/^[\s\-–—:*•]+/, '')
    .replace(/[\s\-–—:,]+$/, '')
    .trim();
}

/** Strip filler/connector text surrounding the real event subject. */
function extractLabel(precedingText) {
  let s = lastClause(precedingText).replace(DURATION_RE, ' ').replace(RECURRENCE_STRIP_RE, ' ');
  // Drop attendee/location clauses so they don't leak into the title. Only the
  // capitalized forms match, so ordinary title words are left alone.
  s = s.replace(ATTENDEE_RE, ' ').replace(LOCATION_RE, ' ');
  s = applyUntilStable(s, TRAILING_FILLER_RE);
  s = applyUntilStable(s, LEADING_FILLER_RE);
  return s.replace(/[\s\-–—:,]+$/, '').trim();
}

/** Normalize awkward date phrasings chrono can't handle, once, before parsing. */
function normalizeDatePhrasings(rawText, referenceDate) {
  return rawText
    .replace(ORDINAL_OF_MONTH_RE, '$2 $1')
    .replace(NTH_WEEKDAY_RE, (_m, ord, weekday, month) => resolveNthWeekday(
      ord,
      ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(weekday.toLowerCase()),
      MONTH_NAMES.findIndex(n => n.toLowerCase() === month.toLowerCase()),
      referenceDate,
    ));
}

// Split a line into columns for tabular detection. Pipes and tabs are strong
// table signals (prose has neither), so either column orientation is allowed;
// a spaced dash is weaker (prose asides use it too), so it yields two columns
// and the caller only trusts it when the date is on the right. Plain spaces are
// never a separator. Returns { cells, kind } or null.
function splitColumns(line) {
  if (line.includes('|')) return { cells: line.split('|').map(c => c.trim()), kind: 'strong' };
  if (line.includes('\t')) return { cells: line.split('\t').map(c => c.trim()), kind: 'strong' };
  const dash = line.match(/ +[–—-]+ +/);
  if (dash) return { cells: [line.slice(0, dash.index).trim(), line.slice(dash.index + dash[0].length).trim()], kind: 'dash' };
  return null;
}

/** How date-like a chrono match is: 3 = has a month, 2 = a day number, 1 = a
 *  bare weekday/relative, 0 = no match. Lets us tell the date column from the
 *  name column even when a name contains a weekday ("Good Friday"). */
function dateLikeScore(match) {
  if (!match) return 0;
  if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(match.text)) return 3;
  if (/\d/.test(match.text)) return 2;
  return 1;
}

/**
 * If a line is a tabular "label <sep> date" or "date <sep> label" row, return
 * { label, dateMatch }. chrono is only ever run per-column, so a weekday inside
 * a name ("Good Friday", "Black Friday") can't spawn a phantom event. Returns
 * null for non-tabular lines, which fall through to the natural-language pass.
 */
function parseListLine(line, referenceDate) {
  const split = splitColumns(line);
  if (!split) return null;
  const cells = split.cells.filter(Boolean);
  if (cells.length < 2) return null;

  const scored = cells.map(c => {
    const m = chrono.parse(c, referenceDate, { forwardDate: true })[0];
    return { text: c, match: m, score: dateLikeScore(m) };
  });

  // The date column is the most date-like cell; it must carry a real calendar
  // date (a month or day number), which keeps ambiguous prose out.
  let dateCell = scored[0];
  for (const s of scored) if (s.score > dateCell.score) dateCell = s;
  if (dateCell.score < 2) return null;

  // A dash aside ("dinner June 20 at 7pm — bring wine") has its date on the LEFT;
  // a real "Name – Date" row has it on the right. Only trust a dash split when the
  // date is the last cell. Pipes/tabs are unambiguous, so either side is fine.
  if (split.kind === 'dash' && dateCell !== scored[scored.length - 1]) return null;

  // Label = the first other cell that actually contains letters.
  const labelCell = scored.find(s => s !== dateCell && /[a-z]/i.test(s.text));
  if (!labelCell) return null;

  return { label: cleanListLabel(labelCell.text), dateMatch: dateCell.match };
}

/** Build an event from a chrono match + an already-resolved label. */
function dateMatchToEvent(dateMatch, label, meetingUrl) {
  const startDate = toDateStr(dateMatch.start.date());
  const hasTime = dateMatch.start.isCertain('hour');
  let startTime, endDate, endTime, allDay = false, confidence;
  if (!hasTime) {
    allDay = true;
    startTime = '00:00';
    endTime = '23:59';
    endDate = dateMatch.end ? toDateStr(dateMatch.end.date()) : startDate;
    confidence = 'medium';
  } else {
    const h = dateMatch.start.get('hour') ?? 9;
    const mi = dateMatch.start.get('minute') ?? 0;
    startTime = padHHMM(h, mi);
    if (dateMatch.end) {
      endDate = toDateStr(dateMatch.end.date());
      endTime = padHHMM(dateMatch.end.get('hour') ?? h + 1, dateMatch.end.get('minute') ?? 0);
      confidence = 'high';
    } else {
      ({ endDate, endTime } = addMinutes(startDate, startTime, 60));
      confidence = 'medium';
    }
  }
  return { label: label || dateMatch.text, startDate, startTime, endDate, endTime, allDay, confidence, ...(meetingUrl ? { meeting_url: meetingUrl } : {}) };
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

  const normalized = normalizeDatePhrasings(rawText, referenceDate);

  // ── Pass 1.5: tabular list rows ("Jan 1<TAB>New Year's Day", "Good Friday –
  // April 3, 2026"). Handled per-column so a weekday inside a name never becomes
  // a phantom event. Rows that match are removed before the NL pass. ───────────
  const listResults = [];
  const remainingLines = [];
  for (const line of normalized.split(/\r?\n/)) {
    const parsed = parseListLine(line, referenceDate);
    if (parsed) listResults.push(dateMatchToEvent(parsed.dateMatch, parsed.label, meetingUrl));
    else remainingLines.push(line);
  }

  // ── Pass 2: natural language fallback on the remaining (non-tabular) lines ───
  const nlResults = [];
  const text = remainingLines.join('\n');
  let chronoMatches = chrono.parse(text, referenceDate, { forwardDate: true });
  chronoMatches = chronoMatches.filter(m => !DURATION_ONLY_RE.test(m.text.trim()));
  if (chronoMatches.length > 1) {
    chronoMatches = chronoMatches.filter(m => {
      const t = m.text.trim();
      return !BARE_RELATIVE_RE.test(t) && !VAGUE_RELATIVE_RE.test(t) && !INTERVAL_ONLY_RE.test(t);
    });
  }

  // A time-only match ("9:00 AM", "at 3pm") with no date of its own inherits the
  // most recent real date seen above it — so an agenda under a "March 6" header,
  // or a follow-up "also at 4pm", lands on the right day instead of today.
  let contextDate = null;

  for (const r of chronoMatches) {
    const hasTime     = r.start.isCertain('hour');
    const hasRealDate = r.start.isCertain('day') || r.start.isCertain('month') || r.start.isCertain('weekday');

    let startDate;
    if (!hasRealDate && hasTime && contextDate) {
      startDate = toDateStr(contextDate);
    } else {
      startDate = toDateStr(r.start.date());
      if (hasRealDate) contextDate = r.start.date();
    }

    // The full line the match sits on, split around the matched date/time text.
    const lineStart = text.lastIndexOf('\n', r.index - 1) + 1;
    let lineEnd = text.indexOf('\n', r.index);
    if (lineEnd === -1) lineEnd = text.length;
    const offsetInLine = r.index - lineStart;
    const fullLine = text.slice(lineStart, lineEnd);
    const precedingText = fullLine.slice(0, offsetInLine);
    // Text after the match up to the next newline. Computed from the full text
    // (not fullLine) so a match that itself spans a newline — chrono sometimes
    // merges a header date with the following time — still sees its trailing name.
    const matchEnd = r.index + r.text.length;
    let afterEnd = text.indexOf('\n', matchEnd);
    if (afterEnd === -1) afterEnd = text.length;
    const afterText = text.slice(matchEnd, afterEnd);

    // Bound duration/attendee/location extraction to the match's own sentence
    // clause — the part before it back to the last sentence break, plus the
    // part after it up to the next one — so a "with <name>" or "at <place>" in a
    // neighbouring sentence of the same paragraph can't bleed onto this event.
    const beforeClause = lastClause(precedingText);
    const afterClause = firstClause(afterText);
    const clauseWindow = beforeClause + ' ' + afterClause;
    // Recurrence needs the date phrase kept inline ("every Monday"), so it reads
    // the whole sentence including the match text.
    const matchSentence = beforeClause + ' ' + r.text + ' ' + afterClause;

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
        const durationMin = parseDurationMinutes(clauseWindow);
        ({ endDate, endTime } = durationMin != null
          ? addMinutes(startDate, startTime, durationMin)
          : addMinutes(startDate, startTime, 60));
        confidence = 'medium';
      }
    }

    // Label sources: (1) same-line text before the date (prose: "lunch June 5");
    // (2) same-line text after a leading date ("01/01/2026 New Year's Day"), when
    // it reads like a title rather than a date continuation (", every 4 years");
    // (3) nearest preceding non-blank line (vertical "Name \n\n Date").
    let label = extractLabel(precedingText);
    if (!label) {
      const after = afterText.replace(/^[\s:–—-]+/, '');
      const isContinuation = /^[,;(]/.test(afterText.trim())
        || /^(?:every|and|at|on|in|for|to|through|following|until|repeats?)\b/i.test(after);
      if (after && !isContinuation) label = cleanListLabel(firstClause(after));
    }
    if (!label) {
      const prev = labelFromPreviousLines(text, lineStart);
      label = cleanListLabel(prev) || prev || r.text;
    }
    label = label.replace(/\s+/g, ' ').trim(); // never leak newlines into a label
    const recurrence = detectRecurrence(matchSentence);
    const people = extractAttendees(clauseWindow);
    const location = extractLocation(clauseWindow);
    nlResults.push({
      label, startDate, startTime, endDate, endTime, allDay, confidence,
      ...(recurrence ? { recurrence } : {}),
      ...(location ? { location } : {}),
      ...(people.length ? { people } : {}),
      ...(meetingUrl ? { meeting_url: meetingUrl } : {}),
    });
  }

  return [...listResults, ...nlResults];
}
