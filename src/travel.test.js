import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTimeline, suggestVisit, validDate, buildStory } from './travel.js';

const modern = { semanticSegments: [
  { startTime: '2026-05-20T00:30:00+02:00', endTime: '2026-05-20T01:30:00+02:00', visit: { topCandidate: { placeLocation: { latLng: '38.7130°, -9.1300°' } } } },
  { startTime: '2026-05-20T10:00:00+02:00', endTime: '2026-05-20T12:00:00+02:00', visit: { topCandidate: { placeName: 'The café', placeLocation: 'geo:38.72,-9.14' } } },
  { startTime: '2026-05-20T13:00:00+02:00', activity: {} }
] };
test('modern visits keep the recorded local day and parse both coordinate shapes', () => {
  const visits = parseTimeline(modern);
  assert.equal(visits.length, 2); assert.equal(visits[0].date, '2026-05-20');
  assert.equal(visits[0].startTime, '2026-05-19T22:30:00.000Z');
  assert.equal(visits[0].lat, 38.713); assert.equal(visits[1].place, 'The café');
});
test('legacy exports parse E7 coordinates, timestamps and duplicate visits', () => {
  const visit = { placeVisit: { location: { name: 'Alfama', latitudeE7: 387130000, longitudeE7: -91300000 }, duration: { startTimestampMs: '1779271200000', endTimestampMs: '1779274800000' } } };
  const visits = parseTimeline({ timelineObjects: [visit, visit] });
  assert.equal(visits.length, 1); assert.equal(visits[0].place, 'Alfama'); assert.equal(visits[0].lng, -9.13);
});
test('raw points and exports without valid visits fail usefully', () => {
  assert.throws(() => parseTimeline({ locations: [] }), /Raw location/);
  assert.throws(() => parseTimeline({ semanticSegments: [{ visit: {} }] }), /No dated place visits/);
});
test('date plus GPS matches nearby visits and rejects conflicting dates', () => {
  const visits = parseTimeline(modern);
  const photo = { metadata: { date: '2026-05-20', lat: 38.713, lng: -9.13 } };
  assert.equal(suggestVisit(photo, visits).visitId, visits[0].id);
  assert.equal(suggestVisit({ metadata: { ...photo.metadata, date: '2026-05-21' } }, visits).visitId, '');
});
test('ambiguous, far away or metadata-free photos require manual matching', () => {
  const visits = parseTimeline(modern);
  assert.equal(suggestVisit({ metadata: { date: '2026-05-20' } }, visits).visitId, '');
  assert.equal(suggestVisit({ metadata: {} }, visits).visitId, '');
  assert.equal(suggestVisit({ metadata: { date: '2026-05-20', lat: 50, lng: 50 } }, visits).visitId, '');
  const duplicatePlace = { ...visits[0], id: 'another-visit' };
  assert.equal(suggestVisit({ metadata: { date: '2026-05-20', lat: 38.713, lng: -9.13 } }, [visits[0], duplicatePlace]).visitId, '');
});
test('offset timestamps distinguish repeat visits at the same place', () => {
  const visits = parseTimeline(modern);
  const later = { ...visits[0], id: 'later', startTime: '2026-05-20T08:00:00.000Z', endTime: '2026-05-20T10:00:00.000Z' };
  assert.equal(suggestVisit({ metadata: { date: '2026-05-20', lat: 38.713, lng: -9.13, instant: '2026-05-20T09:00:00.000Z' } }, [visits[0], later]).visitId, 'later');
});
test('invalid calendar dates are rejected', () => {
  assert.equal(validDate('2026-02-30'), false); assert.equal(validDate('2024-02-29'), true);
});
test('story uses only the route, captions and supplied feelings', () => {
  const visits = parseTimeline(modern); visits[0].place = 'Alfama'; visits[0].photos = [{ caption: 'Coffee with my sister' }];
  const text = buildStory(visits, { mood: 'relaxed', highlight: 'The pastry shop', detail: 'We heard live music' });
  assert.match(text, /Alfama/); assert.match(text, /relaxed/); assert.match(text, /Coffee with my sister/); assert.match(text, /live music/);
  assert.doesNotMatch(buildStory(visits, {}), /felt|happy|excited|smil/);
});
