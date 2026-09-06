package tech.nosmo.personcard.workmodev2;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class ControlledAndroidDiscoveryTest {
    private static void require(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }

    public static void main(String[] args) {
        List<String> queried = new ArrayList<>();
        ControlledAndroidDiscovery discovery = new ControlledAndroidDiscovery(packageName -> {
            queried.add(packageName);
            return "com.whatsapp".equals(packageName);
        });

        require(discovery.isSupportedAppInstalled("whatsapp"), "WhatsApp should be detected");
        require(!discovery.isSupportedAppInstalled("microsoft-teams"), "Teams should be absent");

        boolean rejected = false;
        try {
            discovery.isSupportedAppInstalled("arbitrary-package");
        } catch (IllegalArgumentException expected) {
            rejected = true;
        }
        require(rejected, "Unknown appDefinitionId must fail closed");

        queried.clear();
        Map<String, Boolean> result = discovery.detectSupportedApps();
        require(result.size() == SupportedAppPackages.all().size(), "Only supported apps may be returned");
        require(queried.size() == SupportedAppPackages.all().size(), "Only allow-listed package IDs may be probed");
        require(queried.containsAll(SupportedAppPackages.all().values()), "Probe set must equal allow-list");
        require(result.get("whatsapp"), "WhatsApp state expected");
        require(!result.containsKey("arbitrary-package"), "Arbitrary app must never appear");

        System.out.println("ANDROID_CONTROLLED_DISCOVERY_PASS");
    }
}
