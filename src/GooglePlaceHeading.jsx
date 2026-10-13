import React, { useEffect, useState } from 'react';
import { googleRequest, safeGoogleUrl } from './google.js';

export default function GooglePlaceHeading({ placeId }) {
  const [place, setPlace] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setPlace(null); setError('');
    googleRequest('resolve', { placeId }, controller.signal).then(data => setPlace(data.candidates[0])).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [placeId]);
  return <section className="google-place-summary"><span className="google-attribution" translate="no">Google Maps</span>{error ? <p className="muted">{error}</p> : !place ? <p className="muted">Finding the name of this location…</p> : <><h3>{place.displayName?.text}</h3><p>{place.formattedAddress}</p>{safeGoogleUrl(place.googleMapsUri) && <a href={safeGoogleUrl(place.googleMapsUri)} target="_blank" rel="noreferrer">View this place on Google Maps ↗</a>}</>}</section>;
}
