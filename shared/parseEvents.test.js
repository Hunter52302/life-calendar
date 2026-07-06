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

// ── Recurrence detection ──────────────────────────────────────────────────────

test('"every Monday" is detected as a weekly recurrence', () => {
  const e = one('standup every Monday at 9am');
  assert.equal(e.recurrence, 'weekly');
  assert.equal(e.label, 'standup');
  assert.equal(e.startTime, '09:00');
});

test('"every day" is detected as a daily recurrence', () => {
  const e = one('gym every day at 6pm');
  assert.equal(e.recurrence, 'daily');
  assert.equal(e.label, 'gym');
});

test('"weekly" is detected and stripped from the label', () => {
  const e = one('team lunch weekly on Friday at noon');
  assert.equal(e.recurrence, 'weekly');
  assert.equal(e.label, 'team lunch');
});

test('"every other week" is detected as biweekly', () => {
  const e = one('checkin every other week on Tuesday at 3pm');
  assert.equal(e.recurrence, 'biweekly');
  assert.equal(e.label, 'checkin');
});

test('"monthly" is detected on an all-day event', () => {
  const e = one('rent June 1 monthly');
  assert.equal(e.recurrence, 'monthly');
  assert.equal(e.allDay, true);
  assert.equal(e.label, 'rent');
});

test('"every year" is detected as yearly', () => {
  const e = one('anniversary June 5 every year');
  assert.equal(e.recurrence, 'yearly');
  assert.equal(e.label, 'anniversary');
});

test('"every weekday" is NOT treated as a recurrence (unsupported cadence)', () => {
  const e = one('yoga every weekday at 7am');
  assert.equal('recurrence' in e, false);
  assert.equal(e.label, 'yoga');
});

test('a one-off event carries no recurrence field', () => {
  const e = one('dentist June 20 at 3pm');
  assert.equal('recurrence' in e, false);
});

// ── Location & attendee extraction ────────────────────────────────────────────

test('"with Sarah and Tom" is extracted as two attendees', () => {
  const e = one('lunch with Sarah and Tom on Friday at noon');
  assert.equal(e.label, 'lunch');
  assert.deepEqual(e.people, [
    { displayName: 'Sarah', source: 'paste' },
    { displayName: 'Tom', source: 'paste' },
  ]);
});

test('a leading "at <Place>" clause becomes the location', () => {
  const e = one('dinner at Nobu on June 20 at 7pm');
  assert.equal(e.label, 'dinner');
  assert.equal(e.location, 'Nobu');
});

test('trailing location after the time is captured', () => {
  const e = one('coffee with Alex tomorrow at 10am at Blue Bottle');
  assert.equal(e.label, 'coffee');
  assert.equal(e.location, 'Blue Bottle');
  assert.deepEqual(e.people, [{ displayName: 'Alex', source: 'paste' }]);
});

test('"in Room 302" is captured as a location', () => {
  const e = one('meeting in Room 302 on June 21 at 2pm');
  assert.equal(e.location, 'Room 302');
});

test('a lowercase "with the team" is not turned into an attendee', () => {
  const e = one('standup with the team at 9am');
  assert.equal('people' in e, false);
});

test('a capitalized time word is not mistaken for a location', () => {
  const e = one('review at Noon on June 22');
  assert.equal('location' in e, false);
});

test('a subject name without "with" stays in the label', () => {
  const e = one('call Bob at 3pm');
  assert.equal(e.label, 'call Bob');
  assert.equal('people' in e, false);
});

test('a plain event has neither location nor people', () => {
  const e = one('dentist June 20 at 3pm');
  assert.equal('location' in e, false);
  assert.equal('people' in e, false);
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
