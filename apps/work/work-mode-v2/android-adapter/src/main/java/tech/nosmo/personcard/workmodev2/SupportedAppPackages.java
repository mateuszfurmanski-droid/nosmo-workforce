package tech.nosmo.personcard.workmodev2;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Generated/controlled allow-list matching discoveryEnabled Android entries in
 * construction-app-registry.json. Unknown appDefinitionId values are rejected.
 */
public final class SupportedAppPackages {
    private static final Map<String, String> PACKAGES;

    static {
        LinkedHashMap<String, String> map = new LinkedHashMap<>();
        map.put("whatsapp", "com.whatsapp");
        map.put("microsoft-teams", "com.microsoft.teams");
        map.put("google-drive", "com.google.android.apps.docs");
        map.put("microsoft-onedrive", "com.microsoft.skydrive");
        map.put("dropbox", "com.dropbox.android");
        PACKAGES = Collections.unmodifiableMap(map);
    }

    private SupportedAppPackages() {}

    public static String packageIdFor(String appDefinitionId) {
        return PACKAGES.get(appDefinitionId);
    }

    public static Set<String> appDefinitionIds() {
        return PACKAGES.keySet();
    }

    public static Map<String, String> all() {
        return PACKAGES;
    }
}
