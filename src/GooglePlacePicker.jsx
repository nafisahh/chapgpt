import React, { useState } from 'react';
import { googleRequest, safeGoogleUrl } from './google.js';

export default function GooglePlacePicker({ entry, onSave, onClose }) {
  const [result, setResult] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function lookup() {
    setBusy(true); setError('');
    try { setResult(await googleRequest('resolve', { placeId: entry.googlePlaceId || undefined, lat: entry.lat, lng: entry.lng })); }
    catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function select(placeId) {
    setBusy(true); setError('');
    try { await onSave(placeId); onClose(); }
    catch { setError('Could not save this place link.'); }
    finally { setBusy(false); }
  }
  return <div className="overlay"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="picker-title"><button className="close" aria-label="Close place lookup" disabled={busy} onClick={onClose}>×</button><p className="eyebrow">PUT A NAME TO THIS PLACE</p><h2 id="picker-title">Find {entry.place}.</h2><p>Look up this location on Google Maps to see its name, address, public photos and reviews. This sends the place ID or coordinates to Google, never your photos.</p><button className="secondary" disabled={busy} onClick={lookup}>{busy ? 'Working…' : 'Find this place on Google Maps'}</button>{error && <p className="error" role="alert">{error}</p>}{result && <section className="google-candidates"><div className="google-attribution" translate="no">Google Maps</div><p className="muted">{result.exactId ? 'Exact Timeline place ID.' : 'Nearby places ranked by distance within 100 metres. Choose the place you actually visited.'} Only the Google place ID is saved; details load fresh.</p>{!result.candidates.length && <p>No places found nearby. Check your map coordinates.</p>}{result.candidates.map(p => <div className="google-candidate" key={p.id}><strong>{p.displayName?.text}</strong><p>{p.formattedAddress}</p>{safeGoogleUrl(p.googleMapsUri) && <a href={safeGoogleUrl(p.googleMapsUri)} target="_blank" rel="noreferrer">View on Google Maps ↗</a>}<button className="secondary" disabled={busy} onClick={() => select(p.id)}>Link this place to my memory</button></div>)}</section>}</section></div>;
}
