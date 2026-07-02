function normalizeTitle(s) {
  return String(s ?? '').trim().replace(/\s+/g, ' ');
}

function sortStamp(e) {
  if (typeof e.updatedAt === 'number') return e.updatedAt;
  if (typeof e.updatedAt === 'string') return Date.parse(e.updatedAt) || 0;
  return 0;
}

export function buildEventTitleSuggestions(events = [], calendar = null) {
  const usable = events
    .filter(e => e && !e.deleted && !e._isGhost)
    .filter(e => normalizeTitle(e.label));

  usable.sort((a, b) => {
    const sameA = calendar && a.calendar === calendar ? 0 : 1;
    const sameB = calendar && b.calendar === calendar ? 0 : 1;
    if (sameA !== sameB) return sameA - sameB;
    return sortStamp(b) - sortStamp(a);
  });

  const seen = new Set();
  const out = [];

  for (const e of usable) {
    const label = normalizeTitle(e.label);
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }

  return out;
}
