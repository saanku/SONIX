# SONIX for Android

Download [SONIX.apk](https://github.com/saanku/SONIX/releases/download/android-test/SONIX.apk) on an Android phone running Android 7 or newer. Open the download and allow installation from your browser if Android asks. Install SONIX and sign in with your existing account.

The Android workflow builds a signed release APK on pushes to main and replaces that download. The same private signing key is kept in GitHub Actions secrets, so later APKs can update the installed app. The version code increases for every workflow run. This is a direct-install test build, not a Google Play publication. Keep the signing key backup safe; losing it prevents updates to existing installations.

## Build locally

Install Node 22+, Android Studio, Java 21 and Android SDK 36. Run `npm ci`, configure the public frontend settings in `.env.local`, then `npm run android:sync` and `npm run android:open`.

For a local debug APK, run `gradlew.bat assembleDebug` from `android` on Windows, or `bash gradlew assembleDebug` on macOS/Linux. A debug APK has a different signing certificate from the downloadable release and cannot update it directly.

## Behavior

The UI is bundled with the APK. Your account library still syncs with the website; imported audio remains on its importing device. Account confirmation and password reset links open the website, after which you can sign in to the app.

The visible YouTube player uses the existing HTTPS player bridge, with Android's `https://localhost` origin explicitly allowed. It receives no account tokens. Quality uses the YouTube player's own settings. There is no background YouTube audio or ad-blocking implementation.

Verify actual YouTube playback, account sign-in, file imports and cross-device control on your phone. Server API-key restrictions and YouTube video availability can affect playback/search independently of a successful APK build.
