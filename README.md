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

## Google Maps place names, public photos and reviews

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. Link a billing account, then enable [Places API (New)](https://console.cloud.google.com/apis/library/places.googleapis.com).
3. Open **APIs & Services → Credentials → Create credentials → API key**. Restrict the key to **Places API (New)**. This is a server-side web-service key, not a browser Maps JavaScript key; browser HTTP-referrer restrictions do not apply to this server route. If you have a stable server egress IP, restrict the key to it. Configure quotas and billing alerts in your Google project. Requested review/photo fields can incur Google charges.
4. Create `.env.local` beside `package.json` and add `GOOGLE_MAPS_API_KEY=your_key`. This file is ignored by Git. Never use a `VITE_` prefix: that would expose the key in browser code. Do not paste the key into chat or commit it.
5. Stop and restart `npm run dev`.

While importing, Google location names automatically load for selected visits and appear in the visit review and photo attachment dropdown. Repeated visits include their UTC start time to distinguish them. For exports with more than 200 visits in range, narrow the trip dates before automatic lookup begins. Up to two lookups run concurrently, and repeated place IDs or identical coordinates reuse their result during that import. If the Timeline contains a Google place ID, that exact place is retrieved; otherwise the nearest named candidate within 100 metres is labelled **nearby suggestion**. Choose **Find name on Google Maps** to review nearby candidates and confirm the place you actually visited. Failed lookups keep the original label and show a retry control. The **Your place label** field remains your own editable journal label. Google-provided names are shown live, rather than being copied into your backup. Photo matching continues to use the original Timeline and EXIF coordinates and dates, not a guessed nearby business. Automatic requests can incur Google API charges.

For saved memories, choose **Identify place on Google Maps** to link a place. The linked memory displays the fresh Google place name and address. **Google place photos & reviews** displays attributed public images and a limited sample of reviews ordered by Google relevance, with links to the originals. Reviews provide visitor context; they are not your own experience, and public images are not pictures of your visit. Google content is not inserted into your personal story as fact.

Only the confirmed Google place ID is retained in IndexedDB/backups. Names, addresses, review text, photo references and media URLs are fetched fresh and not persisted. The original Timeline coordinates remain the basis for your own photo matching. Linked memories open the exact location in Google Maps; the OpenStreetMap panel is not shown alongside Google place content. Google photo references can expire, so the server obtains a fresh reference when loading a photo.

The Vite development and preview servers include `/api/google` routes that hold the API key server-side. Both bind to loopback by default. Do not expose these unauthenticated development servers publicly. A static `dist` deployment alone cannot perform Google lookups; production requires an authenticated server adapter and private server-side key configuration. Google Cloud application-default credentials for unrelated services are not automatically reused for Maps billing. No live Google lookup can be verified until you supply a usable key and billing project.

## Current limits

Data, including photos, is stored in IndexedDB on this browser and origin. It does not sync between devices; clearing browser storage removes it. Export regular backups. This is a local prototype, not an authenticated online service. Invitation-only sharing is not implemented; the privacy dialog explains this and sends no invitations. A production version needs authentication, server-side trip permissions, secure photo storage, and invitation handling. No API credentials are required by this prototype.

Map tiles load from OpenStreetMap; fonts load from Google Fonts with local fallbacks. These providers receive network requests. Map requests reflect the area viewed. The journal itself is not uploaded to them. Timeline processing, EXIF extraction and story drafting happen locally in your browser. Backups contain personal locations, photos, captions and stories; keep them private.
