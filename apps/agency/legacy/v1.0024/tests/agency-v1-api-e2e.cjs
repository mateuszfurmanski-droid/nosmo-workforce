const assert = require("node:assert/strict");

const baseUrl = process.env.AGENCY_V1_E2E_BASE_URL || "http://127.0.0.1:8131";
const mainCookie = "sid=nosmo-ui-e2e-session";
const isolationCookie = "sid=agency-v1-isolation-session";
const canary = "TENANT B CANARY MUST NOT LEAK";

async function request(path, { cookie = mainCookie, method = "GET", body } = {}) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      cookie,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload, serialized: JSON.stringify(payload) };
}

function assertNoCanary(result, label) {
  assert.equal(
    result.serialized.includes(canary),
    false,
    `${label} leaked the second tenant canary`,
  );
}

async function main() {
  const health = await request("/api/person-card/agency/v1/_health", { cookie: "" });
  assert.equal(health.response.status, 200);
  assert.equal(health.payload.databaseReady, true);
  assert.equal(health.payload.tenantScopeSource, "authenticated-agency-membership");

  const dashboard = await request("/api/person-card/agency/v1/dashboard");
  assert.equal(dashboard.response.status, 200);
  assert.equal(dashboard.payload.agency.agencyId, "nosmo-ui-e2e-agency");
  assert.equal(Number(dashboard.payload.summary.rosterWorkers), 3);
  assert.equal(Number(dashboard.payload.summary.openRequests), 1);
  assert.equal(Number(dashboard.payload.summary.candidatesInPipeline), 3);
  assert.equal(Number(dashboard.payload.summary.readinessAttention), 2);
  assertNoCanary(dashboard, "dashboard");

  const roster = await request("/api/person-card/agency/v1/roster");
  assert.equal(roster.response.status, 200);
  assert.equal(roster.payload.count, 3);
  assert.equal(roster.payload.contactValuesIncluded, false);
  assert.equal(roster.payload.workers.every((worker) => !("normalized_email" in worker)), true);
  assert.equal(roster.payload.workers.every((worker) => !("normalized_phone" in worker)), true);
  assertNoCanary(roster, "roster");

  const rosterSearch = await request("/api/person-card/agency/v1/roster?q=Fire%20door");
  assert.equal(rosterSearch.response.status, 200);
  assert.equal(rosterSearch.payload.count, 1);
  assert.equal(rosterSearch.payload.workers[0].displayName, "Alex Turner V1 E2E");
  assertNoCanary(rosterSearch, "roster search");

  const requests = await request("/api/person-card/agency/v1/requests?status=OPEN");
  assert.equal(requests.response.status, 200);
  assert.equal(requests.payload.requests.length, 1);
  assert.equal(requests.payload.requests[0].requestId, "agency-v1-e2e-request");
  assertNoCanary(requests, "request list");

  const applications = await request(
    "/api/person-card/agency/v1/requests/agency-v1-e2e-request/applications",
  );
  assert.equal(applications.response.status, 200);
  assert.equal(applications.payload.explainableMatching, true);
  assert.equal(applications.payload.applications.length, 3);
  assert.deepEqual(
    applications.payload.applications.map((item) => item.readinessStatus),
    ["READY", "CHECK", "BLOCKED"],
  );
  assert.equal(Array.isArray(applications.payload.applications[0].matchReasons), true);
  assert.equal(Array.isArray(applications.payload.applications[1].matchGaps), true);
  assertNoCanary(applications, "applications");

  const pipelineUpdate = await request(
    "/api/person-card/agency/v1/applications/agency-v1-e2e-app-maya",
    {
      method: "PATCH",
      body: {
        stage: "INTERVIEW",
        readinessStatus: "CHECK",
        nextAction: "Confirm interview availability",
      },
    },
  );
  assert.equal(pipelineUpdate.response.status, 200);
  assert.equal(pipelineUpdate.payload.stage, "INTERVIEW");

  const placement = await request("/api/person-card/agency/v1/placements", {
    method: "POST",
    body: {
      applicationId: "agency-v1-e2e-app-alex",
      status: "PLACED",
      startDate: "2026-09-07",
      currency: "GBP",
      rateUnit: "HOURLY",
      payRateAmount: 22,
      billRateAmount: 28,
      notes: "Agency V1 E2E placement",
    },
  });
  assert.equal(placement.response.status, 201);
  assert.equal(placement.payload.placement.applicationId, "agency-v1-e2e-app-alex");
  assert.equal(placement.payload.placement.payRateAmount, 22);
  assert.equal(placement.payload.placement.billRateAmount, 28);

  const createdRequest = await request("/api/person-card/agency/v1/requests", {
    method: "POST",
    body: {
      agencyId: "agency-v1-isolation-tenant",
      role: "Carpenter",
      clientName: "Agency Scope E2E",
      location: "Leeds",
      status: "DRAFT",
      headcount: 1,
      requiredSkills: ["First fix"],
      requiredLicences: ["CSCS Blue"],
    },
  });
  assert.equal(createdRequest.response.status, 201);
  assert.equal(createdRequest.payload.request.role, "Carpenter");
  assert.equal(createdRequest.serialized.includes("agency-v1-isolation-tenant"), false);

  const notConnected = await request("/api/person-card/agency/v1/ask-nexus/query", {
    method: "POST",
    body: { question: "Which imported workers are not connected to Worker App?" },
  });
  assert.equal(notConnected.response.status, 200);
  assert.equal(notConnected.payload.tenantScoped, true);
  assert.equal(notConnected.payload.privateWorkerFieldsIncluded, false);
  assert.equal(notConnected.payload.answerType, "IMPORTED_NOT_CONNECTED");
  assert.equal(notConnected.payload.evidenceCount, 3);
  assertNoCanary(notConnected, "Ask Nexus not-connected query");

  const cscs = await request("/api/person-card/agency/v1/ask-nexus/query", {
    method: "POST",
    body: { question: "Which workers have CSCS?" },
  });
  assert.equal(cscs.response.status, 200);
  assert.equal(cscs.payload.answerType, "CSCS_WORKERS");
  assert.equal(cscs.payload.evidenceCount, 2);
  assertNoCanary(cscs, "Ask Nexus CSCS query");

  const matches = await request("/api/person-card/agency/v1/ask-nexus/query", {
    method: "POST",
    body: { question: "Show strongest matches for this role" },
  });
  assert.equal(matches.response.status, 200);
  assert.equal(matches.payload.answerType, "EXPLAINABLE_MATCHES");
  assert.equal(matches.payload.evidence.some((item) => Array.isArray(item.reasons)), true);
  assert.equal(matches.payload.evidence.some((item) => Array.isArray(item.gaps)), true);
  assertNoCanary(matches, "Ask Nexus match query");

  const expiry = await request("/api/person-card/agency/v1/ask-nexus/query", {
    method: "POST",
    body: { question: "Which documents are expiring?" },
  });
  assert.equal(expiry.payload.answerType, "DOCUMENT_EXPIRY_NOT_AVAILABLE");

  const workHistory = await request("/api/person-card/agency/v1/ask-nexus/query", {
    method: "POST",
    body: { question: "Who has worked in Leeds?" },
  });
  assert.equal(workHistory.payload.answerType, "WORK_HISTORY_NOT_AVAILABLE");

  const isolationRoster = await request("/api/person-card/agency/v1/roster", {
    cookie: isolationCookie,
  });
  assert.equal(isolationRoster.response.status, 200);
  assert.equal(isolationRoster.payload.agency.agencyId, "agency-v1-isolation-tenant");
  assert.equal(isolationRoster.payload.count, 1);
  assert.equal(isolationRoster.payload.workers[0].displayName, canary);
  assert.equal(isolationRoster.serialized.includes("Alex Turner V1 E2E"), false);

  const mainRosterAgain = await request("/api/person-card/agency/v1/roster");
  assert.equal(mainRosterAgain.payload.count, 3);
  assertNoCanary(mainRosterAgain, "main tenant recheck");

  console.log(
    "NOSMO_AGENCY_V1_API_E2E_PASS " +
      JSON.stringify({
        health: true,
        dashboard: true,
        rosterSearch: true,
        jobs: true,
        explainableMatching: true,
        pipelinePersistence: true,
        placementPersistence: true,
        askNexusTenantScoped: true,
        tenantIsolationTwoSessions: true,
        privateRosterContactValuesReturned: false,
      }),
  );
}

main().catch((error) => {
  console.error("NOSMO_AGENCY_V1_API_E2E_FAIL", error);
  process.exitCode = 1;
});
