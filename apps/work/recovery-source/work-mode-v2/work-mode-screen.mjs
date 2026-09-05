import { createWorkCardV2Controller } from "./work-card-v2-controller.mjs";
import { createLocalWorkCardStore } from "./local-work-card-store.mjs";
import { createAndroidWorkCardAdapter } from "./android-platform-adapter.mjs";
import { CONSTRUCTION_APP_REGISTRY } from "./construction-app-registry.mjs";

const PRIVACY_ACCEPTED_KEY = "nosmo-work-mode-v2:privacy-accepted/v1";
const PRIVACY_COPY = "App discovery happens only on this device. NOSMO does not upload or store a list of your installed apps.";

const CATEGORY_EXAMPLES = Object.freeze([
  { id: "bim-drawings", label: "BIM / drawings", hint: "Models, drawings and document viewers" },
  { id: "snagging", label: "Snagging", hint: "Defects, inspections and close-out" },
  { id: "site-forms", label: "Site forms", hint: "Checklists, permits and field forms" },
  { id: "timesheets", label: "Timesheets", hint: "Hours, shifts and attendance" },
  { id: "work-wallet", label: "Work Wallet", hint: "Worker credentials and work records" },
  { id: "cloud-storage", label: "Cloud storage", hint: "Drive, OneDrive and Dropbox" },
  { id: "communication", label: "Communication", hint: "Teams and messaging" },
  { id: "project-management", label: "Project management", hint: "Project and field-management apps" },
]);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function appDefinition(id) {
  return CONSTRUCTION_APP_REGISTRY.apps.find(app => app.appDefinitionId === id) || null;
}

function categoryLabel(category) {
  return String(category || "work-app").replace(/-/g, " ");
}

