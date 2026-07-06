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

test('a lowercase relationship word ("with dad") becomes a title-cased attendee', () => {
  const e = one("Sarah's birthday party with dad on September 9th at 3pm");
  assert.equal(e.label, "Sarah's birthday party");
  assert.equal(e.startTime, '15:00');
  assert.deepEqual(e.people, [{ displayName: 'Dad', source: 'paste' }]);
});

test('a hyphenated relationship word with a possessive is captured whole', () => {
  const e = one('dinner with my mother-in-law on Aug 3 at 6pm');
  assert.equal(e.label, 'dinner');
  assert.deepEqual(e.people, [{ displayName: 'Mother-in-law', source: 'paste' }]);
});

test('a mix of a name and a possessive relationship word both resolve', () => {
  const e = one('lunch with my mom and dad on Friday at noon');
  assert.deepEqual(e.people.map(p => p.displayName), ['Mom', 'Dad']);
});

// ── Abbreviations in names / pasted lists ─────────────────────────────────────

test('an abbreviation ("Jr.") does not truncate the label at a false sentence break', () => {
  const e = one('Martin Luther King Jr. Day - January 19, 2026');
  assert.equal(e.label, 'Martin Luther King Jr. Day');
  assert.equal(e.startDate, '2026-01-19');
  assert.equal(e.allDay, true);
});

test('a pasted "Name - Date" holiday list keeps each holiday name', () => {
  const list = `New Year's Day - January 1, 2026
Memorial Day - May 25, 2026
Juneteenth - June 19, 2026
Independence Day - July 4, 2026
Thanksgiving - November 26, 2026
Christmas Day - December 25, 2026`;
  const r = parse(list);
  assert.equal(r.length, 6);
  assert.deepEqual(r.map(e => e.label), [
    "New Year's Day", 'Memorial Day', 'Juneteenth',
    'Independence Day', 'Thanksgiving', 'Christmas Day',
  ]);
  assert.equal(r.every(e => e.allDay), true);
});

// ── Nth-weekday-of-month + vertical lists ─────────────────────────────────────
const JAN = new Date('2026-01-01T12:00:00');

test('nth-weekday: "Third Monday in January" resolves to the concrete date', () => {
  const [e] = parseEvents('MLK Day Third Monday in January', JAN);
  assert.equal(e.startDate, '2026-01-19');
  assert.equal(e.allDay, true);
  assert.equal(e.label, 'MLK Day');
});

test('nth-weekday: "Last Monday in May"', () => {
  assert.equal(parseEvents('Memorial Last Monday in May', JAN)[0].startDate, '2026-05-25');
});

test('nth-weekday: "Fourth Thursday in November"', () => {
  assert.equal(parseEvents('Thanksgiving Fourth Thursday in November', JAN)[0].startDate, '2026-11-26');
});

test('vertical list: the label comes from the preceding non-blank line', () => {
  const [e] = parseEvents('Christmas Day\n\t\n\nDecember 25', JAN);
  assert.equal(e.label, 'Christmas Day');
  assert.equal(e.startDate, '2026-12-25');
  assert.equal(e.allDay, true);
});

test('vertical list: preceding line + nth-weekday date on its own line', () => {
  const [e] = parseEvents('Thanksgiving Day\n\t\n\nFourth Thursday in November', JAN);
  assert.equal(e.label, 'Thanksgiving Day');
  assert.equal(e.startDate, '2026-11-26');
});

test('vertical list: an "Also known as X" subtitle line resolves to X', () => {
  const [e] = parseEvents("Washington's Birthday\n\nAlso known as Presidents Day\n\nThird Monday in February", JAN);
  assert.equal(e.label, 'Presidents Day');
  assert.equal(e.startDate, '2026-02-16');
});

