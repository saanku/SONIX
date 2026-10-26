package io.github.saanku.sonix;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.SystemClock;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Checks public release metadata without sending any account information. */
final class AppUpdates {
    private static final String RELEASE = "https://github.com/saanku/SONIX/releases/download/android-test/";
    private static final long CHECK_INTERVAL = 60_000;
    private final Activity activity;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private boolean resumed;
    private boolean checking;
    private long lastCheck = -CHECK_INTERVAL;
    private int dismissedBuild;
    private int availableBuild;
    private AlertDialog dialog;

    AppUpdates(Activity activity) { this.activity = activity; }

    void resume() {
        resumed = true;
        if (availableBuild > dismissedBuild) show(availableBuild);
        long now = SystemClock.elapsedRealtime();
        if (checking || now - lastCheck < CHECK_INTERVAL) return;
        lastCheck = now;
        checking = true;
        worker.execute(() -> {
            int newer = 0;
            HttpURLConnection connection = null;
            try {
                int installed = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0).versionCode;
                connection = (HttpURLConnection) new URL(RELEASE + "update.json?t=" + System.currentTimeMillis()).openConnection();
                connection.setConnectTimeout(10_000);
                connection.setReadTimeout(10_000);
                connection.setRequestProperty("Cache-Control", "no-cache");
                connection.setRequestProperty("User-Agent", "SONIX-Android-Updates");
                if (connection.getResponseCode() == 200) {
                    try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                        byte[] buffer = new byte[1024];
                        int count;
                        while ((count = input.read(buffer)) != -1) {
                            if (output.size() + count > 8192) throw new IllegalArgumentException("Oversized update metadata");
                            output.write(buffer, 0, count);
                        }
                        JSONObject metadata = new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
                        newer = newerBuild(metadata.optString("build", ""), installed);
                    }
                }
            } catch (Exception ignored) {
                // Offline, missing metadata, or an unavailable release never blocks listening.
            } finally {
                if (connection != null) connection.disconnect();
            }
            final int result = newer;
            activity.runOnUiThread(() -> {
                checking = false;
                if (activity.isDestroyed() || activity.isFinishing()) return;
                if (result > 0) availableBuild = result;
                if (resumed && availableBuild > dismissedBuild) show(availableBuild);
            });
        });
    }

    static int newerBuild(String value, int installed) {
        if (!value.matches("[1-9][0-9]{0,9}")) return 0;
        try {
            int build = Integer.parseInt(value);
            return build > installed ? build : 0;
        } catch (NumberFormatException ignored) { return 0; }
    }

    static Intent downloadIntent(int build) {
        return new Intent(Intent.ACTION_VIEW, Uri.parse(RELEASE + "SONIX-build-" + build + ".apk"));
    }

    void show(int build) {
        if (activity.isFinishing() || activity.isDestroyed() || (dialog != null && dialog.isShowing())) return;
        dialog = new AlertDialog.Builder(activity)
            .setTitle("Update available")
            .setMessage("A new version of SONIX is ready. Download it, then open the APK and confirm Update. Your saved library stays in your account.")
            .setPositiveButton("Update now", (prompt, which) -> {
                dismissedBuild = build;
                try { activity.startActivity(downloadIntent(build)); }
                catch (ActivityNotFoundException ignored) {
                    dismissedBuild = 0;
                    Toast.makeText(activity, "Install or enable a browser to download the update.", Toast.LENGTH_LONG).show();
                }
            })
            .setNegativeButton("Later", (prompt, which) -> dismissedBuild = build)
            .setOnCancelListener(prompt -> dismissedBuild = build)
            .create();
        dialog.show();
    }

    void pause() { resumed = false; }

    void close() {
        resumed = false;
        if (dialog != null) dialog.dismiss();
        worker.shutdownNow();
    }
}
