package tech.nosmo.personcard.workmodev2;

import android.content.pm.PackageManager;
import android.os.Build;

/**
 * Android implementation using targeted package visibility only.
 * No network, analytics, logging or unrestricted package enumeration.
 */
public final class AndroidPackageProbe implements ControlledAndroidDiscovery.PackageProbe {
    private final PackageManager packageManager;

    public AndroidPackageProbe(PackageManager packageManager) {
        if (packageManager == null) throw new IllegalArgumentException("packageManager required");
        this.packageManager = packageManager;
    }

    @Override
    public boolean isInstalled(String packageName) {
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                packageManager.getApplicationInfo(
                    packageName,
                    PackageManager.ApplicationInfoFlags.of(0)
                );
            } else {
                packageManager.getApplicationInfo(packageName, 0);
            }
            return true;
        } catch (PackageManager.NameNotFoundException | SecurityException ignored) {
            return false;
        }
    }
}
