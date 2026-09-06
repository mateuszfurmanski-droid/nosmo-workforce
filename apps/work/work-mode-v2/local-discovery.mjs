import { assertRegistry, createDetectedAppLocalState } from "./contracts.mjs";

/**
 * LocalAppDiscoveryAdapter contract.
 *
 * probeInstalled receives exactly one controlled platform identifier at a time.
 * This module contains no network transport and returns device-local state only.
 */
export async function discoverSupportedApps({ registry, platform = "android", probeInstalled, now = () => new Date().toISOString() }) {
  assertRegistry(registry);
  if (typeof probeInstalled !== "function") throw new Error("LOCAL_PROBE_REQUIRED");

  const results = [];
  for (const app of registry.apps) {
    if (!app.discoveryEnabled) continue;
    const identifiers = app.platforms?.[platform]?.packageIds || [];
    let detected = false;
    for (const identifier of identifiers) {
      if (await probeInstalled({ platform, identifier, appDefinitionId: app.appDefinitionId })) {
        detected = true;
        break;
      }
    }
    results.push(createDetectedAppLocalState({
      appDefinitionId: app.appDefinitionId,
      detected,
      detectedAt: now(),
    }));
  }
  return results;
}
