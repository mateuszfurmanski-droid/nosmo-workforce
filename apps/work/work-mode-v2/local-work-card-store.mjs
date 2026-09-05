export function createLocalWorkCardStore(storage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
    throw new Error("LOCAL_STORAGE_ADAPTER_REQUIRED");
  }

  const DECISIONS_KEY = "nosmo-work-card-v2:decisions/v1";
  const TILES_KEY = "nosmo-work-card-v2:tiles/v1";

  function readJson(key, fallback) {
    try {
      const value = storage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    storage.setItem(key, JSON.stringify(value));
  }

  return Object.freeze({
    loadDecisions() {
      return readJson(DECISIONS_KEY, {});
    },
    saveDecision(appDefinitionId, decisionState) {
      const decisions = readJson(DECISIONS_KEY, {});
      decisions[appDefinitionId] = decisionState;
      writeJson(DECISIONS_KEY, decisions);
    },
    loadTiles() {
      return readJson(TILES_KEY, []);
    },
    saveTiles(tiles) {
      writeJson(TILES_KEY, tiles);
    },
    exportSafeState() {
      return {
        decisions: readJson(DECISIONS_KEY, {}),
        tiles: readJson(TILES_KEY, []),
      };
    },
  });
}
