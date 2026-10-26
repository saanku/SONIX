package io.github.saanku.sonix;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    final AppUpdates updates = new AppUpdates(this);

    @Override
    public void onResume() {
        super.onResume();
        updates.resume();
    }

    @Override
    public void onPause() {
        updates.pause();
        super.onPause();
    }

    @Override
    public void onDestroy() {
        updates.close();
        super.onDestroy();
    }
}
