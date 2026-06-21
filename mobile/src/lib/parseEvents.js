import * as chrono from 'chrono-node';
import { addDayStr } from './calendarUtils.js';

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

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function milToHHMM(hhmm) {
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`;
}

function padHHMM(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
}

function addOneHour(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return padHHMM((h + 1) % 24, m);
}

function applyUntilStable(s, re) {
  let prev;
  do { prev = s; s = s.replace(re, ''); } while (s !== prev);
  return s;
}

/** Strip filler/connector text surrounding the real event subject. */
function extractLabel(precedingText) {
  let s = applyUntilStable(precedingText, TRAILING_FILLER_RE);
  s = applyUntilStable(s, LEADING_FILLER_RE);
  return s.replace(/[\s\-–—:,]+$/, '').trim();
}

/**
 * Parse raw text into event candidates.
 * Same algorithm as web src/lib/parseEvents.js (kept in sync manually).
 *
 * @returns {{ label, startDate, startTime, endDate, endTime, confidence }[]}
 */
export function parseEvents(rawText, referenceDate = new Date()) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Pass 1: structured HHMM shift format
  const shiftResults = [];
  for (const line of lines) {
    const m = SHIFT_RE.exec(line);
    if (!m) continue;
    const [, prefix, startHHMM, endHHMM] = m;

    const dateMatches = chrono.parse(prefix, referenceDate, { forwardDate: true });
    const dateRef = dateMatches[0] ? dateMatches[0].start.date() : referenceDate;
    const startDate = toDateStr(dateRef);

    let label = prefix;
    if (dateMatches[0]) {
      label = prefix.replace(dateMatches[0].text, '').replace(/^[:\s]+/, '').trim();
    }
    if (!label) label = 'Event';

    const startTime = milToHHMM(startHHMM);
    const endTime   = milToHHMM(endHHMM);
    const endDate = parseInt(endHHMM, 10) < parseInt(startHHMM, 10)
      ? addDayStr(startDate)
      : startDate;

    shiftResults.push({ label, startDate, startTime, endDate, endTime, confidence: 'high' });
  }

  if (shiftResults.length > 0) return shiftResults;

  // Pass 2: natural language via chrono-node
  const nlResults = [];
  const text = rawText.replace(ORDINAL_OF_MONTH_RE, '$2 $1');
  let chronoMatches = chrono.parse(text, referenceDate, { forwardDate: true });
  if (chronoMatches.length > 1) {
    chronoMatches = chronoMatches.filter(m => !BARE_RELATIVE_RE.test(m.text.trim()));
  }

  for (const r of chronoMatches) {
    const startDate = toDateStr(r.start.date());
    const startH    = r.start.get('hour') ?? 9;
    const startMin  = r.start.get('minute') ?? 0;
    const startTime = padHHMM(startH, startMin);

    let endDate = startDate;
    let endTime = addOneHour(startTime);
    if (endTime < startTime) endDate = addDayStr(startDate); // wrapped past midnight
    if (r.end) {
      endDate = toDateStr(r.end.date());
      endTime = padHHMM(r.end.get('hour') ?? startH + 1, r.end.get('minute') ?? 0);
    }

    const linesBefore = text.slice(0, r.index).split('\n');
    const precedingText = linesBefore[linesBefore.length - 1] ?? '';
    const label = extractLabel(precedingText) || r.text;

    const confidence = r.start.isCertain('hour') ? 'medium' : 'low';
    nlResults.push({ label, startDate, startTime, endDate, endTime, confidence });
  }

  return nlResults;
}
