export async function googleRequest(action, body, signal) {
  const response = await fetch(`/api/google/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Google lookup is unavailable.');
  return data;
}
export function safeGoogleUrl(value) {
  try {
    const url = new URL(value?.startsWith('//') ? `https:${value}` : value);
    return url.protocol === 'https:' && (url.hostname.endsWith('.google.com') || url.hostname === 'google.com' || url.hostname.endsWith('.googleusercontent.com') || url.hostname === 'maps.app.goo.gl') ? url.href : null;
  } catch { return null; }
}
