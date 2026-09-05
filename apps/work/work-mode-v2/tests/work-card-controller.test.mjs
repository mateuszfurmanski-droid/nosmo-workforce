import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createLocalWorkCardStore } from "../local-work-card-store.mjs";
import { createWorkCardV2Controller } from "../work-card-v2-controller.mjs";

const registry = JSON.parse(
  await readFile(new URL("../construction-app-registry.json", import.meta.url), "utf8")
);

function memoryStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    dump() { return Object.fromEntries(map.entries()); },
  };
}

const storage = memoryStorage();
const localStore = createLocalWorkCardStore(storage);
const installed = new Set(["com.whatsapp", "com.google.android.apps.docs"]);

let networkCalls = 0;
globalThis.fetch = async () => { networkCalls++; throw new Error("NETWORK_FORBIDDEN"); };
globalThis.XMLHttpRequest = class { constructor() { networkCalls++; throw new Error("XHR_FORBIDDEN"); } };
globalThis.WebSocket = class { constructor() { networkCalls++; throw new Error("WEBSOCKET_FORBIDDEN"); } };
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { sendBeacon() { networkCalls++; throw new Error("BEACON_FORBIDDEN"); } },
});

const controller = createWorkCardV2Controller({
  registry,
  discoveryAdapter: {
    async probeInstalled({ identifier }) {
      return installed.has(identifier);
    },
  },
  localStore,
  now: () => "2026-08-27T18:45:00.000Z",
});

const suggestions = await controller.discover();
assert.equal(networkCalls, 0);
assert.deepEqual(
  suggestions.map(item => item.appDefinitionId).sort(),
  ["google-drive", "whatsapp"]
);

assert.equal(controller.listTiles().length, 0, "Detection alone must create no tile");

controller.decide("whatsapp", "NOT_NOW");
assert.equal(controller.listTiles().length, 0, "Not now must create no tile");

await controller.discover();
controller.decide("google-drive", "ADD");
assert.equal(controller.listTiles().length, 1);
assert.equal(controller.listTiles()[0].appDefinitionId, "google-drive");
assert.equal(controller.listTiles()[0].connectionLevel, "OPEN");

await controller.discover();
controller.decide("whatsapp", "NEVER_SUGGEST");
const afterNever = await controller.discover();
assert.equal(afterNever.some(item => item.appDefinitionId === "whatsapp"), false);

const privacy = controller.privacySnapshot();
assert.equal(privacy.installedAppInventoryIncluded, false);
assert.equal(privacy.connectedAccounts.length, 0);
assert.equal(privacy.consentGrants.length, 0);

const safeExport = controller.exportSafeLocalState();
assert.equal(safeExport.installedAppInventoryIncluded, false);
const serialized = JSON.stringify(safeExport);
assert.equal(serialized.includes("com.whatsapp"), false);
assert.equal(serialized.includes("com.google.android.apps.docs"), false);
assert.equal(serialized.includes("com.microsoft.teams"), false);

controller.removeTile("google-drive");
assert.equal(controller.listTiles().length, 0);

console.log("WORK_CARD_V2_LOCAL_CONTROLLER_PASS");
