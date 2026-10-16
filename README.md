# SONIX

A personal music app with a responsive charcoal-and-lime interface, sign-in and account creation, installable PWA shell, local audio imports, persistent playlists and favorites, playback queue, sleep timer, movable video player, and Supabase account sync.

## Run locally

Requires Node.js 22.12+ (or a supported newer version).

```sh
npm install
npm run dev
```

Open the URL printed by Vite, normally http://127.0.0.1:5173. To test from a phone on your Wi-Fi, run `npm run dev -- --host 0.0.0.0` and use your computer's LAN address. PWA installation requires HTTPS or localhost, so use the deployed site for installation on phones.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in your ignored `.env.local` before testing account access. Use the project's public/publishable key, never a service-role key. Run `supabase/schema.sql` once for a new project; the existing project already uses this library schema. Enable email authentication and add your local and deployed SONIX URLs to the project's allowed redirect URLs.

SONIX opens at the sign-in screen for signed-out visitors. **Create account** collects a name, email and password; if email confirmation is enabled, the app asks the listener to confirm their email before signing in. Returning sessions open the library automatically. Favorites, playlists and history sync to the account, with an account-specific local backup when cloud writes fail. Listening position and queue are saved per account on the device. Signing out stops playback and returns to the login screen. Imported audio stays in device storage, and passwords are handled by Supabase rather than saved by SONIX.

```sh
npm test
npm run build
npm run preview
```

Press **Space** to play/pause and **/** to focus search. Import audio using the sidebar or Library. Audio files are kept in IndexedDB on that device. Playlists, history, and likes are saved in local storage. Clearing browser data removes this local collection.

## Listening controls

- **Continue listening:** the Home card and Play button restore your last song, position, queue, shuffle, repeat, and volume on this device. Reloading never starts music automatically. Session metadata is saved periodically and when pausing or leaving the page; imported audio must still be available on the same device.
- **Sleep timer:** use the clock in the top bar. Choose 15, 30, 45, or 60 minutes, a custom 1–180 minutes, or the end of the playing song. Set another timer to replace it, or choose Cancel timer. The deadline survives reloads. Browsers can suspend background tabs, so keep SONIX open for timely stopping; an overdue timer pauses playback when the tab wakes.
- **Queue:** open it from the top bar or player. Use a song's three-dot menu for Play next or Add to queue. Drag rows to reorder on desktop, or use the up/down buttons on any device. Remove individual songs or clear everything except the current song. Queue selection preserves your edited order.
- **Compact video player:** drag its header using a mouse or touch, or focus the header and use arrow keys. Position is remembered on this device and kept within the viewport. The reset button returns it to its default corner. Close pauses and hides the video; Play shows it again. YouTube playback continues to require a visible video player.

## YouTube setup

GitHub deployments use repository variables for the YouTube key and Supabase connection. Credentials are not committed to source. Supabase configuration is required for sign-in; missing configuration shows a setup error rather than a simulated account.

1. In [Google Cloud](https://console.cloud.google.com/apis/library/youtube.googleapis.com), enable **YouTube Data API v3** for your project and create an API key.
2. Restrict the key to **YouTube Data API v3** and HTTP referrers for your local and deployed website.
3. Set `VITE_YOUTUBE_API_KEY=` in `.env.local` to your key and restart Vite. Alternatively, open **Full songs ? Add API key** to enter it for the current browser-tab session.
4. For deployment, set the GitHub Actions variable `VITE_YOUTUBE_API_KEY` and rebuild.

Vite keys are visible to browser users; website and API restrictions are essential. No key is bundled by default.

Search uses [YouTube Data API v3 search.list](https://developers.google.com/youtube/data/docs/search/list), followed by videos.list for durations and availability. Results use token-based pagination and a five-minute memory cache. Quota and configuration errors appear in the catalog. Search requests consume your project's API quota.

Playback uses the visible [YouTube IFrame Player](https://developers.google.com/youtube/iframe_api_reference), with play/pause, seeking, volume, queue, shuffle and repeat controls. The Data API does not provide direct audio streams or offline downloads. Some videos may become unavailable or disallow embedding; use their YouTube link. If autoplay is blocked, press Play inside the video.

Favorites and playlists retain video metadata. The previous Jamendo client ID is removed from browser local storage on startup; previous provider tracks are no longer displayed.

- The six included SONIX Originals are original 32-second instrumental synthesizer sketches generated by `scripts/create-assets.py`. They are playable samples, not commercial songs or a licensed commercial streaming catalog.
- Your imported, browser-supported audio files play in full. Unsupported codecs produce an error instead of simulated playback.

Original-sample generation uses Python's standard library. Photographs were downloaded from Unsplash image endpoints; source photo IDs are listed in `scripts/create-assets.py`. Google Fonts serves DM Sans and Manrope with `font-display: swap`; system fonts are the fallback. Photos are served locally, and audio downloads begin when a track is selected.

## Free GitHub Pages deployment

1. Push this project to a GitHub repository with default branch `main`.
2. In **Settings → Pages**, select **GitHub Actions** as the source.
3. Add the repository **Actions variable** `VITE_YOUTUBE_API_KEY` for YouTube search.
4. Run **Publish SONIX** from Actions, or push a commit to `main`.
5. Add the deployed HTTPS address to the YouTube key's allowed HTTP referrers.
6. Install from Safari's **Share → Add to Home Screen** on iPhone, or Chrome's **Install app** on Android.

The relative Vite base supports GitHub Pages repository subpaths. Service worker caching retains the visited app shell and images for offline use; it does not cache remote services or automatically download audio. Locally imported audio remains available offline after the app has been loaded. Rebuild after changing environment configuration.

## Verification

`npm test` covers storage validation, favorites, queue transitions, library merging, YouTube metadata, token pagination, cache invalidation, quota errors, and playback identifier validation. `node tests/browser.mjs` runs browser checks against the dev server on port 5173 (install Chromium with `npx playwright install chromium` first, or set `BROWSER_EXECUTABLE` to an installed Chromium executable). It checks desktop/mobile layout, real playback, playlist persistence, favorites, search, audio import, queue, and writes screenshots to ignored `test-results/`.

`node tests/catalog-browser.mjs` checks mocked YouTube search, pagination, favorites, and mobile layout without a live API key. Set `SONIX_URL` to test a deployment.

`node tests/listening-browser.mjs` checks session restoration, queue editing and drag ordering, compact-player positioning, and sleep timer expiry/cancellation using a mocked YouTube player and clock. It also accepts `SONIX_URL`. Unit tests cover session validation, queue operations, and timer deadlines.

`node tests/auth-browser.mjs` checks the login gate, sign-up confirmation, password errors, session persistence, saved libraries, account isolation, and layouts from 320px to desktop. Browser suites mock Supabase to avoid creating test users or modifying real accounts. Use `BROWSER_EXECUTABLE` for an installed Chromium browser and `SONIX_URL` for an alternate local port or deployed build.

No hosting, GitHub repository, or Supabase project is provisioned automatically by the local code. Usage must remain within the chosen providers' free allowances.
