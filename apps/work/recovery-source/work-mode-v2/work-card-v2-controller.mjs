import {
  SUGGESTION_STATES,
  applySuggestionDecision,
  createWorkCardAppTile,
} from "./contracts.mjs";
import { discoverSupportedApps } from "./local-discovery.mjs";

export function createWorkCardV2Controller({
  registry,
  discoveryAdapter,
  localStore,
  now = () => new Date().toISOString(),
}) {
  if (!registry) throw new Error("REGISTRY_REQUIRED");
  if (!discoveryAdapter || typeof discoveryAdapter.probeInstalled !== "function") {
    throw new Error("LOCAL_DISCOVERY_ADAPTER_REQUIRED");
  }
  if (!localStore) throw new Error("LOCAL_STORE_REQUIRED");

  let transientDetected = new Map();

  function appDefinition(appDefinitionId) {
    const app = registry.apps.find(item => item.appDefinitionId === appDefinitionId);
    if (!app) throw new Error("UNKNOWN_APP_DEFINITION");
    return app;
  }

  async function discover() {
    const decisions = localStore.loadDecisions();
    const states = await discoverSupportedApps({
      registry,
      probeInstalled: discoveryAdapter.probeInstalled,
      now,
    });

    transientDetected = new Map();
    for (const state of states) {
      if (!state.detected) continue;
      const saved = decisions[state.appDefinitionId];
      if (saved?.suggestionState === SUGGESTION_STATES.NEVER_SUGGEST) continue;
      transientDetected.set(
        state.appDefinitionId,
        saved ? { ...state, suggestionState: saved.suggestionState } : state
      );
    }

    return [...transientDetected.values()];
  }

  function decide(appDefinitionId, decision) {
    const state = transientDetected.get(appDefinitionId);
    if (!state) throw new Error("APP_NOT_IN_CURRENT_LOCAL_DISCOVERY");

    const next = applySuggestionDecision(state, decision);
    localStore.saveDecision(appDefinitionId, {
      suggestionState: next.suggestionState,
      decidedAt: now(),
      deviceLocalOnly: true,
    });

    if (next.suggestionState === SUGGESTION_STATES.APPROVED) {
      const tile = createWorkCardAppTile({
        appDefinition: appDefinition(appDefinitionId),
        localState: next,
        approvedByUserAt: now(),
      });
      const existing = localStore.loadTiles().filter(item => item.appDefinitionId !== appDefinitionId);
      localStore.saveTiles([...existing, tile]);
    }

    transientDetected.set(appDefinitionId, next);
    return next;
  }

  function listTiles() {
    return localStore.loadTiles();
  }

  function removeTile(appDefinitionId) {
    const remaining = localStore.loadTiles().filter(item => item.appDefinitionId !== appDefinitionId);
    localStore.saveTiles(remaining);
    return remaining;
  }

  function privacySnapshot() {
    return {
      schema: "nosmo-work-card-privacy-connections-local/v1",
      tiles: listTiles(),
      connectedAccounts: [],
      consentGrants: [],
      activeSharedViews: [],
      installedAppInventoryIncluded: false,
      deviceLocalOnly: true,
    };
  }

  function exportSafeLocalState() {
    const safe = localStore.exportSafeState();
    return {
      schema: "nosmo-work-card-local-safe-export/v1",
      decisions: safe.decisions,
      tiles: safe.tiles,
      installedAppInventoryIncluded: false,
    };
  }

  return Object.freeze({
    discover,
    decide,
    listTiles,
    removeTile,
    privacySnapshot,
    exportSafeLocalState,
  });
}
