import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMapUrl, isLikelyUrl } from './handoffActions.js';

test('Apple Maps URL uses daddr only', () => {
  const url = buildMapUrl('apple', '123 Main St');
  assert.equal(url, 'https://maps.apple.com/?daddr=123%20Main%20St&dirflg=d');
  assert.ok(!url.includes('saddr='));
});

test('Google Maps URL uses api=1 and destination only', () => {
  const url = buildMapUrl('google', '123 Main St');
  assert.equal(url, 'https://www.google.com/maps/dir/?api=1&destination=123%20Main%20St&travelmode=driving');
  assert.ok(!url.includes('origin='));
});

test('Waze URL uses q and navigate=yes', () => {
  assert.equal(buildMapUrl('waze', '123 Main St'), 'https://waze.com/ul?q=123%20Main%20St&navigate=yes');
});

test('No map URL includes origin or home address', () => {
  const home = '987 Home Ave';
  for (const provider of ['apple', 'google', 'waze']) {
    const url = buildMapUrl(provider, '123 Main St');
    assert.ok(!url.includes(encodeURIComponent(home)));
    assert.ok(!url.toLowerCase().includes('origin'));
    assert.ok(!url.toLowerCase().includes('saddr'));
  }
});

test('Empty destination returns empty string', () => {
  assert.equal(buildMapUrl('google', ''), '');
  assert.equal(buildMapUrl('google', '   '), '');
});

test('HTTP and HTTPS meeting links pass validation', () => {
  assert.equal(isLikelyUrl('https://zoom.us/j/123'), true);
  assert.equal(isLikelyUrl('http://example.com/meet'), true);
});

test('javascript URLs fail validation', () => {
  assert.equal(isLikelyUrl('javascript:alert(1)'), false);
});
