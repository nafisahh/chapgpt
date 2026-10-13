import exifr from 'exifr';
import { validDate } from './travel.js';

function dateParts(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export async function readPhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Use JPG, PNG, WebP or GIF photos. Convert HEIC photos to JPG while keeping metadata.');
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is over 10 MB.`);
  let tags = {}, warning = '';
  try {
    tags = await exifr.parse(file, { reviveValues: false }) || {};
  } catch { warning = 'Metadata could not be read; assign this photo manually.'; }
  const raw = tags.DateTimeOriginal || tags.CreateDate;
  let date = null, localTime = null, instant = null;
  if (typeof raw === 'string') {
    const m = raw.match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (m) {
      date = `${m[1]}-${m[2]}-${m[3]}`;
      localTime = `${date}T${m[4]}:${m[5]}:${m[6]}`;
      const offset = tags.OffsetTimeOriginal || tags.OffsetTime;
      if (typeof offset === 'string' && /^[+-]\d{2}:\d{2}$/.test(offset)) {
        const value = new Date(localTime + offset); if (!Number.isNaN(+value)) instant = value.toISOString();
      }
    }
  } else if (raw instanceof Date && !Number.isNaN(+raw)) date = dateParts(raw);
  if (!validDate(date)) { date = null; localTime = null; instant = null; }
  const hasGPS = Number.isFinite(tags.latitude) && Number.isFinite(tags.longitude) && Math.abs(tags.latitude) <= 90 && Math.abs(tags.longitude) <= 180;
  const url = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error(`Could not read ${file.name}.`)); reader.readAsDataURL(file);
  });
  return { id: crypto.randomUUID(), name: file.name, url, metadata: { date, localTime, instant, lat: hasGPS ? tags.latitude : null, lng: hasGPS ? tags.longitude : null }, warning, caption: '' };
}

const cleanText = text => { const doc = new DOMParser().parseFromString(text || '', 'text/html'); return doc.body.textContent.trim(); };
export async function findDestinationPhotos(entry, signal) {
  if (!Number.isFinite(entry.lat) || !Number.isFinite(entry.lng)) throw new Error('Add map coordinates to this place first.');
  const params = new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'geosearch', ggscoord: `${entry.lat}|${entry.lng}`, ggsradius: '1000', ggsnamespace: '6', ggslimit: '12', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '700' });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal });
  if (!response.ok) throw new Error('Destination photos are unavailable. Try again later.');
  const result = await response.json();
  if (result.error) throw new Error('Destination photo search is unavailable.');
  return Object.values(result.query?.pages || {}).flatMap(page => {
    const info = page.imageinfo?.[0], meta = info?.extmetadata;
    if (!info || !meta || !meta.LicenseShortName?.value || !info.thumburl || !/\.(jpe?g|png|webp)$/i.test(new URL(info.url).pathname)) return [];
    const url = info.thumburl, sourceUrl = info.descriptionurl;
    if (!url.startsWith('https://upload.wikimedia.org/') || !sourceUrl?.startsWith('https://commons.wikimedia.org/')) return [];
    return [{ id: String(page.pageid), url, name: page.title.replace(/^File:/, ''), author: cleanText(meta.Artist?.value) || 'See source for author', license: cleanText(meta.LicenseShortName.value), sourceUrl, source: 'wikimedia-commons' }];
  });
}
