import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';
import ImportTravel from './ImportTravel.jsx';
import StoryDialog from './StoryDialog.jsx';
import DestinationPhotos from './DestinationPhotos.jsx';
import { readPhoto } from './photos.js';
import { validDate } from './travel.js';

const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open('roam-journal', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('journal');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
async function readJournal() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const request = db.transaction('journal').objectStore('journal').get('data');
    request.onsuccess = () => resolve(request.result || { trips: [], entries: [] });
    request.onerror = () => reject(request.error);
  });
}
async function writeJournal(data) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('journal', 'readwrite');
    tx.objectStore('journal').put(data, 'data');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Storage could not be updated.'));
  });
}
const formatDate = date => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
const today = () => new Date().toLocaleDateString('en-CA');

function MapView({ entries, selected, onSelect }) {
  const container = useRef(null), map = useRef(null), markers = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    map.current = L.map(container.current, { zoomControl: false }).setView([12, 8], 3);
    L.control.zoom({ position: 'bottomright' }).addTo(map.current);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19
    }).on('tileerror', () => setFailed(true)).addTo(map.current);
    markers.current = L.layerGroup().addTo(map.current);
    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); map.current.remove(); };
  }, []);
  useEffect(() => {
    markers.current.clearLayers();
    const points = entries.filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lng));
    for (const entry of points) {
      const marker = L.circleMarker([entry.lat, entry.lng], {
        radius: entry.id === selected ? 11 : 8, color: '#ffffff', weight: 3,
        fillColor: entry.id === selected ? '#d17b53' : '#38614e', fillOpacity: 1
      }).addTo(markers.current);
      const label = document.createElement('span'); label.textContent = entry.place;
      marker.bindTooltip(label).on('click', () => onSelect(entry.id));
    }
    if (points.length) map.current.fitBounds(points.map(e => [e.lat, e.lng]), { padding: [55, 55], maxZoom: 12 });
  }, [entries, selected, onSelect]);
  return <div className="map-wrap"><div ref={container} className="map" aria-label="Map of your memories"/>
    {failed && <p className="map-notice">Map tiles are unavailable. Your saved places are still here.</p>}
    {!entries.some(e => Number.isFinite(e.lat)) && <div className="map-hint">Add coordinates to a memory to pin it here.</div>}
  </div>;
}

