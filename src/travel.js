// Imported dates keep their recorded local day; EXIF without an offset is camera-local time.
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(+date) && date.toISOString().slice(0, 10) === value;
}
export function coordinates(value) {
  if (typeof value === 'string') {
    const match = value.match(/(?:geo:)?\s*(-?\d+(?:\.\d+)?)°?\s*,\s*(-?\d+(?:\.\d+)?)°?/);
    if (match) return coordinates({ latitude: Number(match[1]), longitude: Number(match[2]) });
  }
  if (!value || typeof value !== 'object') return null;
  const lat = value.latitude ?? (value.latitudeE7 != null ? value.latitudeE7 / 1e7 : undefined);
  const lng = value.longitude ?? (value.longitudeE7 != null ? value.longitudeE7 / 1e7 : undefined);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
function timestamp(value) {
  if (value == null || value === '') return null;
  const date = new Date(/^\d{12,}$/.test(String(value)) ? Number(value) : value);
  return Number.isNaN(+date) ? null : date.toISOString();
}
export function parseTimeline(json) {
  const segments = Array.isArray(json) ? json : json.semanticSegments || json.timelineObjects;
  if (!Array.isArray(segments)) throw new Error('Upload a Google Timeline JSON export with semanticSegments or timelineObjects. Raw location-history points and ZIP archives are not supported.');
  const visits = [], seen = new Set();
  for (const segment of segments) {
    const visit = segment.visit || segment.placeVisit;
    if (!visit) continue;
    const location = visit.topCandidate?.placeLocation || visit.location;
    const point = coordinates(location?.latLng ?? location);
    const rawStart = segment.startTime || visit.duration?.startTimestamp || visit.duration?.startTimestampMs;
    const rawEnd = segment.endTime || visit.duration?.endTimestamp || visit.duration?.endTimestampMs;
    const startTime = timestamp(rawStart), endTime = timestamp(rawEnd);
    if (!startTime) continue;
    const recordedDate = typeof rawStart === 'string' && /^\d{4}-/.test(rawStart) ? rawStart.slice(0, 10) : startTime.slice(0, 10);
    if (!validDate(recordedDate)) continue;
    const label = visit.location?.name || visit.topCandidate?.placeName || visit.topCandidate?.name || visit.location?.address;
    const place = typeof label === 'string' && label.trim() ? label : point ? `Place at ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}` : 'Unnamed visit';
    const key = `${startTime}|${point?.lat}|${point?.lng}|${place}`;
    if (seen.has(key)) continue;
    seen.add(key);
    visits.push({ id: crypto.randomUUID(), date: recordedDate, place, lat: point?.lat ?? null, lng: point?.lng ?? null, startTime, endTime: endTime && endTime >= startTime ? endTime : null, note: '', photos: [], source: 'google-timeline', included: true });
  }
  if (!visits.length) throw new Error('No dated place visits were found. Export Timeline visits rather than raw location points.');
  return visits.sort((a, b) => a.startTime.localeCompare(b.startTime));
}
export function distanceKm(a, b) {
  const r = Math.PI / 180, dlat = (b.lat - a.lat) * r, dlng = (b.lng - a.lng) * r;
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dlng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function suggestVisit(photo, visits) {
  const meta = photo.metadata || {};
  let candidates = visits.filter(v => v.included !== false);
  if (meta.date) candidates = candidates.filter(v => v.date === meta.date);
  const hasGPS = Number.isFinite(meta.lat) && Number.isFinite(meta.lng);
  if (hasGPS) {
    candidates = candidates.filter(v => Number.isFinite(v.lat) && Number.isFinite(v.lng)).map(v => ({ ...v, distance: distanceKm(meta, v) })).filter(v => v.distance <= 1).sort((a, b) => a.distance - b.distance);
    if (candidates.length === 1 || (candidates.length > 1 && candidates[1].distance - candidates[0].distance > .2)) return { visitId: candidates[0].id, reason: meta.date ? 'Date and nearby GPS location' : 'Nearby GPS location; date missing — please confirm' };
  }
  if (meta.instant) {
    const during = candidates.filter(v => v.endTime && meta.instant >= v.startTime && meta.instant <= v.endTime);
    if (during.length === 1) return { visitId: during[0].id, reason: hasGPS ? 'Date, GPS and recorded visit time' : 'Recorded visit time; GPS missing — please confirm' };
  }
  if (meta.date && !hasGPS && candidates.length === 1) return { visitId: candidates[0].id, reason: 'Only visit on this date; GPS missing — please confirm' };
  return { visitId: '', reason: 'No unambiguous match — choose a place' };
}
export function buildStory(visits, answers) {
  const ordered = [...visits].sort((a, b) => (a.startTime || a.date).localeCompare(b.startTime || b.date));
  const places = [...new Set(ordered.map(v => v.place))];
  if (!places.length) return '';
  const route = places.length === 1 ? `I spent time in ${places[0]}.` : `My day took me from ${places.slice(0, -1).join(', ')} to ${places.at(-1)}.`;
  const captions = ordered.flatMap(v => v.photos || []).map(p => p.caption?.trim()).filter(Boolean);
  return [route, answers.company?.trim() ? `I shared the day with ${answers.company.trim()}.` : '', answers.mood?.trim() ? `In my own words, the day felt ${answers.mood.trim()}.` : '', answers.highlight?.trim() ? `The moment I want to keep: ${answers.highlight.trim()}` : '', captions.length ? `From my photo captions: ${captions.join(' · ')}` : '', answers.detail?.trim() ? `A detail the photos don't tell: ${answers.detail.trim()}` : ''].filter(Boolean).join('\n\n');
}
