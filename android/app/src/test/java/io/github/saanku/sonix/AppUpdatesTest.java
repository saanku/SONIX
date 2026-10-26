package io.github.saanku.sonix;

import org.junit.Test;
import static org.junit.Assert.assertEquals;

public class AppUpdatesTest {
    @Test public void onlyNewerBuildsPrompt() {
        assertEquals(13, AppUpdates.newerBuild("13", 12));
        assertEquals(0, AppUpdates.newerBuild("12", 12));
        assertEquals(0, AppUpdates.newerBuild("11", 12));
    }

    @Test public void malformedMetadataNeverPrompts() {
        for (String value : new String[]{"", "-1", "0", "1.5", "1e3", "9999999999", "null", "13.apk", " 13"}) {
            assertEquals(value, 0, AppUpdates.newerBuild(value, 12));
        }
    }
}
