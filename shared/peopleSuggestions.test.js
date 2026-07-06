import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPeopleSuggestions, enrichPeople } from './peopleSuggestions.js';

test('buildPeopleSuggestions collapses people by case-insensitive name', () => {
  const events = [
    { updatedAt: 1, people: [{ displayName: 'Sarah', phone: '111' }] },
    { updatedAt: 2, people: [{ displayName: 'sarah', email: 's@x.com' }] },
  ];
  const s = buildPeopleSuggestions(events);
  assert.equal(s.length, 1);
  assert.equal(s[0].displayName, 'sarah'); // most recent casing
  assert.equal(s[0].email, 's@x.com');
  assert.equal(s[0].phone, '111');         // filled from the older event
});

test('buildPeopleSuggestions prefers the most recent non-empty value', () => {
  const events = [
    { updatedAt: 5, people: [{ displayName: 'Alex', phone: 'new' }] },
    { updatedAt: 1, people: [{ displayName: 'Alex', phone: 'old' }] },
  ];
  assert.equal(buildPeopleSuggestions(events)[0].phone, 'new');
});

test('buildPeopleSuggestions ignores deleted/ghost events and empty people', () => {
  const events = [
    { updatedAt: 3, deleted: true, people: [{ displayName: 'Ghost', phone: '999' }] },
    { updatedAt: 4, _isGhost: true, people: [{ displayName: 'Ghost2', phone: '999' }] },
    { updatedAt: 5, people: [] },
    { updatedAt: 6, people: [{ displayName: '  ' }] },
  ];
  assert.deepEqual(buildPeopleSuggestions(events), []);
});

test('enrichPeople fills phone/email from history and flags the link', () => {
  const suggestions = [{ displayName: 'Dad', phone: '555', email: '' }];
  const [dad] = enrichPeople([{ displayName: 'dad', source: 'paste' }], suggestions);
  assert.equal(dad.phone, '555');
  assert.equal(dad.linkedFromHistory, true);
  assert.equal(dad.displayName, 'dad'); // parsed casing preserved
});

test('enrichPeople never overwrites an explicit value on the attendee', () => {
  const suggestions = [{ displayName: 'Sam', phone: 'history', email: 'h@x.com' }];
  const [sam] = enrichPeople([{ displayName: 'Sam', phone: 'explicit' }], suggestions);
  assert.equal(sam.phone, 'explicit');
  assert.equal(sam.email, 'h@x.com');       // still filled the missing one
  assert.equal(sam.linkedFromHistory, undefined); // had its own data
});

test('enrichPeople leaves unmatched attendees untouched', () => {
  const out = enrichPeople([{ displayName: 'Nobody', source: 'paste' }], [{ displayName: 'Someone', phone: '1' }]);
  assert.deepEqual(out, [{ displayName: 'Nobody', source: 'paste' }]);
});

test('enrichPeople is a no-op with no people or no suggestions', () => {
  assert.deepEqual(enrichPeople([], [{ displayName: 'X', phone: '1' }]), []);
  const same = [{ displayName: 'X', source: 'paste' }];
  assert.equal(enrichPeople(same, []), same);
});
