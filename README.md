# SONIX

A personal music app with a responsive charcoal-and-lime interface, installable PWA shell, local audio imports, persistent playlists and favorites, playback queue, shuffle, repeat, volume, seeking, keyboard controls, and optional Supabase account sync.

## Run locally

Requires Node.js 22.12+ (or a supported newer version).

```sh
npm install
npm run dev
```

Open the URL printed by Vite, normally http://127.0.0.1:5173. To test from a phone on your Wi-Fi, run `npm run dev -- --host 0.0.0.0` and use your computer's LAN address. PWA installation requires HTTPS or localhost, so use the deployed site for installation on phones.

```sh
npm test
npm run build
npm run preview
```

Press **Space** to play/pause and **/** to focus search. Import audio using the sidebar or Library. Audio files are kept in IndexedDB on that device. Playlists, history, and likes are saved in local storage. Clearing browser data removes this local collection.

## Connect the Supabase backend

1. Create a Supabase project.
2. Run `supabase/schema.sql` in its SQL editor. It creates one private library document per account, protected by Row Level Security. This small personal app stores playlists, favorites, track metadata, and history together; it does not upload audio files.
3. Copy `.env.example` to `.env.local` and set:

```dotenv
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
```

4. In Supabase Authentication, enable email/password sign-in. Set Site URL and allowed redirects to your local/deployed SONIX URLs. Create your account through SONIX and confirm the email if confirmation is enabled. For a strictly personal instance, disable new user sign-ups after creating your account.
5. Restart Vite, open the avatar menu, and sign in. For hosting, configure these same two values at build time (instructions below).

Only a **publishable key** belongs in the frontend. Never place a service-role key, secret key, or database password in a `VITE_` variable. RLS isolates each user's document. The app saves changes on-device first and debounces cloud writes. Account sync is a simple library snapshot, not collaborative editing: avoid editing the same playlist concurrently on two devices. Local audio must be imported separately on each device; cloud metadata does not contain the file bytes.

Without credentials, SONIX works in device-only mode and does not simulate successful cloud sign-in. Run `node scripts/check-backend.mjs` after configuring `.env.local` to check authentication and table availability without printing credentials. `PGRST205` means you need to run `supabase/schema.sql`. A permissions error for anonymous table access is expected after the schema is secured; full read/write verification requires signing in. The app distinguishes successful sign-in from successful library sync, and keeps an account-scoped local backup if signing out while cloud writes are unavailable.

This app is a client-rendered Vite application, so it uses `VITE_SUPABASE_*` variables, not Next.js `NEXT_PUBLIC_*` variables. Both requested Supabase packages are installed; `@supabase/ssr` is reserved for a future server-rendered implementation and is not imported into the current app.

## Music and discovery

### Full-track playback with Audius

Open **Full songs** in the sidebar or `#audius`, use the Audius search panel in Search, or browse Audius cards on Home. SONIX fetches trending public tracks and searches Audius's catalog directly using its public REST API. No Supabase Edge Function deployment is required for Audius. An optional public `VITE_AUDIUS_API_KEY` can raise read limits; never put an Audius bearer token or secret in frontend variables.

Only records marked streamable and not gated, restricted, deleted, unlisted, or unavailable are listed. Playback rechecks current availability and uses Audius's full-track `/tracks/{id}/stream` endpoint, never a preview URL. A track may still become unavailable or encounter network errors. No access gates are bypassed. This provides Audius's catalog, not every commercial release worldwide.

Favorites, playlists, and listening history retain the Audius track identifier and metadata in the existing SONIX library, so they use the existing Supabase syncing. Temporary signed media URLs are not saved. Audio streams from Audius and is not uploaded to Supabase or cached for offline downloading. Audius attribution and source links are shown with the music. Metadata search results are cached in memory for five minutes; user searches are explicit submissions to avoid unnecessary API traffic.

Official reference: https://docs.audius.co/api/

### Live MusicBrainz search

Search and New Releases now include a worldwide MusicBrainz search form with **Songs**, **Artists**, and **Albums**. Results display titles, credits, available dates and album information, and open the corresponding MusicBrainz page. Search is submitted explicitly rather than making a request on every keystroke. Unicode queries work across languages.

Development works through `/api/musicbrainz`, built into the Vite server. It serializes upstream requests with at least 1.1 seconds between requests, caches up to 100 queries for 15 minutes, retries temporary 429/503 failures, and applies timeouts. Set `MUSICBRAINZ_CONTACT` in `.env.local` to your public project URL or maintainer contact. This is a metadata integration, not an audio service.

For a deployed static site, deploy the included Supabase Edge Function from your authenticated Supabase CLI:

```sh
npx supabase login
npx supabase functions deploy musicbrainz --project-ref afvxsmlpftzybylkzbsz
npx supabase secrets set MUSICBRAINZ_CONTACT=https://YOUR-PUBLIC-PROJECT-URL --project-ref afvxsmlpftzybylkzbsz
```

The publishable app key cannot deploy functions. Production automatically uses `VITE_SUPABASE_URL/functions/v1/musicbrainz`, or you can set `VITE_MUSICBRAINZ_ENDPOINT` to another deployment of the handler. The function is public and read-only, with a fixed upstream and allowed entity types; it does not expose database privileges. Rate pacing/cache are per function instance, appropriate for this personal app. A shared limiter would be required for a large public deployment. Local preview of a production build can use `VITE_MUSICBRAINZ_ENDPOINT=/api/musicbrainz` at build time.

Reference: https://musicbrainz.org/doc/MusicBrainz_API and https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting

- The six included SONIX Originals are original 32-second instrumental synthesizer sketches generated by `scripts/create-assets.py`. They are playable samples, not commercial songs or a licensed commercial streaming catalog.
- Your imported, browser-supported audio files play in full. Unsupported codecs produce an error instead of simulated playback.
- `public/releases.json` contains a real MusicBrainz discovery snapshot. It includes available release-language metadata without restricting the query to one language. This field describes release text, not necessarily the sung language. The feed is a sample of recent releases (up to 300 records, deduplicated by release group), not every song released worldwide.
- Each discovered release links to MusicBrainz for further information and external links. No full audio is claimed for these listings.
- Run `npm run update-releases` to refresh. Set `MUSICBRAINZ_CONTACT` to your actual repository URL or contact address. The updater respects one-request-per-second pacing, checks HTTP errors, and preserves the old file if the request fails.
- The daily GitHub Actions workflow refreshes the feed and deploys it. It begins working only after this code is pushed to GitHub and Pages is enabled; schedules are subject to GitHub's execution and inactivity limits.

Original-sample generation uses Python's standard library. Photographs were downloaded from Unsplash image endpoints; source photo IDs are listed in `scripts/create-assets.py`. Google Fonts serves DM Sans and Manrope with `font-display: swap`; system fonts are the fallback. Photos are served locally, and audio downloads begin when a track is selected.

## Free GitHub Pages deployment

1. Push this project to a GitHub repository with default branch `main`.
2. In **Settings → Pages**, select **GitHub Actions** as the source.
3. For cloud sync, add repository **Actions variables** named `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. These are public frontend configuration; never add a service-role key here.
4. Run **Publish SONIX** from Actions, or push a commit to `main`.
5. Once deployed, add the HTTPS address to Supabase Auth's URL settings.
6. Install from Safari's **Share → Add to Home Screen** on iPhone, or Chrome's **Install app** on Android.

The relative Vite base supports GitHub Pages repository subpaths. Service worker caching retains the visited app shell and images for offline use; it does not cache remote services or automatically download audio. Locally imported audio remains available offline after the app has been loaded. Rebuild after changing environment configuration.

## Verification

`npm test` covers storage validation, favorites, queue transitions, and library merging. `node tests/browser.mjs` runs browser checks against the dev server on port 5173 (install Chromium with `npx playwright install chromium` first, or set `BROWSER_EXECUTABLE` to an installed Chromium executable). It checks desktop/mobile layout, real playback, playlist persistence, favorites, search, audio import, queue, and release rendering, and writes screenshots to ignored `test-results/`.

No hosting, GitHub repository, or Supabase project is provisioned automatically by the local code. Usage must remain within the chosen providers' free allowances.