test('a vertically-listed holiday table extracts each name and date, no phantoms', () => {
  const text = `New Year's Day
\t
January 1

Memorial Day
\t
Last Monday in May

Inauguration Day
\t
January 20, every 4 years following a presidential election

Thanksgiving Day
\t
Fourth Thursday in November`;
  const r = parseEvents(text, JAN);
  assert.deepEqual(r.map(e => e.label), ["New Year's Day", 'Memorial Day', 'Inauguration Day', 'Thanksgiving Day']);
  assert.deepEqual(r.map(e => e.startDate), ['2026-01-01', '2026-05-25', '2026-01-20', '2026-11-26']);
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

// ── Multi-paragraph prose (business email / conversation) ─────────────────────
// These lock in how the parser degrades on messy, multi-sentence text: it must
// find the real events without runaway labels, phantom date-mentions, or
// details bleeding across sentences. Structural fields are asserted exactly;
// labels are asserted by their core noun so future label polish won't break them.

const EMAIL_A = `Hi team,

Thanks for the productive call earlier this week. As discussed, I'd like to lock in a few dates. Let's hold the Q3 planning workshop with Priya and Marcus on June 18 from 9am to 12pm at the Downtown Office. Please review the draft deck beforehand.

We should also schedule the vendor demo next Tuesday at 2pm — it should run about 90 minutes. I've asked their team to send a calendar link.

Finally, don't forget the all-hands is on June 30, and payroll runs monthly on the 1st. Let me know if any of these conflict.

Best, Dana`;

test('business email extracts exactly the three real events (no phantoms)', () => {
  assert.equal(parse(EMAIL_A).length, 3);
});

test('business email: workshop keeps a tight label, range, location and attendees', () => {
  const e = parse(EMAIL_A)[0];
  assert.match(e.label, /Q3 planning workshop/);
  assert.equal(e.label.length < 40, true); // not a runaway paragraph
  assert.equal(e.startDate, '2026-06-18');
  assert.equal(e.startTime, '09:00');
  assert.equal(e.endTime, '12:00');
  assert.equal(e.confidence, 'high');
  assert.equal(e.location, 'the Downtown Office');
  assert.deepEqual(e.people.map(p => p.displayName), ['Priya', 'Marcus']);
});

test('business email: "about 90 minutes" sets duration, not a phantom event', () => {
  const demo = parse(EMAIL_A)[1];
  assert.match(demo.label, /vendor demo/);
  assert.equal(demo.startTime, '14:00');
  assert.equal(demo.endTime, '15:30');
});

test('business email: "payroll runs monthly" is an all-day monthly recurrence', () => {
  const allHands = parse(EMAIL_A)[2];
  assert.match(allHands.label, /all-hands/);
  assert.equal(allHands.allDay, true);
  assert.equal(allHands.recurrence, 'monthly');
});

const CONVO = `hey! are we still on for coffee tomorrow at 10am?

yeah! let's do Blue Bottle. also my sister's birthday is June 21 btw

oh nice. and don't forget we have the dentist for the kids every Monday at 4pm starting next week

got it. i'll add the parent-teacher meeting too, that's Thursday June 25 at 6:30pm`;

test('text conversation extracts four events without "starting next week" phantom', () => {
  const r = parse(CONVO);
  assert.equal(r.length, 4);
  assert.match(r[0].label, /coffee/);
  assert.equal(r[0].startTime, '10:00');
  assert.match(r[1].label, /birthday/);
  assert.equal(r[1].allDay, true);
  assert.equal(r[2].recurrence, 'weekly');       // dentist every Monday
  assert.match(r[3].label, /parent-teacher meeting/);
  assert.equal(r[3].startTime, '18:30');
});

const EMAIL_B = `Team,

Following up from our sync: the client kickoff is confirmed for July 8 at 3pm in Conference Room B. Please bring the signed SOW.

I'd also like to schedule a retro with Jordan on Friday at 4pm for 45 minutes. And a reminder that the office is closed July 3 for the holiday.

We'll do sprint planning every other Wednesday at 10am going forward. Thanks!`;

test('email B: kickoff pulls location without swallowing the next sentence', () => {
  const e = parse(EMAIL_B)[0];
  assert.match(e.label, /client kickoff/);
  assert.equal(e.label.length < 40, true);
  assert.equal(e.startTime, '15:00');
  assert.equal(e.location, 'Conference Room B');
});

test('email B: an attendee does not bleed across a sentence boundary', () => {
  const r = parse(EMAIL_B);
  // "with Jordan" belongs to the retro, not the "office is closed" event.
  const retro = r[1];
  const officeClosed = r[2];
  assert.deepEqual(retro.people.map(p => p.displayName), ['Jordan']);
  assert.equal(retro.endTime, '16:45'); // 45-minute duration
  assert.equal('people' in officeClosed, false);
  assert.equal(officeClosed.allDay, true);
});

test('email B: "every other Wednesday" is detected as biweekly', () => {
  const sprint = parse(EMAIL_B)[3];
  assert.match(sprint.label, /sprint planning/);
  assert.equal(sprint.recurrence, 'biweekly');
});

// ── Empty / no-match input ────────────────────────────────────────────────────

test('text with no dates yields no events', () => {
  assert.deepEqual(parse('just some notes with no date at all'), []);
});
