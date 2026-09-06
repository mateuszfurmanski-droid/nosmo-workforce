package tech.nosmo.personcard.workmodev2;

import android.content.Context;
import android.content.Intent;
import android.webkit.JavascriptInterface;

/**
 * Narrow bridge for a future Person Card native wrapper.
 *
 * JavaScript may ask about one controlled appDefinitionId at a time or launch
 * that same controlled app. Arbitrary package names are never accepted.
 */
public final class AndroidWorkCardDiscoveryBridge {
    private final Context appContext;
    private final ControlledAndroidDiscovery discovery;

    public AndroidWorkCardDiscoveryBridge(Context context) {
        if (context == null) throw new IllegalArgumentException("context required");
        this.appContext = context.getApplicationContext();
        this.discovery = new ControlledAndroidDiscovery(
            new AndroidPackageProbe(this.appContext.getPackageManager())
        );
    }

    @JavascriptInterface
    public boolean isSupportedAppInstalled(String appDefinitionId) {
        try {
            return discovery.isSupportedAppInstalled(appDefinitionId);
        } catch (IllegalArgumentException ignored) {
            return false;
        }
    }

    @JavascriptInterface
    public boolean launchSupportedApp(String appDefinitionId) {
        String packageName = SupportedAppPackages.packageIdFor(appDefinitionId);
        if (packageName == null) return false;

        Intent launchIntent = appContext.getPackageManager().getLaunchIntentForPackage(packageName);
        if (launchIntent == null) return false;

        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        appContext.startActivity(launchIntent);
        return true;
    }
}
