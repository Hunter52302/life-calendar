import * as chrono from 'chrono-node';

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

function timeToSlot(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 2 + (m >= 30 ? 1 : 0);
}

/**
 * Build per-day slot segments from a date+time range.
 * Returns [{ date, slotStart, slotDuration }]
 */
export function buildSegments(startDate, startTime, endDate, endTime) {
  const startDt = new Date(`${startDate}T${startTime}:00`);
  const endDt   = new Date(`${endDate}T${endTime}:00`);

  if (endDt <= startDt) {
    return [{ date: startDate, slotStart: timeToSlot(startTime), slotDuration: 1 }];
  }
  if (startDate === endDate) {
    const s = timeToSlot(startTime);
    const e = timeToSlot(endTime);
    return [{ date: startDate, slotStart: s, slotDuration: Math.max(1, e - s) }];
  }

  const segments = [];
  const s = timeToSlot(startTime);
  if (48 - s > 0) segments.push({ date: startDate, slotStart: s, slotDuration: 48 - s });

  let cur = addDayStr(startDate);
  while (cur < endDate) {
    segments.push({ date: cur, slotStart: 0, slotDuration: 48 });
    cur = addDayStr(cur);
  }

  const e = timeToSlot(endTime);
  if (e > 0) segments.push({ date: endDate, slotStart: 0, slotDuration: e });
  return segments;
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
  const chronoMatches = chrono.parse(rawText, referenceDate, { forwardDate: true });

  for (const r of chronoMatches) {
    const startDate = toDateStr(r.start.date());
    const startH    = r.start.get('hour') ?? 9;
    const startMin  = r.start.get('minute') ?? 0;
    const startTime = padHHMM(startH, startMin);

    let endDate = startDate;
    let endTime = addOneHour(startTime);
    if (r.end) {
      endDate = toDateStr(r.end.date());
      endTime = padHHMM(r.end.get('hour') ?? startH + 1, r.end.get('minute') ?? 0);
    }

    const linesBefore = rawText.slice(0, r.index).split('\n');
    const precedingText = linesBefore[linesBefore.length - 1] ?? '';
    const label = precedingText
      .replace(/\b(for|at|on|from|about|regarding|re:|hi\s+\w+[\s,]+we(?:'re|are)?\s+\w+)\b.*$/i, '')
      .trim() || r.text;

    const confidence = r.start.isCertain('hour') ? 'medium' : 'low';
    nlResults.push({ label, startDate, startTime, endDate, endTime, confidence });
  }

  return nlResults;
}