export function mountWorkModeScreen(root = document) {
  const screen = root.getElementById("workModeScreen");
  if (!screen || screen.dataset.mounted === "true") return;
  screen.dataset.mounted = "true";

  const categoryHost = root.getElementById("workModeCategories");
  const availableHost = root.getElementById("workModeAvailableApps");
  const tileHost = root.getElementById("workModeTiles");
  const detectedHost = root.getElementById("workModeDetectedApps");
  const scanButton = root.getElementById("scanWorkApps");
  const privacyButton = root.getElementById("workModePrivacyInfo");
  const privacyBackdrop = root.getElementById("workModePrivacyBackdrop");
  const closePrivacy = root.getElementById("closeWorkModePrivacy");
  const acceptAndScan = root.getElementById("acceptWorkModePrivacy");
  const privacySnapshotHost = root.getElementById("workModePrivacySnapshot");
  const statusHost = root.getElementById("workModeStatus");

  if (!categoryHost || !availableHost || !tileHost || !detectedHost || !scanButton || !privacyBackdrop) {
    throw new Error("WORK_MODE_UI_INCOMPLETE");
  }

  const localStore = createLocalWorkCardStore(globalThis.localStorage);
  let nativeAdapter = null;
  try {
    nativeAdapter = createAndroidWorkCardAdapter();
  } catch {
    nativeAdapter = null;
  }

  const safeAdapter = nativeAdapter || Object.freeze({
    async probeInstalled() { return false; },
    async open() { return false; },
  });

  const controller = createWorkCardV2Controller({
    registry: CONSTRUCTION_APP_REGISTRY,
    discoveryAdapter: safeAdapter,
    localStore,
  });

  let pendingScanAfterPrivacy = false;

  function setStatus(message) {
    statusHost.textContent = message;
  }

  function renderCategories() {
    categoryHost.innerHTML = CATEGORY_EXAMPLES.map(item =>
      '<article class="modeCategoryCard"><div class="modeCategoryIcon">' + esc(item.label.slice(0, 1)) + '</div>' +
      '<div><strong>' + esc(item.label) + '</strong><span>' + esc(item.hint) + '</span></div></article>'
    ).join("");
  }

  function renderAvailableApps() {
    availableHost.innerHTML = CONSTRUCTION_APP_REGISTRY.apps.map(app => {
      const scanState = app.discoveryEnabled
        ? '<span class="modeBadge ready">LOCAL SCAN READY</span>'
        : '<span class="modeBadge planned">AVAILABLE CATEGORY / PLANNED</span>';
      return '<article class="modeAppCard"><div class="modeAppTop"><div><strong>' + esc(app.displayName) + '</strong>' +
        '<span>' + esc(categoryLabel(app.category)) + '</span></div>' + scanState + '</div>' +
        '<p>' + (app.discoveryEnabled
          ? 'Can be checked locally by the controlled Android adapter. Detection alone does not add it.'
          : 'Shown as a supported work-app example. Local discovery stays disabled until its platform identifier is verified.') +
        '</p></article>';
    }).join("");
  }

  function renderTiles() {
    const tiles = controller.listTiles();
    if (!tiles.length) {
      tileHost.innerHTML = '<div class="modeEmpty">No apps added to Work Mode yet.</div>';
      return;
    }
    tileHost.innerHTML = tiles.map(tile => {
      const app = appDefinition(tile.appDefinitionId);
      const label = app?.displayName || tile.label || tile.appDefinitionId;
      return '<article class="modeAppCard added"><div class="modeAppTop"><div><strong>' + esc(label) + '</strong>' +
        '<span>' + esc(categoryLabel(app?.category)) + '</span></div><span class="modeBadge open">OPEN</span></div>' +
        '<p>Added by you. OPEN means launch only; NOSMO is not reading app content.</p>' +
        '<div class="modeActions"><button type="button" data-mode-open="' + esc(tile.appDefinitionId) + '">Open</button>' +
        '<button type="button" class="remove" data-mode-remove="' + esc(tile.appDefinitionId) + '">Remove from Work Mode</button></div></article>';
    }).join("");

    tileHost.querySelectorAll("[data-mode-open]").forEach(button => button.addEventListener("click", async () => {
      if (!nativeAdapter) {
        setStatus("Open is available in the Android wrapper. This browser preview does not launch installed apps.");
        return;
      }
      const opened = await nativeAdapter.open({ appDefinitionId: button.dataset.modeOpen });
      setStatus(opened ? "App opened from Work Mode." : "The app could not be opened on this device.");
    }));

    tileHost.querySelectorAll("[data-mode-remove]").forEach(button => button.addEventListener("click", () => {
      controller.removeTile(button.dataset.modeRemove);
      renderTiles();
      setStatus("Removed from Work Mode. No app was uninstalled and no server was notified.");
    }));
  }

  function renderDetected(states) {
    if (!states.length) {
      detectedHost.innerHTML = '<div class="modeEmpty">No supported work apps were detected in this scan.</div>';
      return;
    }
    detectedHost.innerHTML = states.map(state => {
      const app = appDefinition(state.appDefinitionId);
      return '<article class="modeAppCard detected"><div class="modeAppTop"><div><strong>' + esc(app?.displayName || state.appDefinitionId) + '</strong>' +
        '<span>' + esc(categoryLabel(app?.category)) + '</span></div><span class="modeBadge detectedBadge">DETECTED</span></div>' +
        '<p>Found locally on this device. Nothing is added until you choose it.</p>' +
        '<div class="modeActions"><button type="button" data-mode-add="' + esc(state.appDefinitionId) + '">Add to Work Mode</button>' +
        '<button type="button" class="quiet" data-mode-not-now="' + esc(state.appDefinitionId) + '">Not now</button></div></article>';
    }).join("");

    detectedHost.querySelectorAll("[data-mode-add]").forEach(button => button.addEventListener("click", () => {
      controller.decide(button.dataset.modeAdd, "ADD");
      renderTiles();
      button.closest(".modeAppCard")?.remove();
      setStatus("Added to Work Mode by your choice.");
    }));

    detectedHost.querySelectorAll("[data-mode-not-now]").forEach(button => button.addEventListener("click", () => {
      controller.decide(button.dataset.modeNotNow, "NOT_NOW");
      button.closest(".modeAppCard")?.remove();
      setStatus("Not added. You can scan again later.");
    }));
  }

  function updatePrivacySnapshot() {
    const snapshot = controller.privacySnapshot();
    privacySnapshotHost.innerHTML =
      '<div><span>Installed-app inventory uploaded</span><strong>NO</strong></div>' +
      '<div><span>Connected accounts</span><strong>' + snapshot.connectedAccounts.length + '</strong></div>' +
      '<div><span>Active shared views</span><strong>' + snapshot.activeSharedViews.length + '</strong></div>' +
      '<div><span>Added Work Mode apps</span><strong>' + snapshot.tiles.length + '</strong></div>';
  }

  function openPrivacy({ forScan = false } = {}) {
    pendingScanAfterPrivacy = forScan;
    if (acceptAndScan) acceptAndScan.textContent = forScan ? "I understand — Scan" : "I understand";
    updatePrivacySnapshot();
    privacyBackdrop.classList.add("open");
    privacyBackdrop.setAttribute("aria-hidden", "false");
  }

  function closePrivacySheet() {
    pendingScanAfterPrivacy = false;
    privacyBackdrop.classList.remove("open");
    privacyBackdrop.setAttribute("aria-hidden", "true");
  }

  async function performScan() {
    if (!nativeAdapter) {
      detectedHost.innerHTML = '<div class="modeEmpty">Android local app discovery is not available in this browser preview. No installed-app list was accessed or uploaded.</div>';
      setStatus("No scan was simulated. Install/run the Android wrapper to use local discovery.");
      return;
    }
    scanButton.disabled = true;
    scanButton.textContent = "Scanning locally…";
    try {
      const states = await controller.discover();
      renderDetected(states);
      setStatus(states.length
        ? states.length + " supported work app(s) detected locally."
        : "Local scan complete. No supported work apps detected.");
    } catch {
      setStatus("Local discovery could not run on this device.");
    } finally {
      scanButton.disabled = false;
      scanButton.textContent = "Scan for work apps";
    }
  }

  async function requestScan() {
    if (globalThis.localStorage.getItem(PRIVACY_ACCEPTED_KEY) !== "accepted") {
      openPrivacy({ forScan: true });
      return;
    }
    await performScan();
  }

  scanButton.addEventListener("click", requestScan);
  privacyButton?.addEventListener("click", () => openPrivacy({ forScan: false }));
  closePrivacy?.addEventListener("click", closePrivacySheet);
  privacyBackdrop.addEventListener("click", event => {
    if (event.target === privacyBackdrop) closePrivacySheet();
  });
  acceptAndScan?.addEventListener("click", async () => {
    globalThis.localStorage.setItem(PRIVACY_ACCEPTED_KEY, "accepted");
    const shouldScan = pendingScanAfterPrivacy;
    privacyBackdrop.classList.remove("open");
    privacyBackdrop.setAttribute("aria-hidden", "true");
    pendingScanAfterPrivacy = false;
    setStatus("Privacy notice accepted locally on this device.");
    if (shouldScan) await performScan();
  });

  renderCategories();
  renderAvailableApps();
  renderTiles();
  detectedHost.innerHTML = '<div class="modeEmpty">Scan when you want NOSMO to check the controlled supported-app list on this device.</div>';
  setStatus(nativeAdapter
    ? "Android local discovery is available. Nothing has been scanned yet."
    : "Browser preview: Work Mode UI is active; installed-app discovery requires the local Android bridge.");

  const copyHost = root.getElementById("workModePrivacyCopy");
  if (copyHost) copyHost.textContent = PRIVACY_COPY;
}

mountWorkModeScreen();