function App() {
  const [data, setData] = useState(null), [tripId, setTripId] = useState('all');
  const [selected, setSelected] = useState(null), [view, setView] = useState('timeline');
  const [dialog, setDialog] = useState(null), [error, setError] = useState('');
  const [saving, setSaving] = useState(false), [lightbox, setLightbox] = useState(null);
  const importRef = useRef(null);
  const [editing, setEditing] = useState(null);
  useEffect(() => { readJournal().then(setData).catch(() => setError('Browser storage is unavailable. Try a browser with IndexedDB enabled.')); }, []);
  useEffect(() => {
    function escape(event) { if (event.key === 'Escape') { setDialog(null); setLightbox(null); } }
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, []);
  async function persist(next) { await writeJournal(next); setData(next); }
  const entries = (data?.entries || []).filter(e => tripId === 'all' || e.tripId === tripId).sort((a, b) => b.date.localeCompare(a.date));
  const active = entries.find(e => e.id === selected) || entries[0];
  const trip = data?.trips.find(t => t.id === tripId);
  async function save(event) {
    event.preventDefault(); setSaving(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      if (dialog === 'trip') {
        const newTrip = { id: crypto.randomUUID(), name: form.get('name').trim() };
        if (!newTrip.name) throw new Error('Enter a trip name.');
        await persist({ ...data, trips: [...data.trips, newTrip] }); setTripId(newTrip.id);
      } else {
        const files = form.getAll('photos').filter(f => f.size);
        if (files.length > 12 || files.some(f => f.size > 10 * 1024 * 1024)) throw new Error('Choose up to 12 photos, each under 10 MB.');
        if (files.some(f => !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type))) throw new Error('Use JPG, PNG, WebP, or GIF photos.');
        const uploaded = [];
        for (const file of files) uploaded.push(await readPhoto(file));
        const photos = [...(editing?.photos || []), ...uploaded];
        const latText = form.get('lat').trim(), lngText = form.get('lng').trim();
        if (Boolean(latText) !== Boolean(lngText)) throw new Error('Enter both latitude and longitude, or leave both blank.');
        const lat = latText ? Number(latText) : null, lng = lngText ? Number(lngText) : null;
        if (lat !== null && (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)) throw new Error('Enter valid map coordinates.');
        const entry = { ...(editing || {}), id: editing?.id || crypto.randomUUID(), tripId: form.get('trip'), date: form.get('date'), place: form.get('place').trim(), note: form.get('note').trim(), lat, lng, photos };
        if (!entry.place) throw new Error('Enter a place name.');
        if (!validDate(entry.date)) throw new Error('Enter a valid date.');
        await persist({ ...data, entries: editing ? data.entries.map(e => e.id === editing.id ? entry : e) : [...data.entries, entry] }); setTripId(entry.tripId); setSelected(entry.id); setEditing(null);
      }
      setDialog(null);
    } catch (err) { setError(err.message || 'Could not save. Browser storage may be full. Export your journal as a backup.'); }
    finally { setSaving(false); }
  }
  function exportJournal() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, ...data })], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'roam-journal.json'; a.click(); URL.revokeObjectURL(url);
  }
  async function importJournal(event) {
    const file = event.target.files[0]; if (!file) return;
    try {
      const incoming = JSON.parse(await file.text());
      if (incoming.version !== 1 || !Array.isArray(incoming.trips) || !Array.isArray(incoming.entries)) throw new Error('Choose a Roam journal export.');
      const ids = new Set();
      for (const t of incoming.trips) {
        if (typeof t.id !== 'string' || typeof t.name !== 'string' || !t.name.trim() || ids.has(t.id)) throw new Error('Invalid trip data.');
        ids.add(t.id);
      }
      const entryIds = new Set();
      for (const e of incoming.entries) {
        if (typeof e.id !== 'string' || entryIds.has(e.id) || !ids.has(e.tripId) || typeof e.place !== 'string' || typeof e.note !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || Number.isNaN(Date.parse(e.date)) || !Array.isArray(e.photos) || !e.photos.every(p => typeof p.name === 'string' && typeof p.url === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,/.test(p.url)) || !((e.lat === null && e.lng === null) || (Number.isFinite(e.lat) && Number.isFinite(e.lng) && Math.abs(e.lat) <= 90 && Math.abs(e.lng) <= 180))) throw new Error('Invalid memory data.');
        if (e.story && (typeof e.story.text !== 'string' || !e.story.answers || typeof e.story.answers !== 'object' || Object.values(e.story.answers).some(v => typeof v !== 'string'))) throw new Error('Invalid story data.');
        if (e.destinationPhotos && (!Array.isArray(e.destinationPhotos) || !e.destinationPhotos.every(p => typeof p.id === 'string' && typeof p.name === 'string' && typeof p.author === 'string' && typeof p.license === 'string' && typeof p.url === 'string' && p.url.startsWith('https://upload.wikimedia.org/') && typeof p.sourceUrl === 'string' && p.sourceUrl.startsWith('https://commons.wikimedia.org/')))) throw new Error('Invalid destination photo data.');
        entryIds.add(e.id);
      }
      if (!window.confirm('Replace this browser’s journal with the imported backup? Export your current journal first if you want to keep it.')) return;
      await persist({ trips: incoming.trips, entries: incoming.entries }); setTripId('all'); setSelected(null); setError('');
    } catch (err) { setError(err.message); }
    event.target.value = '';
  }
  async function deleteEntry() {
    if (!window.confirm(`Delete the memory from ${active.place}? This cannot be undone.`)) return;
    try { await persist({ ...data, entries: data.entries.filter(e => e.id !== active.id) }); setSelected(null); }
    catch { setError('Could not delete this memory.'); }
  }
  if (!data) return <main className="loading"><h1>roam<span>✦</span></h1><p>{error || 'Opening your journal…'}</p></main>;
  return <><header><a className="brand" href="/">roam<span>✦</span></a><span className="brand-note">A little closer to yesterday.</span><button className="privacy" onClick={() => setDialog('share')}>♧ Private journal</button></header>
    <main><div className="intro"><div><p className="eyebrow">YOUR PERSONAL TRAVEL JOURNAL</p><h1>Places pass.<br/><em>Memories stay.</em></h1><p className="subtitle">The days, the detours, the moments you want to keep.</p></div><div className="intro-right"><span className="stamp">COLLECT MOMENTS<br/><b>✦</b><br/>NOT THINGS</span><button className="primary" onClick={() => { setError(''); setEditing(null); setDialog(data.trips.length ? 'memory' : 'trip'); }}>＋ Add a memory</button></div></div>
    <div className="import-banner"><div><strong>Turn your route into a scrapbook.</strong><span>Import Google Timeline and match your original photos.</span></div><button className="secondary" onClick={() => { setError(''); setDialog('import'); }}>Import Timeline & photos ↗</button></div>
    <section className="toolbar"><div className="trip-tabs"><button className={tripId === 'all' ? 'active' : ''} onClick={() => { setTripId('all'); setSelected(null); }}>All journeys <small>{data.trips.length}</small></button>{data.trips.map(t => <button key={t.id} className={tripId === t.id ? 'active' : ''} onClick={() => { setTripId(t.id); setSelected(null); }}>{t.name}</button>)}<button className="new-trip" onClick={() => { setError(''); setDialog('trip'); }}>＋ New trip</button></div><div className="view-toggle"><button className={view === 'timeline' ? 'chosen' : ''} onClick={() => setView('timeline')}>☷ Timeline</button><button className={view === 'map' ? 'chosen' : ''} onClick={() => setView('map')}>⌖ Map</button></div></section>
    {error && !dialog && <p role="alert" className="error">{error}</p>}
    <div className="section-heading"><h2>{trip?.name || 'Your collection of moments'}</h2><span>{entries.length} {entries.length === 1 ? 'memory' : 'memories'} · Only you</span></div>
    {!entries.length ? <section className="empty"><div className="empty-icon">⌖</div><p className="eyebrow">EVERY JOURNEY STARTS SOMEWHERE</p><h2>Your next adventure belongs here.</h2><p>Add a trip, then collect the photos and little details<br/>that make each day yours.</p><button className="primary" onClick={() => { setError(''); setEditing(null); setDialog(data.trips.length ? 'memory' : 'trip'); }}>{data.trips.length ? 'Add your first memory' : 'Create your first trip'} <span>↗</span></button><div className="empty-footer">A morning by the sea. A street you got lost in. A meal you still think about.</div></section> : <div className={`journal ${view}`}><aside className="days"><p className="eyebrow">THE DAYS ALONG THE WAY</p>{[...new Set(entries.map(e => e.date))].map(date => <div className="day-group" key={date}><p className="day-label">{formatDate(date)}</p>{entries.filter(e => e.date === date).map(e => <button key={e.id} className={`day-card ${active?.id === e.id ? 'selected' : ''}`} onClick={() => setSelected(e.id)}>{e.photos[0] ? <img src={e.photos[0].url} alt=""/> : <div className="mini-placeholder">⌖</div>}<span><strong>{e.place}</strong><small>{data.trips.find(t => t.id === e.tripId)?.name} · {e.photos.length} photos</small></span><b>↗</b></button>)}</div>)}</aside><section className="memory-content">{view === 'map' && <MapView entries={entries} selected={active?.id} onSelect={setSelected}/>}{active && <article className="memory"><p className="eyebrow">{formatDate(active.date)} · {data.trips.find(t => t.id === active.tripId)?.name}</p><h2>{active.place}</h2>{active.note && <p className="note">{active.note}</p>}<div className="memory-actions"><button className="secondary" onClick={() => { setEditing(active); setError(''); setDialog('memory'); }}>Edit memory</button><button className="secondary" onClick={() => setDialog('story')}>Write this day’s story</button><button className="secondary" onClick={() => setDialog('destination')}>Add destination photos</button></div>{active.story?.text && <section className="scrapbook-story"><p className="eyebrow">THE STORY OF THIS DAY</p><p>{active.story.text}</p></section>}<div className="photos">{active.photos.map((p, i) => <button key={i} onClick={() => setLightbox(p)} aria-label={`Open photo ${i + 1}: ${p.name}`}><img src={p.url} alt={p.caption || p.name}/>{p.caption && <span className="photo-caption">{p.caption}</span>}</button>)}</div>{active.destinationPhotos?.length > 0 && <section className="destination-section"><p className="eyebrow">DESTINATION PHOTOS · NOT TAKEN ON YOUR VISIT</p><div className="destination-grid">{active.destinationPhotos.map(p => <figure key={p.id}><img src={p.url} alt={p.name}/><figcaption>{p.name}<br/>{p.author} · {p.license}<br/><a href={p.sourceUrl} target="_blank" rel="noreferrer">Wikimedia Commons source & license ↗</a></figcaption></figure>)}</div></section>}{!active.photos.length && <p className="muted">A moment remembered in words.</p>}<button className="text-button delete" onClick={deleteEntry}>Delete memory</button></article>}</section></div>}
    <footer><span>Made for the moments in between. <i>✦</i></span><div><button onClick={exportJournal}>Export backup</button><button onClick={() => importRef.current.click()}>Import backup</button><input ref={importRef} type="file" accept="application/json" hidden onChange={importJournal}/></div><p>Stored in this browser. Export a backup to keep your photos safe.</p></footer></main>
    {dialog && !['import', 'story', 'destination'].includes(dialog) && <div className="overlay" onClick={e => { if (e.target === e.currentTarget && !saving) setDialog(null); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button className="close" aria-label="Close dialog" disabled={saving} onClick={() => setDialog(null)}>×</button><p className="eyebrow">A PLACE FOR YOUR MEMORIES</p><h2 id="dialog-title">{dialog === 'trip' ? 'Where are you heading?' : dialog === 'share' ? 'Just you. For now.' : 'Keep this moment.'}</h2>{dialog === 'share' ? <><p>Your memories are stored only in this browser. Online sharing is not connected yet.</p><p>Invitation-only sharing will need accounts and secure photo storage. No trip is public, and no invitations are sent by this version.</p><button className="primary" onClick={() => setDialog(null)}>Back to my journal</button></> : <form onSubmit={save}>{dialog === 'trip' ? <label>Trip name<input name="name" required maxLength="100" placeholder="A week in Lisbon" autoFocus/></label> : <><div className="form-row"><label>Trip<select name="trip" defaultValue={editing?.tripId || (tripId === 'all' ? data.trips[0]?.id : tripId)}>{data.trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Date<input name="date" type="date" defaultValue={editing?.date || today()} required/></label></div><label>Place<input name="place" defaultValue={editing?.place || ''} required maxLength="150" placeholder="A little café by the sea" autoFocus/></label><label>Your story<textarea name="note" defaultValue={editing?.note || ''} rows="3" maxLength="10000" placeholder="What made this day worth remembering?"/></label><label className="upload">{editing ? 'Add more photos (existing photos are kept)' : 'Photos'} <span>JPG, PNG, WebP or GIF · up to 12 photos, 10 MB each</span><input name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif"/></label><details><summary>Pin this place on the map (optional)</summary><p className="muted">Copy latitude and longitude from your map app. Leaving these blank keeps the memory in your timeline.</p><div className="form-row"><label>Latitude<input name="lat" defaultValue={editing?.lat ?? ''} type="number" step="any" min="-90" max="90" placeholder="38.7223"/></label><label>Longitude<input name="lng" defaultValue={editing?.lng ?? ''} type="number" step="any" min="-180" max="180" placeholder="-9.1393"/></label></div></details></>}{error && <p className="error" role="alert">{error}</p>}<button className="primary save" disabled={saving}>{saving ? 'Saving…' : dialog === 'trip' ? 'Create trip ↗' : 'Save memory ↗'}</button></form>}</section></div>}
    {dialog === 'import' && <ImportTravel trips={data.trips} defaultTrip={tripId} onClose={() => setDialog(null)} onSave={async imported => {
      const newTrip = imported.tripId ? null : { id: crypto.randomUUID(), name: imported.newName };
      const target = imported.tripId || newTrip.id;
      const existingKeys = new Set(data.entries.filter(e => e.tripId === target && e.source === 'google-timeline').map(e => `${e.startTime}|${e.lat}|${e.lng}`));
      if (imported.visits.some(v => existingKeys.has(`${v.startTime}|${v.lat}|${v.lng}`))) throw new Error('Some selected visits are already in this trip. Uncheck duplicates before saving.');
      await persist({ trips: newTrip ? [...data.trips, newTrip] : data.trips, entries: [...data.entries, ...imported.visits.map(v => ({ ...v, tripId: target }))] });
      setTripId(target); setSelected(imported.visits[0]?.id);
    }}/>}
    {dialog === 'story' && active && <StoryDialog entries={data.entries.filter(e => e.tripId === active.tripId && e.date === active.date)} onClose={() => setDialog(null)} onSave={async story => {
      await persist({ ...data, entries: data.entries.map(e => e.tripId === active.tripId && e.date === active.date ? { ...e, story } : e) });
    }}/>}
    {dialog === 'destination' && active && <DestinationPhotos entry={active} onClose={() => setDialog(null)} onSave={async destinationPhotos => {
      await persist({ ...data, entries: data.entries.map(e => e.id === active.id ? { ...e, destinationPhotos } : e) });
    }}/>}
    {lightbox && <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={() => setLightbox(null)}><button className="close" aria-label="Close photo">×</button><img src={lightbox.url} alt={lightbox.name}/></div>}
  </>;
}
createRoot(document.getElementById('root')).render(<App/>);
