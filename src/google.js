export async function googleRequest(action, body, signal) {
  const response = await fetch(`/api/google/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Google lookup is unavailable.');
    error.status = response.status;
    throw error;
  }
  return data;
}
export function visitName(visit) {
  return visit.googleLabel || visit.place;
}
export function photoVisitLabel(visit) {
  const time = typeof visit.startTime === 'string' ? new Date(visit.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : '';
  return `${visit.date} · ${visitName(visit)}${visit.googleSuggested ? ' (nearby suggestion)' : ''}${time ? ` · ${time}` : ''}`;
}
export function safeGoogleUrl(value) {
  try {
    const url = new URL(value?.startsWith('//') ? `https:${value}` : value);
    return url.protocol === 'https:' && (url.hostname.endsWith('.google.com') || url.hostname === 'google.com' || url.hostname.endsWith('.googleusercontent.com') || url.hostname === 'maps.app.goo.gl') ? url.href : null;
  } catch { return null; }
}
