import * as chrono from 'chrono-node';

// Matches lines containing a time range in military (HHMM) format
// e.g. "Thursday June 18: 3B 2300 – 0700"
//      "2A 1400 – 2200"
const SHIFT_RE = /^(.*?)\s+(\d{4})\s*[–\-—]+\s*(\d{4})/;

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

function addOneHour(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return padHHMM((h + 1) % 24, m);
}

/**
 * Parse raw text into an array of event candidates.
 *
 * Pass 1: structured shift-schedule lines (HHMM – HHMM per line).
 * Pass 2: natural language via chrono-node (forwardDate=true).
 *
 * @param {string} rawText
 * @param {Date} [referenceDate]
 * @returns {{ label, startDate, startTime, endDate, endTime, confidence }[]}
 */
export function parseEvents(rawText, referenceDate = new Date()) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

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

    shiftResults.push({ label, startDate, startTime, endDate, endTime, confidence: 'high' });
  }

  if (shiftResults.length > 0) return shiftResults;

  // ── Pass 2: natural language fallback ──────────────────────────────────────
  const nlResults = [];
  const chronoMatches = chrono.parse(rawText, referenceDate, { forwardDate: true });

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

    // Extract label: text on the same line, before the matched date text
    const linesBefore = rawText.slice(0, r.index).split('\n');
    const precedingText = linesBefore[linesBefore.length - 1] ?? '';
    // Strip filler words at the end of the preceding text
    const label = precedingText
      .replace(/\b(for|at|on|from|about|regarding|re:|hi\s+\w+[\s,]+we(?:'re|are)?\s+\w+)\b.*$/i, '')
      .trim() || r.text;

    const confidence = r.start.isCertain('hour') ? 'medium' : 'low';
    nlResults.push({ label, startDate, startTime, endDate, endTime, confidence });
  }

  return nlResults;
}
