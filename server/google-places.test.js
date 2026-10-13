import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlacesClient, checkPlaceId } from './google-places.js';

test('missing key gives actionable setup error without an upstream request', async () => {
  await assert.rejects(createPlacesClient('', () => { throw new Error('Must not fetch'); }).resolve({ placeId: 'ChIJ_test' }), /GOOGLE_MAPS_API_KEY/);
});
test('exact Timeline IDs use Place Details and keep credentials server-side', async () => {
  const calls = [];
  const client = createPlacesClient('test-key', async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ id: 'ChIJ_test', displayName: { text: 'A real place' } }) }; });
  const result = await client.resolve({ placeId: 'ChIJ_test' });
  assert.equal(result.exactId, true); assert.equal(result.candidates[0].displayName.text, 'A real place');
  assert.equal(calls[0].url, 'https://places.googleapis.com/v1/places/ChIJ_test');
  assert.equal(calls[0].options.headers['X-Goog-Api-Key'], 'test-key');
  assert.ok(!calls[0].url.includes('test-key'));
});
test('coordinate fallback searches only a small area and returns choices', async () => {
  let request;
  const client = createPlacesClient('test-key', async (url, options) => { request = JSON.parse(options.body); return { ok: true, json: async () => ({ places: [{ id: 'ChIJ_first' }, { id: 'ChIJ_second' }] }) }; });
  const result = await client.resolve({ lat: 38.713, lng: -9.13 });
  assert.equal(result.exactId, false); assert.equal(result.candidates.length, 2); assert.equal(request.locationRestriction.circle.radius, 100);
  await assert.rejects(client.resolve({ lat: 100, lng: 5 }), /valid Timeline coordinate/);
});
test('photo references are freshly retrieved; arbitrary paths are rejected', async () => {
  const urls = [];
  const client = createPlacesClient('test-key', async url => { urls.push(url); return { ok: true, json: async () => url.endsWith('/places/ChIJ_test') ? { photos: [{ name: 'places/ChIJ_test/photos/fresh-reference' }] } : { photoUri: 'https://lh3.googleusercontent.com/photo' } }; });
  assert.equal((await client.photo('ChIJ_test', 0)).photoUri, 'https://lh3.googleusercontent.com/photo');
  assert.equal(urls.length, 2); assert.match(urls[1], /fresh-reference\/media/);
  assert.throws(() => checkPlaceId('../secret'), /Invalid/); await assert.rejects(client.photo('ChIJ_test', 99), /Invalid photo selection/);
});
test('Google billing or access denial is diagnosed without exposing provider response', async () => {
  const client = createPlacesClient('test-key', async () => ({ ok: false, status: 403 }));
  await assert.rejects(client.details('ChIJ_test'), /billing/);
});
