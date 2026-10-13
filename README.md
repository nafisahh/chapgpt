# Roam travel journal

A mobile-friendly, browser-local travel journal with trips, daily memories, photo galleries, and an interactive map.

## Development

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
```

Run `npm run build` for a production build, and `npm run preview` to serve it.

Run `npm test` for Timeline parsing, timezone handling, matching, and story tests.

## Using the journal

Create a trip and add memories with a date, place, note, and optional photos. Add latitude and longitude to display a memory on the map. Click a day or map marker to open a memory, and click a photo to expand it. Export and import JSON backups using the footer controls.

## Timeline and photo imports

Choose **Import Timeline & photos**. Upload an unzipped Google Timeline JSON export, choose a trip, then review the visits. Supported shapes include `semanticSegments`, a direct array of semantic segments, and older `timelineObjects` with `placeVisit` records. Raw location-history points, activity-only records, and ZIP archives are not imported as visits. Unnamed places can be renamed; unwanted visits can be unchecked. Use the optional trip start/end dates to filter long exports. Batches are limited to 200 visits for review. A visit crossing midnight is grouped on its recorded start day. Existing visits in the same trip are detected to prevent duplicate imports.

Add original JPG, PNG, WebP or GIF files (up to 100 per batch, 10 MB each). The browser reads EXIF capture dates, GPS and timezone offsets when available. It suggests matches by recorded date and nearby GPS (within 1 km), or by an offset-aware timestamp within a visit. Multiple similar candidates need your choice. Camera times with no offset keep the camera's recorded calendar date; they are not silently converted using your computer's timezone. Missing metadata never falls back to file modification dates. Choose a visit or explicitly skip each unmatched photo before saving. Add captions to record visible activities and details. Photos from messaging apps may have lost their metadata. HEIC files must be converted to supported formats while retaining metadata.

## Scrapbook stories and destination photos

**Write this day's story** gathers all memories from that trip and day, displays your photos, and asks about companions, mood, the highlight, and details the photos missed. The local story builder combines the chronological route, captions, and your answers into an editable draft. It does not use a remote AI service, analyze image contents, or infer emotions from faces. Your mood is self-reported. Review and edit the draft before saving it to the day's memories. You can edit a memory's place, date, notes and coordinates without losing its photos.

**Add destination photos** optionally searches Wikimedia Commons within 1 km of a memory's coordinates. The user initiates the request; it sends those coordinates to Wikimedia, but does not upload your personal photos or Timeline. Results may be empty or unavailable. Selected photos retain their author, license and source link and are labelled as destination images, not photos of your visit. They load remotely rather than being included as offline image files in backups. No API key is required. Network access to `commons.wikimedia.org` and `upload.wikimedia.org` is needed.

## Current limits

Data, including photos, is stored in IndexedDB on this browser and origin. It does not sync between devices; clearing browser storage removes it. Export regular backups. This is a local prototype, not an authenticated online service. Invitation-only sharing is not implemented; the privacy dialog explains this and sends no invitations. A production version needs authentication, server-side trip permissions, secure photo storage, and invitation handling. No API credentials are required by this prototype.

Map tiles load from OpenStreetMap; fonts load from Google Fonts with local fallbacks. These providers receive network requests. Map requests reflect the area viewed. The journal itself is not uploaded to them. Timeline processing, EXIF extraction and story drafting happen locally in your browser. Backups contain personal locations, photos, captions and stories; keep them private.
