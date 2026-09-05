export function createAndroidWorkCardAdapter(
  bridge = globalThis.NOSMOWorkCardAndroid
) {
  if (!bridge) throw new Error("ANDROID_WORK_CARD_BRIDGE_UNAVAILABLE");

  return Object.freeze({
    async probeInstalled({ appDefinitionId }) {
      if (!appDefinitionId) throw new Error("APP_DEFINITION_ID_REQUIRED");
      return Boolean(bridge.isSupportedAppInstalled(appDefinitionId));
    },

    async open({ appDefinitionId }) {
      if (!appDefinitionId) throw new Error("APP_DEFINITION_ID_REQUIRED");
      return Boolean(bridge.launchSupportedApp(appDefinitionId));
    },
  });
}
