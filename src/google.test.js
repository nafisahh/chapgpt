import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photoVisitLabel, visitName } from './google.js';

test('photo dropdown uses resolved Google name ahead of coordinate placeholder', () => {
  const visit = { date: '2026-10-14', place: 'Place at 38.7130, -9.1300', googleLabel: 'Alfama café', startTime: '2026-10-14T08:00:00Z' };
  assert.equal(visitName(visit), 'Alfama café');
  assert.match(photoVisitLabel(visit), /^2026-10-14 · Alfama café · .* UTC$/);
  assert.doesNotMatch(photoVisitLabel(visit), /Place at/);
});
test('nearby suggestions and unresolvable places are distinguished', () => {
  assert.match(photoVisitLabel({ date: '2026-10-14', place: 'Original', googleLabel: 'Nearby café', googleSuggested: true }), /Nearby café \(nearby suggestion\)/);
  assert.equal(visitName({ place: 'My own location' }), 'My own location');
});
