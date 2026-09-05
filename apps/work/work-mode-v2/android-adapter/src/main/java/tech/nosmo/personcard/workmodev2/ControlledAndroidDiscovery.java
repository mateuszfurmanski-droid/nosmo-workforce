package tech.nosmo.personcard.workmodev2;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Pure-Java privacy boundary. It can probe only package identifiers already
 * present in SupportedAppPackages and therefore cannot enumerate the phone.
 */
public final class ControlledAndroidDiscovery {
    public interface PackageProbe {
        boolean isInstalled(String packageName);
    }

    private final PackageProbe probe;

    public ControlledAndroidDiscovery(PackageProbe probe) {
        if (probe == null) throw new IllegalArgumentException("probe required");
        this.probe = probe;
    }

    public boolean isSupportedAppInstalled(String appDefinitionId) {
        String packageName = SupportedAppPackages.packageIdFor(appDefinitionId);
        if (packageName == null) {
            throw new IllegalArgumentException("Unsupported appDefinitionId");
        }
        return probe.isInstalled(packageName);
    }

    public Map<String, Boolean> detectSupportedApps() {
        LinkedHashMap<String, Boolean> result = new LinkedHashMap<>();
        for (String appDefinitionId : SupportedAppPackages.appDefinitionIds()) {
            result.put(appDefinitionId, isSupportedAppInstalled(appDefinitionId));
        }
        return result;
    }
}
