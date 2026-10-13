import React, { useState } from 'react';
import { parseTimeline, suggestVisit, validDate } from './travel.js';
import { readPhoto } from './photos.js';
import { googleRequest, safeGoogleUrl } from './google.js';

export default function ImportTravel({ trips, defaultTrip, onSave, onClose }) {
  const [lookup, setLookup] = useState(null);
  const [visits, setVisits] = useState([]), [photos, setPhotos] = useState([]);
  const [tripId, setTripId] = useState(defaultTrip === 'all' ? trips[0]?.id || '' : defaultTrip);
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  const scopedVisits = visits.filter(v => (!from || v.date >= from) && (!to || v.date <= to));
  const [newName, setNewName] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function loadTimeline(event) {
    const file = event.target.files[0]; if (!file) return;
    setBusy(true); setError('');
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('Use a JSON export under 50 MB.');
      const loaded = parseTimeline(JSON.parse(await file.text()));
      setVisits(loaded); setPhotos(current => current.map(p => ({ ...p, ...suggestVisit(p, loaded) })));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); event.target.value = ''; }
  }
  async function loadPhotos(event) {
    const files = [...event.target.files]; if (!files.length) return;
    setBusy(true); setError('');
    try {
      if (files.length + photos.length > 100) throw new Error('Import up to 100 photos per batch.');
      const loaded = [];
      for (const file of files) {
        const photo = await readPhoto(file); loaded.push({ ...photo, ...suggestVisit(photo, scopedVisits) });
      }
      setPhotos(current => [...current, ...loaded]);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); event.target.value = ''; }
  }
  function changeVisit(id, field, value) { setVisits(current => current.map(v => v.id === id ? { ...v, [field]: value } : v)); }
  function changePhoto(id, field, value) { setPhotos(current => current.map(p => p.id === id ? { ...p, [field]: value } : p)); }
  async function resolvePlace(visit) {
    setBusy(true); setError('');
    try { setLookup({ visitId: visit.id, ...await googleRequest('resolve', { placeId: visit.googlePlaceId || undefined, lat: visit.lat, lng: visit.lng }) }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const included = scopedVisits.filter(v => v.included);
      if (scopedVisits.length > 200) throw new Error('Narrow the date range to at most 200 visits so you can review them before saving.');
      if (from && to && from > to) throw new Error('The start date must come before the end date.');
      if (!included.length) throw new Error('Select at least one visit.');
      if (included.some(v => !v.place.trim() || !validDate(v.date))) throw new Error('Every selected visit needs a place and a valid date.');
      if (!tripId && !newName.trim()) throw new Error('Choose a trip or enter a new trip name.');
      const selectedIds = new Set(included.map(v => v.id));
      const pending = photos.filter(p => p.visitId !== 'skip' && !selectedIds.has(p.visitId));
      if (pending.length) throw new Error(`Choose a selected visit or “Skip this photo” for ${pending.length} unmatched photo(s).`);
      await onSave({ tripId, newName: newName.trim(), visits: included.map(({ included, googleLabel, ...v }) => ({ ...v, photos: photos.filter(p => p.visitId === v.id).map(({ visitId, reason, warning, ...p }) => p) })) });
      onClose();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="overlay"><section className="dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title"><button className="close" disabled={busy} onClick={onClose} aria-label="Close import">×</button><p className="eyebrow">YOUR ROUTE, YOUR REAL MEMORIES</p><h2 id="import-title">Bring your journey in.</h2><p>Timeline and photo imports stay in your browser. Google lookup sends only the selected place ID or coordinates to Google via the local app server. Review every suggested match before saving.</p><form onSubmit={save}><div className="form-row"><label>Save to trip<select value={tripId} onChange={e => setTripId(e.target.value)}><option value="">Create a new trip</option>{trips.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select></label>{!tripId && <label>New trip name<input value={newName} onChange={e => setNewName(e.target.value)} maxLength="100" required placeholder="My autumn adventure"/></label>}</div><label className="upload">1. Timeline JSON<input type="file" accept=".json,application/json" disabled={busy} onChange={loadTimeline}/><span>Supports modern device exports and older Semantic Location History place visits. Unzip exports first.</span></label><label className="upload">2. Original photos<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={loadPhotos}/><span>Up to 100 photos, 10 MB each. Screenshots and messaging apps often remove metadata.</span></label>{visits.length > 0 && <><div className="form-row"><label>Trip start date (optional)<input type="date" value={from} onChange={e => setFrom(e.target.value)}/></label><label>Trip end date (optional)<input type="date" value={to} onChange={e => setTo(e.target.value)}/></label></div><h3>3. Review visits ({scopedVisits.filter(v => v.included).length} selected)</h3>{scopedVisits.length > 200 && <p className="error">Showing the first 200 of {scopedVisits.length} visits. Set your trip dates to narrow this import before saving.</p>}<p className="muted">Rename unnamed locations and adjust dates. Uncheck visits outside your trip. Recorded dates keep the Timeline's local day.</p><div className="visit-review">{scopedVisits.slice(0, 200).map(v => <div className="visit-row" key={v.id}><label className="include-visit"><input type="checkbox" checked={v.included} onChange={e => changeVisit(v.id, 'included', e.target.checked)} aria-label={`Include ${v.place}`}/></label><label>Your place label<input aria-label="Your place label" value={v.place} onChange={e => changeVisit(v.id, 'place', e.target.value)} maxLength="150"/>{v.googleLabel && <small className="muted">Google Maps: {v.googleLabel}</small>}<button type="button" className="text-button google-lookup" disabled={busy} onClick={() => resolvePlace(v)}>{v.googlePlaceId ? 'Check this Google place' : 'Find name on Google Maps'}</button></label><label>Date<input type="date" value={v.date} onChange={e => changeVisit(v.id, 'date', e.target.value)}/></label></div>)}</div></>}{lookup && <section className="google-candidates"><div className="google-attribution" translate="no">Google Maps</div><h3>{lookup.exactId ? 'Place from your Timeline ID' : 'Nearby places — choose the one you visited'}</h3><p className="muted">{lookup.exactId ? 'The Timeline place ID identifies this Google place.' : 'Ranked by distance within 100 metres. GPS alone cannot confirm which business you visited.'} Google names are shown live; your own editable label is saved to the journal.</p>{!lookup.candidates.length && <p>No nearby places found. Keep your own label or check the coordinates.</p>}{lookup.candidates.map(candidate => <div key={candidate.id} className="google-candidate"><strong>{candidate.displayName?.text}</strong><p>{candidate.formattedAddress}</p>{safeGoogleUrl(candidate.googleMapsUri) && <a href={safeGoogleUrl(candidate.googleMapsUri)} target="_blank" rel="noreferrer">View on Google Maps ↗</a>}<button className="secondary" type="button" onClick={() => { changeVisit(lookup.visitId, 'googlePlaceId', candidate.id); changeVisit(lookup.visitId, 'googleLabel', candidate.displayName?.text); setLookup(null); }}>This is the place I visited</button></div>)}<button type="button" className="text-button" onClick={() => setLookup(null)}>Close suggestions</button></section>}{photos.length > 0 && <><h3>4. Confirm photo matches</h3><p className="muted">Camera dates without a timezone are kept as written. Missing or ambiguous metadata always needs your choice.</p><div className="photo-review">{photos.map(p => <div className="photo-review-row" key={p.id}><img src={p.url} alt={p.name}/><div><strong>{p.name}</strong><p className="muted">{p.metadata.date || 'Date missing'} · {p.metadata.lat !== null ? `GPS ${p.metadata.lat.toFixed(4)}, ${p.metadata.lng.toFixed(4)}` : 'GPS missing'}</p><p className="match-reason">{p.warning || p.reason}</p><label>Attach to visit<select value={p.visitId} onChange={e => changePhoto(p.id, 'visitId', e.target.value)}><option value="">Choose a visit…</option><option value="skip">Skip this photo</option>{scopedVisits.filter(v => v.included).map(v => <option value={v.id} key={v.id}>{v.date} · {v.place}</option>)}</select></label><label>Photo caption<input value={p.caption} onChange={e => changePhoto(p.id, 'caption', e.target.value)} maxLength="500" placeholder="What is happening in this photo?"/></label></div></div>)}</div></>}{error && <p role="alert" className="error">{error}</p>}<button className="primary save" disabled={busy || !visits.length}>{busy ? 'Working…' : 'Save reviewed memories ↗'}</button></form></section></div>;
}
