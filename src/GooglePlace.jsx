import React, { useEffect, useState } from 'react';
import { googleRequest, safeGoogleUrl } from './google.js';

function Photo({ placeId, index, authors, sourceUrl }) {
  const [url, setUrl] = useState(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    googleRequest('photo', { placeId, index }, controller.signal).then(data => {
      const image = safeGoogleUrl(data.photoUri); if (image) setUrl(image); else setFailed(true);
    }).catch(error => { if (error.name !== 'AbortError') setFailed(true); });
    return () => controller.abort();
  }, [placeId, index]);
  return <figure>{url ? <img src={url} alt="Public photo of this place on Google Maps" onError={() => setFailed(true)}/> : <p className="muted">{failed ? 'Photo unavailable' : 'Loading photo…'}</p>}<figcaption>{authors?.map((a, i) => <span key={i}>{safeGoogleUrl(a.photoUri) && <img className="author-avatar" src={safeGoogleUrl(a.photoUri)} alt=""/>}{safeGoogleUrl(a.uri) ? <a href={safeGoogleUrl(a.uri)} target="_blank" rel="noreferrer">{a.displayName}</a> : a.displayName} </span>)}{sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer">View source on Google Maps ↗</a>}</figcaption></figure>;
}
export default function GooglePlace({ placeId, onClose }) {
  const [place, setPlace] = useState(null), [error, setError] = useState(''), [showPhotos, setShowPhotos] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    googleRequest('details', { placeId }, controller.signal).then(setPlace).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [placeId]);
  const mapUrl = safeGoogleUrl(place?.googleMapsUri);
  return <div className="overlay"><section className="dialog import-dialog google-place" role="dialog" aria-modal="true" aria-labelledby="google-title"><button className="close" aria-label="Close Google place" onClick={onClose}>×</button><div className="google-attribution" translate="no">Google Maps</div><h2 id="google-title">{place?.displayName?.text || 'About this place'}</h2>{error ? <p className="error" role="alert">{error}</p> : !place ? <p>Looking up this place…</p> : <><p>{place.formattedAddress}</p>{mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer">Open this exact place in Google Maps ↗</a>}{place.attributions?.map((a,i) => <p key={i} className="muted">{a.provider} {safeGoogleUrl(a.providerUri) && <a href={safeGoogleUrl(a.providerUri)}>Source</a>}</p>)}<p>{place.rating != null ? `${place.rating} / 5 · ${place.userRatingCount || 0} ratings` : 'No ratings available'}</p><p className="muted">Public photos and reviews describe the place, not your visit or feelings. Google content is loaded fresh and is not included in journal backups.</p>{place.photos?.length > 0 && <><button className="secondary" onClick={() => setShowPhotos(!showPhotos)}>{showPhotos ? 'Hide public photos' : 'Show public photos of this location'}</button>{showPhotos && <div className="destination-grid">{place.photos.slice(0, 3).map((p, index) => <Photo key={index} placeId={placeId} index={index} authors={p.authorAttributions} sourceUrl={safeGoogleUrl(p.googleMapsUri) || mapUrl}/>)}</div>}</>}<h3>What visitors say</h3><p className="muted">Reviews returned by Google, ordered by relevance; this is a limited sample, not all reviews.</p>{!place.reviews?.length && <p className="muted">No reviews available.</p>}{place.reviews?.map((review, i) => <article className="google-review" key={i}><p>{safeGoogleUrl(review.authorAttribution?.photoUri) && <img className="author-avatar" src={safeGoogleUrl(review.authorAttribution.photoUri)} alt=""/>}{safeGoogleUrl(review.authorAttribution?.uri) ? <a href={safeGoogleUrl(review.authorAttribution.uri)} target="_blank" rel="noreferrer">{review.authorAttribution.displayName}</a> : review.authorAttribution?.displayName} · {review.rating} / 5</p><p className="muted">{review.relativePublishTimeDescription}{review.visitDate && ` · Visited ${review.visitDate.month}/${review.visitDate.year}`}</p><p>{review.text?.text || review.originalText?.text}</p>{safeGoogleUrl(review.googleMapsUri) && <a href={safeGoogleUrl(review.googleMapsUri)} target="_blank" rel="noreferrer">View original review ↗</a>}</article>)}</>}</section></div>;
}
