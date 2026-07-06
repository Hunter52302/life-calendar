import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEvents } from './parseEvents.js';

// Fixed reference so relative phrases ("tomorrow", "next Friday") are
// deterministic. Mon 2026-06-01, noon local time.
const REF = new Date('2026-06-01T12:00:00');
const parse = (text) => parseEvents(text, REF);
const one = (text) => {
  const r = parse(text);
  assert.equal(r.length, 1, `expected exactly one event from: ${JSON.stringify(text)}, got ${r.length}`);
  return r[0];
};

// ── Pass 1: structured HHMM shift schedules ───────────────────────────────────

test('single shift line: date, label, military times', () => {
  const e = one('Thursday June 18: 3B 2300 – 0700');
  assert.equal(e.label, '3B');
  assert.equal(e.startDate, '2026-06-18');
  assert.equal(e.startTime, '23:00');
  assert.equal(e.endTime, '07:00');
  assert.equal(e.confidence, 'high');
});

test('shift crossing midnight rolls the end date forward', () => {
  const e = one('Thursday June 18: 3B 2300 – 0700');
  assert.equal(e.endDate, '2026-06-19');
});

test('shift within the same day keeps one date', () => {
  const e = one('Friday June 19: 2A 1400 – 2200');
  assert.equal(e.startDate, '2026-06-19');
  assert.equal(e.endDate, '2026-06-19');
  assert.equal(e.startTime, '14:00');
  assert.equal(e.endTime, '22:00');
});

test('multiple shift lines parse into multiple events', () => {
  const r = parse('Thursday June 18: 3B 2300 – 0700\nFriday June 19: 2A 1400 – 2200');
  assert.equal(r.length, 2);
  assert.equal(r[0].label, '3B');
  assert.equal(r[1].label, '2A');
});

test('shift lines take priority over natural-language parsing', () => {
  // A line matching the shift format should never also produce an NL event.
  const r = parse('June 18: Night 2300 – 0700');
  assert.equal(r.length, 1);
  assert.equal(r[0].confidence, 'high');
});

// ── Pass 2: explicit date + time ranges ───────────────────────────────────────

test('explicit time range is high confidence with both endpoints', () => {
  const e = one('team meeting on June 19th from 8 am to 9 pm');
  assert.equal(e.startDate, '2026-06-19');
  assert.equal(e.startTime, '08:00');
  assert.equal(e.endTime, '21:00');
  assert.equal(e.allDay, false);
  assert.equal(e.confidence, 'high');
});

test('single time with no end defaults to a one-hour block', () => {
  const e = one('dentist June 20 at 3pm');
  assert.equal(e.startDate, '2026-06-20');
  assert.equal(e.startTime, '15:00');
  assert.equal(e.endTime, '16:00');
  assert.equal(e.confidence, 'medium');
});

// ── Duration phrases ──────────────────────────────────────────────────────────

test('"for 2 hours" sets the end two hours out', () => {
  const e = one('call June 20 at 3pm for 2 hours');
  assert.equal(e.startTime, '15:00');
  assert.equal(e.endTime, '17:00');
});

test('"for 90 minutes" is honoured', () => {
  const e = one('call June 20 at 3pm for 90 minutes');
  assert.equal(e.endTime, '16:30');
});

test('compact duration "45m" is honoured', () => {
  const e = one('standup June 20 at 9am 45m');
  assert.equal(e.endTime, '09:45');
});

test('fractional hours "1.5h" is honoured', () => {
  const e = one('workshop June 20 at 10am for 1.5h');
  assert.equal(e.endTime, '11:30');
});

test('duration pushing past midnight rolls the end date', () => {
  const e = one('shift June 20 at 11pm for 3 hours');
  assert.equal(e.startDate, '2026-06-20');
  assert.equal(e.endDate, '2026-06-21');
  assert.equal(e.endTime, '02:00');
});

test('an explicit end time wins over a stray duration-looking token', () => {
  const e = one('meeting June 20 from 1pm to 2pm');
  assert.equal(e.endTime, '14:00');
});

// ── All-day / date-only events ────────────────────────────────────────────────

test('a date with no time becomes an all-day event', () => {
  const e = one('Sarah birthday on June 21');
  assert.equal(e.startDate, '2026-06-21');
  assert.equal(e.allDay, true);
  assert.equal(e.startTime, '00:00');
  assert.equal(e.endTime, '23:59');
  assert.equal(e.confidence, 'medium');
});

test('a date-only range spans multiple all-day days', () => {
  const e = one('vacation June 22 to June 26');
  assert.equal(e.allDay, true);
  assert.equal(e.startDate, '2026-06-22');
  assert.equal(e.endDate, '2026-06-26');
});

// ── Label extraction / filler stripping ───────────────────────────────────────

test('leading "about" filler is stripped from the label', () => {
  const e = one('told me about thanksgiving dinner on June 25 at 6pm');
  assert.equal(e.label, 'thanksgiving dinner');
});

test('duration phrase is not left dangling in the label', () => {
  const e = one('lunch for 2 hours June 20 at noon');
  assert.equal(e.label, 'lunch');
  assert.equal(e.endTime, '14:00');
});

// ── Ordinal-of-month rewriting ────────────────────────────────────────────────

test('"the 24th of December" parses as a single dated event', () => {
  const e = one('party the 24th of December at 8pm');
  assert.equal(e.startDate, '2026-12-24');
  assert.equal(e.startTime, '20:00');
});

// ── Meeting URL detection ─────────────────────────────────────────────────────

test('a meeting URL in the text is attached to the event', () => {
  const e = one('sync June 20 at 2pm https://example.com/room/abc');
  assert.equal(e.meeting_url, 'https://example.com/room/abc');
});

test('no URL means no meeting_url field', () => {
  const e = one('sync June 20 at 2pm');
  assert.equal('meeting_url' in e, false);
});

// ── Empty / no-match input ────────────────────────────────────────────────────

test('text with no dates yields no events', () => {
  assert.deepEqual(parse('just some notes with no date at all'), []);
});
