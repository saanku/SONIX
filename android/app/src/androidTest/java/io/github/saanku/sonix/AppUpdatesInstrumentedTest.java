package io.github.saanku.sonix;

import android.app.Activity;
import android.content.Intent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.click;
import static androidx.test.espresso.assertion.ViewAssertions.doesNotExist;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
import static androidx.test.espresso.matcher.ViewMatchers.withText;
import static org.junit.Assert.assertEquals;

@RunWith(AndroidJUnit4.class)
public class AppUpdatesInstrumentedTest {
    @Test public void updatePromptCanBeDismissedAndTargetsExactApk() {
        var instrumentation = InstrumentationRegistry.getInstrumentation();
        Intent launch = new Intent(instrumentation.getTargetContext(), MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Activity activity = instrumentation.startActivitySync(launch);
        AppUpdates updates = ((MainActivity) activity).updates;
        try {
            instrumentation.runOnMainSync(() -> updates.show(123));
            onView(withText("Update available")).check(matches(isDisplayed()));
            onView(withText("Update now")).check(matches(isDisplayed()));
            onView(withText("Later")).perform(click());
            onView(withText("Update available")).check(doesNotExist());
            Intent download = AppUpdates.downloadIntent(123);
            assertEquals(Intent.ACTION_VIEW, download.getAction());
            assertEquals("https://github.com/saanku/SONIX/releases/download/android-test/SONIX-build-123.apk", download.getDataString());
        } finally {
            instrumentation.runOnMainSync(() -> { updates.close(); activity.finish(); });
        }
    }
}
