import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEventTitleSuggestions } from './eventTitleSuggestions.js';

test('buildEventTitleSuggestions deduplicates case-insensitively', () => {
  const events = [
    { label: 'Work 2A', calendar: 'plan', updatedAt: 2 },
    { label: ' work 2a ', calendar: 'actual', updatedAt: 3 },
  ];

  assert.deepEqual(buildEventTitleSuggestions(events, 'plan'), ['Work 2A']);
});

test('buildEventTitleSuggestions ignores blank labels', () => {
  const events = [
    { label: '', calendar: 'plan', updatedAt: 4 },
    { label: '   ', calendar: 'plan', updatedAt: 5 },
    { label: 'Work', calendar: 'plan', updatedAt: 1 },
  ];

  assert.deepEqual(buildEventTitleSuggestions(events, 'plan'), ['Work']);
});

test('buildEventTitleSuggestions ignores deleted and ghost events', () => {
  const events = [
    { label: 'Deleted', calendar: 'plan', deleted: true, updatedAt: 5 },
    { label: 'Ghost', calendar: 'plan', _isGhost: true, updatedAt: 6 },
    { label: 'Kept', calendar: 'plan', updatedAt: 1 },
  ];

  assert.deepEqual(buildEventTitleSuggestions(events, 'plan'), ['Kept']);
});

test('buildEventTitleSuggestions prioritizes same calendar before other calendars', () => {
  const events = [
    { label: 'Live Only', calendar: 'actual', updatedAt: 999 },
    { label: 'Plan Only', calendar: 'plan', updatedAt: 1 },
  ];

  assert.deepEqual(buildEventTitleSuggestions(events, 'plan'), [
    'Plan Only',
    'Live Only',
  ]);
});

test('buildEventTitleSuggestions sorts recent updatedAt first within same calendar', () => {
  const events = [
    { label: 'Old Plan', calendar: 'plan', updatedAt: 1 },
    { label: 'New Plan', calendar: 'plan', updatedAt: 10 },
    { label: 'Middle Plan', calendar: 'plan', updatedAt: '2026-01-01T00:00:00.000Z' },
  ];

  assert.deepEqual(buildEventTitleSuggestions(events, 'plan'), [
    'Middle Plan',
    'New Plan',
    'Old Plan',
  ]);
});

test('buildEventTitleSuggestions returns normalized title text', () => {
  const events = [
    { label: ' Work   2A ', calendar: 'plan', updatedAt: 1 },
  ];

  assert.deepEqual(buildEventTitleSuggestions(events, 'plan'), ['Work 2A']);
});
