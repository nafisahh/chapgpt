import React, { useEffect, useState } from 'react';
import { findDestinationPhotos } from './photos.js';

export default function DestinationPhotos({ entry, onSave, onClose }) {
  const [photos, setPhotos] = useState([]), [selected, setSelected] = useState(new Set((entry.destinationPhotos || []).map(p => p.id)));
  const [error, setError] = useState(''), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(0);
  useEffect(() => {
    if (!search) return;
    const controller = new AbortController(); setLoading(true); setError('');
    findDestinationPhotos(entry, controller.signal).then(setPhotos).catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search, entry]);
  async function save() {
    setBusy(true); setError('');
    try {
      const available = [...(entry.destinationPhotos || []), ...photos];
      await onSave([...new Map(available.filter(p => selected.has(p.id)).map(p => [p.id, p])).values()]); onClose();
    } catch { setError('Could not save destination photos.'); }
    finally { setBusy(false); }
  }
  return <div className="overlay"><section className="dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="destination-title"><button className="close" aria-label="Close destination photos" disabled={busy} onClick={onClose}>×</button><p className="eyebrow">A LITTLE CONTEXT FOR YOUR SCRAPBOOK</p><h2 id="destination-title">Discover {entry.place}.</h2><p>Find publicly available photos within 1 km of this place on Wikimedia Commons. They show the destination, not your visit. Credits stay attached.</p><p className="muted">Searching sends this place's coordinates to Wikimedia. Selected images load from Wikimedia when you view them; your own photos are never uploaded.</p><button className="secondary" disabled={loading} onClick={() => setSearch(search + 1)}>{loading ? 'Searching…' : 'Search nearby destination photos'}</button>{error && <p className="error" role="alert">{error}</p>}{search > 0 && !loading && !error && !photos.length && <p className="muted">No suitable nearby photos found. You can keep your own pictures as the whole story.</p>}<div className="destination-grid">{[...new Map([...(entry.destinationPhotos || []), ...photos].map(p => [p.id, p])).values()].map(p => <label className="destination-option" key={p.id}><img src={p.url} alt={p.name}/><span><input type="checkbox" checked={selected.has(p.id)} onChange={e => { const next = new Set(selected); e.target.checked ? next.add(p.id) : next.delete(p.id); setSelected(next); }}/>{p.name}</span><small>{p.author} · {p.license}</small><a href={p.sourceUrl} target="_blank" rel="noreferrer">View source & license ↗</a></label>)}</div><button className="primary save" disabled={busy || loading} onClick={save}>{busy ? 'Saving…' : 'Save selected destination photos'}</button></section></div>;
}
