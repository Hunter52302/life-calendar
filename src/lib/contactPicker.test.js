import test from 'node:test';
import assert from 'node:assert/strict';
import { contactPickerSupported, normalizeContact } from './contactPicker.js';

test('contactPickerSupported is false without a Contact Picker API (e.g. node/iOS/desktop)', () => {
  assert.equal(contactPickerSupported(), false);
});

test('normalizeContact picks the first non-empty value of each field', () => {
  const c = normalizeContact({ name: ['', 'Sarah Lee'], tel: ['+15551234'], email: ['s@x.com'] });
  assert.deepEqual(c, { displayName: 'Sarah Lee', phone: '+15551234', email: 's@x.com', source: 'picker' });
});

test('normalizeContact omits absent phone/email and falls back for the name', () => {
  assert.deepEqual(normalizeContact({ name: [], tel: ['+1555'], email: [] }),
    { displayName: '+1555', phone: '+1555', source: 'picker' });
});

test('normalizeContact returns null for an empty contact', () => {
  assert.equal(normalizeContact({ name: [], tel: [], email: [] }), null);
  assert.equal(normalizeContact(null), null);
});
