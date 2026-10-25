# SONIX for iPhone

The native iOS project embeds the bundled SONIX interface in Capacitor's WKWebView. It uses the same Supabase account, playlists, liked songs and device controls as the website. It requires iOS 15 or newer.

## Build on a Mac

Install Node 22+ and Xcode 26+. Run `npm ci`, configure `.env.local` using `.env.example`, then run:

```sh
npm run ios:sync
npm run ios:open
```

Select the App scheme and an iPhone simulator, then Run. Repeat `ios:sync` after web changes; the installed app uses bundled assets, not automatic updates from GitHub Pages. Never commit `.env.local`, signing keys, or generated web bundles.

The **Build SONIX iOS** GitHub workflow compiles without signing, launches an iPhone simulator, and uploads a simulator app and screenshot. A simulator build cannot be installed on a physical iPhone or uploaded to TestFlight.

## TestFlight / App Store handoff

1. In Xcode, select App → Signing & Capabilities and choose your Apple Developer team. The initial bundle ID is `io.github.saanku.sonix`; register it or choose your own unique ID. If changing it, also update `capacitor.config.json`, the player `widget_referrer` in `public/ios-player.js`, and the workflow launch ID.
2. Create the matching app in App Store Connect. Set the version and increment the build number for each upload.
3. Run on a physical iPhone: sign in, open liked songs, play and pause YouTube videos, shuffle, open Quality, switch devices, test imported audio, and verify recovery/confirmation emails.
4. Select a generic iOS device, Product → Archive, then Distribute App → App Store Connect. Add testers in TestFlight after processing.
5. Before App Store submission, supply the app's privacy policy, support URL, screenshots, age rating, and accurate privacy disclosures. The current website has account creation but no in-app account deletion; that needs a backend deletion endpoint before App Store submission. Apple review and distribution are not completed by this repository's simulator build.

## Playback and account behavior

- YouTube remains a visible official embedded player. On iOS, a small HTTPS player page at `https://saanku.github.io/SONIX/ios-player.html` provides the browser referrer required by YouTube. It receives playback commands only; account sessions and API keys are not sent to that frame. Deploy Pages before testing a new player bridge.
- Quality opens the native YouTube player controls. Tap its settings gear and select Quality where available. The IFrame API does not allow the app to force audio bitrate or video quality.
- This app does not implement background YouTube audio or ad blocking. Playback availability and sign-in requirements remain controlled by YouTube.
- Sign in with your existing email and password. Email verification and password recovery open the existing HTTPS website; finish there and return to the app to sign in. No new redirect allow-list entry is needed if the website already works.
- Validate the YouTube API key on a physical device. A key restricted only to website HTTP referrers may reject searches from `capacitor://localhost`; do not remove restrictions from the production web key. Configure an appropriate native API integration before distribution if needed.
- Local imported files remain on their importing device. Cloud library metadata still syncs normally.

References: [Capacitor iOS setup](https://capacitorjs.com/docs/ios), [YouTube embedded client identity](https://developers.google.com/youtube/terms/required-minimum-functionality), [uploading builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/).
