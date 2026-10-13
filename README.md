# Roam travel journal

A mobile-friendly, browser-local travel journal with trips, daily memories, photo galleries, and an interactive map.

## Development

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

Run `npm run build` for a production build, and `npm run preview` to serve it.

## Using the journal

Create a trip and add memories with a date, place, note, and optional photos. Add latitude and longitude to display a memory on the map. Click a day or map marker to open a memory, and click a photo to expand it. Export and import JSON backups using the footer controls.

## Current limits

Data, including photos, is stored in IndexedDB on this browser and origin. It does not sync between devices; clearing browser storage removes it. Export regular backups. This is a local prototype, not an authenticated online service. Invitation-only sharing is not implemented; the privacy dialog explains this and sends no invitations. A production version needs authentication, server-side trip permissions, secure photo storage, and invitation handling. No API credentials are required by this prototype.

Map tiles load from OpenStreetMap; fonts load from Google Fonts with local fallbacks. These providers receive network requests. Map requests reflect the area viewed. The journal itself is not uploaded to them.
