const base = 'https://places.googleapis.com/v1';
const fields = 'id,displayName,formattedAddress,location,googleMapsUri';
const detailFields = `${fields},rating,userRatingCount,photos,reviews,attributions`;
export function checkPlaceId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{5,200}$/.test(id)) throw new Error('Invalid Google place ID.');
  return id;
}
export function createPlacesClient(key, fetcher = fetch) {
  async function request(path, mask, body) {
    if (!key) { const error = new Error('Google lookup is not configured. Add GOOGLE_MAPS_API_KEY to .env.local and enable Places API (New) with billing, then restart the app.'); error.status = 503; throw error; }
    const response = await fetcher(`${base}/${path}`, {
      method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, ...(mask ? { 'X-Goog-FieldMask': mask } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      const error = new Error(response.status === 403 ? 'Google denied access. Check API restrictions, Places API (New), and billing.' : response.status === 429 ? 'Google request quota was reached. Try again later.' : 'Google could not return this place. Check the place ID or try again.');
      error.status = response.status === 404 ? 404 : 502; throw error;
    }
    return response.json();
  }
  return {
    async resolve({ placeId, lat, lng }) {
      if (placeId) return { candidates: [await request(`places/${checkPlaceId(placeId)}`, fields)], exactId: true };
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('A valid Timeline coordinate or Google place ID is needed.');
      return { candidates: (await request('places:searchNearby', fields.split(',').map(f => `places.${f}`).join(','), { maxResultCount: 5, rankPreference: 'DISTANCE', locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 100 } } })).places || [], exactId: false };
    },
    async details(placeId) { return request(`places/${checkPlaceId(placeId)}`, detailFields); },
    async photo(placeId, index) {
      const id = checkPlaceId(placeId);
      if (!Number.isInteger(index) || index < 0 || index > 9) throw new Error('Invalid photo selection.');
      // Photo names expire and must not be persisted. Get a current reference for every image.
      const place = await request(`places/${id}`, 'photos');
      const photo = place.photos?.[index];
      if (!photo?.name || !photo.name.startsWith(`places/${id}/photos/`) || !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(photo.name)) throw new Error('This place has no photo at that position.');
      return request(`${photo.name}/media?maxWidthPx=900&skipHttpRedirect=true`, '');
    }
  };
}
export function googlePlacesPlugin(key) {
  function install(server) {
    const client = createPlacesClient(key);
    server.middlewares.use('/api/google', async (req, res) => {
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json');
      const send = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)); };
      if (req.method !== 'POST') return send(405, { error: 'Use POST.' });
      // This local API must not become a credentialed public proxy for other sites.
      if (req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Cross-site requests are not allowed.' });
      if (req.headers.origin) {
        try { if (new URL(req.headers.origin).host !== req.headers.host) return send(403, { error: 'Cross-origin requests are not allowed.' }); }
        catch { return send(403, { error: 'Invalid request origin.' }); }
      }
      let raw = '';
      try {
        for await (const chunk of req) { raw += chunk; if (raw.length > 4096) { const error = new Error('Request is too large.'); error.status = 413; throw error; } }
        const body = JSON.parse(raw);
        const path = req.url.split('?')[0];
        if (path === '/resolve') return send(200, await client.resolve(body));
        if (path === '/details') return send(200, await client.details(body.placeId));
        if (path === '/photo') return send(200, await client.photo(body.placeId, body.index));
        return send(404, { error: 'Unknown endpoint.' });
      } catch (error) { return send(error.status || (error.name === 'TimeoutError' ? 504 : 400), { error: error.name === 'TimeoutError' ? 'Google lookup timed out. Try again.' : error.message }); }
    });
  }
  return { name: 'roam-google-places', configureServer: install, configurePreviewServer: install };
}
