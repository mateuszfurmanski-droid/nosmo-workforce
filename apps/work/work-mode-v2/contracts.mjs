export const CONNECTION_LEVELS = Object.freeze({
  OPEN: "OPEN",
  DEEP_LINK: "DEEP_LINK",
  CONNECTED: "CONNECTED",
});

export const SUGGESTION_STATES = Object.freeze({
  NEW: "new",
  SUGGESTED: "suggested",
  NOT_NOW: "not_now",
  NEVER_SUGGEST: "never_suggest",
  APPROVED: "approved",
});

export function assertRegistry(registry) {
  if (!registry || registry.schema !== "nosmo-construction-app-registry/v1") {
    throw new Error("INVALID_CONSTRUCTION_APP_REGISTRY");
  }
  const ids = new Set();
  for (const app of registry.apps || []) {
    if (!app.appDefinitionId || ids.has(app.appDefinitionId)) {
      throw new Error("INVALID_OR_DUPLICATE_APP_DEFINITION_ID");
    }
    ids.add(app.appDefinitionId);
    const packages = app.platforms?.android?.packageIds || [];
    if (app.discoveryEnabled) {
      if (app.identifierStatus !== "verified-controlled" || packages.length === 0) {
        throw new Error("DISCOVERY_REQUIRES_VERIFIED_CONTROLLED_IDENTIFIER");
      }
      if (
        app.identifierVerification?.sourceType !== "google-play-listing" ||
        !/^https:\/\/play\.google\.com\/store\/apps\/details\?id=/.test(app.identifierVerification?.sourceUrl || "") ||
        !app.identifierVerification?.verifiedAt
      ) {
        throw new Error("DISCOVERY_REQUIRES_IDENTIFIER_VERIFICATION_EVIDENCE");
      }
    }
    if (!Object.values(CONNECTION_LEVELS).includes(app.defaultConnectionLevel)) {
      throw new Error("INVALID_DEFAULT_CONNECTION_LEVEL");
    }
  }
  return true;
}

export function createDetectedAppLocalState({ appDefinitionId, detected, detectedAt = new Date().toISOString() }) {
  return {
    schema: "nosmo-detected-app-local-state/v1",
    appDefinitionId,
    detected: Boolean(detected),
    detectedAt,
    suggestionState: SUGGESTION_STATES.NEW,
    deviceLocalOnly: true,
  };
}

export function applySuggestionDecision(state, decision) {
  const next = { ...state };
  if (decision === "ADD") next.suggestionState = SUGGESTION_STATES.APPROVED;
  else if (decision === "NOT_NOW") next.suggestionState = SUGGESTION_STATES.NOT_NOW;
  else if (decision === "NEVER_SUGGEST") next.suggestionState = SUGGESTION_STATES.NEVER_SUGGEST;
  else throw new Error("INVALID_SUGGESTION_DECISION");
  return next;
}

export function createWorkCardAppTile({ appDefinition, localState, approvedByUserAt = new Date().toISOString() }) {
  if (!localState || localState.suggestionState !== SUGGESTION_STATES.APPROVED) {
    throw new Error("EXPLICIT_USER_APPROVAL_REQUIRED");
  }
  return {
    schema: "nosmo-work-card-app-tile/v1",
    tileId: `work-card-app:${appDefinition.appDefinitionId}`,
    appDefinitionId: appDefinition.appDefinitionId,
    label: appDefinition.displayName,
    connectionLevel: appDefinition.defaultConnectionLevel,
    addedByUserAt: approvedByUserAt,
    deviceLocalOnly: appDefinition.defaultConnectionLevel !== CONNECTION_LEVELS.CONNECTED,
  };
}

export function createConsentGrant({ consentGrantId, personId, appDefinitionId, exactScopes, purpose, grantedAt = new Date().toISOString(), expiresAt = null }) {
  if (!Array.isArray(exactScopes) || exactScopes.length === 0 || !purpose) {
    throw new Error("GRANULAR_SCOPE_AND_PURPOSE_REQUIRED");
  }
  return {
    schema: "nosmo-consent-grant/v1",
    consentGrantId,
    personId,
    appDefinitionId,
    exactScopes: [...exactScopes],
    purpose,
    grantedAt,
    expiresAt,
    revokedAt: null,
  };
}

export function createSharedView({ sharedViewId, personId, recipient, includedFields, purpose, createdAt = new Date().toISOString(), expiresAt = null }) {
  if (!recipient || !Array.isArray(includedFields) || includedFields.length === 0 || !purpose) {
    throw new Error("SHARED_VIEW_SCOPE_REQUIRED");
  }
  return {
    schema: "nosmo-shared-view/v1",
    sharedViewId,
    personId,
    recipient,
    includedFields: [...includedFields],
    purpose,
    createdAt,
    expiresAt,
    revokedAt: null,
  };
}

export function createConnectionAuditEvent({ eventId, appDefinitionId = null, eventType, actor = "worker", occurredAt = new Date().toISOString(), details = {} }) {
  const forbidden = ["installedApps", "installedAppInventory", "detectedApps", "packageInventory", "allPackages"];
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(details, key)) {
      throw new Error("INSTALLED_APP_INVENTORY_FORBIDDEN_IN_AUDIT");
    }
  }
  return {
    schema: "nosmo-connection-audit-event/v1",
    eventId,
    appDefinitionId,
    eventType,
    actor,
    occurredAt,
    details,
  };
}
