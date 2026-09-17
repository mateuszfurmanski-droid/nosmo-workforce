import assert from "node:assert/strict";
import test from "node:test";

import {
  agencyNexusIntents,
  runAgencyNexusQuery,
} from "../agency-nexus.mjs";

const NOW = "2026-09-04T12:00:00.000Z";

function fixture() {
  return {
    candidates: [
      {
        agencyId: "agency-alpha",
        sharingStatus: "ACTIVE",
        personId: "person-alice",
        name: "Alice Joiner",
        trade: "Joiner",
        locations: ["Leeds"],
        availability: {
          status: "Available",
          label: "Available",
          availableFrom: null,
        },
        availabilityConfirmedAt: "2026-09-02T09:00:00.000Z",
        skills: ["Joinery"],
        targetRoles: ["Joiner"],
        licences: ["CSCS"],
        licenceReviews: [
          { name: "CSCS", expiresAt: "2026-12-20T00:00:00.000Z" },
        ],
        readiness: { cv: "ready", certificates: "ready", references: "ready" },
        updatedAt: "2026-09-02T09:00:00.000Z",
      },
      {
        agencyId: "agency-alpha",
        sharingStatus: "ACTIVE",
        personId: "person-eve",
        name: "Eve Electrician",
        trade: "Electrician",
        locations: ["Leeds"],
        availability: { status: "Busy", label: "Busy", availableFrom: null },
        skills: ["Electrical"],
        licences: ["ECS"],
        licenceReviews: [
          { name: "ECS", expiresAt: "2026-09-20T00:00:00.000Z" },
        ],
        readiness: { cv: "ready", certificates: "ready", references: "ready" },
        updatedAt: "2026-09-03T09:00:00.000Z",
      },
      {
        agencyId: "agency-alpha",
        sharingStatus: "REVOKED",
        personId: "person-revoked",
        name: "Private Revoked Name",
        trade: "Private revoked trade",
        locations: ["Private location"],
        availability: { status: "Available", label: "Available" },
        skills: ["private revoked skill"],
        licences: ["private revoked licence"],
        updatedAt: "2026-09-04T09:00:00.000Z",
      },
      {
        agencyId: "agency-beta",
        sharingStatus: "ACTIVE",
        personId: "person-beta",
        name: "Beta Agency Worker",
        trade: "Joiner",
        locations: ["Leeds"],
        availability: { status: "Available", label: "Available" },
        skills: ["Joinery"],
        licences: ["CSCS"],
        readiness: { cv: "ready", certificates: "ready", references: "ready" },
        updatedAt: "2026-09-04T10:00:00.000Z",
      },
    ],
    rosterWorkers: [
      {
        agencyId: "agency-alpha",
        rosterWorkerId: "roster-imported",
        linkedPersonId: null,
        sharingStatus: "PENDING",
        name: "Agency Imported Worker",
        trade: "Painter",
        location: "Leeds",
        availability: { status: "Unknown", label: "Unknown" },
        skills: ["Painting"],
        licences: [],
        licenceReviews: [],
        connectionStatus: "IMPORTED",
        updatedAt: "2026-09-01T08:00:00.000Z",
      },
      {
        agencyId: "agency-alpha",
        rosterWorkerId: "roster-revoked",
        linkedPersonId: "person-revoked",
        sharingStatus: "REVOKED",
        name: "Agency Retained Record",
        trade: "Agency recorded trade",
        location: "Bradford",
        availability: { status: "Unknown", label: "Unknown" },
        skills: [],
        licences: [],
        licenceReviews: [],
        connectionStatus: "DECLINED",
        updatedAt: "2026-09-01T07:00:00.000Z",
      },
      {
        agencyId: "agency-beta",
        rosterWorkerId: "roster-beta",
        sharingStatus: "PENDING",
        name: "Beta Roster Secret",
        trade: "Joiner",
        location: "Leeds",
        availability: { status: "Available", label: "Available" },
        skills: ["Joinery"],
        licences: ["CSCS"],
        connectionStatus: "IMPORTED",
        updatedAt: "2026-09-03T08:00:00.000Z",
      },
    ],
    requests: [
      {
        agencyId: "agency-alpha",
        requestId: "request-leeds",
        role: "Site Joiner",
        client: "Alpha Build",
        location: "Leeds",
        status: "OPEN",
        startDate: "2026-09-07",
        skills: ["Joinery"],
        licences: ["CSCS"],
        updatedAt: "2026-09-03T10:00:00.000Z",
      },
      {
        agencyId: "agency-beta",
        requestId: "request-beta",
        role: "Beta Secret Role",
        client: "Beta Client",
        location: "Leeds",
        status: "OPEN",
        skills: ["Joinery"],
        licences: ["CSCS"],
        updatedAt: "2026-09-04T10:00:00.000Z",
      },
    ],
    applications: [
      {
        agencyId: "agency-alpha",
        applicationId: "application-alice",
        requestId: "request-leeds",
        personId: "person-alice",
        rosterWorkerId: null,
        workerName: "Alice Joiner",
        stage: "CONTACTED",
        readinessStatus: "READY",
        readinessReasons: ["all visible requirements met"],
        nextAction: "Await candidate response",
        lastContactAt: "2026-08-20T10:00:00.000Z",
        updatedAt: "2026-08-20T10:00:00.000Z",
      },
      {
        agencyId: "agency-alpha",
        applicationId: "application-interview",
        requestId: "request-leeds",
        personId: null,
        rosterWorkerId: "roster-imported",
        workerName: "Agency Imported Worker",
        stage: "INTERVIEW",
        readinessStatus: "CHECK",
        readinessReasons: ["not worker-confirmed"],
        nextAction: "Record interview outcome",
        updatedAt: "2026-08-29T10:00:00.000Z",
      },
      {
        agencyId: "agency-alpha",
        applicationId: "application-offer",
        requestId: "request-leeds",
        personId: "person-eve",
        rosterWorkerId: null,
        workerName: "Eve Electrician",
        stage: "OFFERED",
        readinessStatus: "BLOCKED",
        readinessReasons: ["worker busy"],
        nextAction: "Confirm placement details",
        updatedAt: "2026-09-01T10:00:00.000Z",
      },
      {
        agencyId: "agency-beta",
        applicationId: "application-beta",
        requestId: "request-beta",
        personId: "person-beta",
        stage: "CONTACTED",
        readinessStatus: "READY",
        readinessReasons: [],
        nextAction: "Await response",
        updatedAt: "2026-09-04T10:00:00.000Z",
      },
    ],
    placements: [
      {
        agencyId: "agency-alpha",
        placementId: "placement-alpha",
        requestId: "request-leeds",
        applicationId: "application-alice",
        role: "Site Joiner",
        client: "Alpha Build",
        location: "Leeds",
        status: "PLACED",
        startDate: "2026-09-07",
        payRate: null,
        billRate: 27,
        updatedAt: "2026-09-03T11:00:00.000Z",
      },
      {
        agencyId: "agency-beta",
        placementId: "placement-beta",
        requestId: "request-beta",
        applicationId: "application-beta",
        role: "Beta Secret Role",
        status: "PLACED",
        startDate: "2026-09-05",
        payRate: null,
        billRate: null,
        updatedAt: "2026-09-04T11:00:00.000Z",
      },
    ],
    pipelineEvents: [
      {
        agencyId: "agency-alpha",
        eventId: "contact-open-unconfirmed",
        requestId: "request-leeds",
        applicationId: "application-interview",
        eventType: "CONTACT_OPENED",
        details: { localMessageId: 101, channel: "WhatsApp", sent: false },
        createdAt: "2026-09-03T12:00:00.000Z",
      },
      {
        agencyId: "agency-alpha",
        eventId: "contact-open-confirmed",
        requestId: "request-leeds",
        applicationId: "application-alice",
        eventType: "CONTACT_OPENED",
        details: { localMessageId: 102, channel: "Email", sent: false },
        createdAt: "2026-09-02T12:00:00.000Z",
      },
      {
        agencyId: "agency-alpha",
        eventId: "contact-confirmed",
        requestId: "request-leeds",
        applicationId: "application-alice",
        eventType: "CONTACT_CONFIRMED",
        details: { localMessageId: 102, channel: "Email", explicitlyConfirmed: true },
        createdAt: "2026-09-02T12:05:00.000Z",
      },
      {
        agencyId: "agency-beta",
        eventId: "event-beta-secret",
        requestId: "request-beta",
        applicationId: "application-beta",
        eventType: "CONTACT_OPENED",
        details: { localMessageId: 999, sent: false },
        createdAt: "2026-09-04T11:00:00.000Z",
      },
    ],
    rosterEvents: [],
    candidateEvents: [],
  };
}

function query(question, context = {}) {
  return runAgencyNexusQuery({
    tenantId: "agency-alpha",
    query: question,
    context,
    snapshot: fixture(),
    now: NOW,
  });
}

test("recognises every V1.0024 supported operational question", () => {
  const cases = new Map([
    ["Who is available and ready for Leeds on Monday?", "AVAILABLE_AND_READY"],
    ["Who is ready for this request?", "READY_FOR_REQUEST"],
    ["Why is this worker blocked?", "WHY_BLOCKED"],
    ["Which licences expire in 30 days?", "LICENCES_EXPIRING"],
    ["Which OPEN requests have no READY candidates?", "OPEN_REQUESTS_NO_READY"],
    ["Who is waiting for a response?", "WAITING_FOR_RESPONSE"],
    ["Which candidates have been stuck in one stage the longest?", "STUCK_IN_STAGE"],
    ["Which interviews need an outcome?", "INTERVIEWS_NEED_OUTCOME"],
    ["Which offers need placement details?", "OFFERS_NEED_PLACEMENT"],
    ["Which placements start in the next 7 days?", "PLACEMENTS_STARTING"],
    ["Which placements are missing pay or bill rates?", "PLACEMENTS_MISSING_RATES"],
    ["Which contacts were opened but not confirmed as sent?", "CONTACTS_UNCONFIRMED"],
    ["Which imported workers are not connected to Worker App?", "IMPORTED_NOT_CONNECTED"],
    ["Show the latest activity for this request.", "LATEST_REQUEST_ACTIVITY"],
  ]);
  for (const [question, intent] of cases) {
    assert.equal(agencyNexusIntents.classifyIntent(question), intent, question);
  }
});
test("scopes every result to the authenticated agency", () => {
  for (const question of [
    "Find workers",
    "Who is waiting for a response?",
    "Which placements are missing pay or bill rates?",
    "Show the latest activity for this request.",
  ]) {
    const response = query(question, { requestId: "request-leeds" });
    const serialized = JSON.stringify(response);
    assert.doesNotMatch(serialized, /Beta Agency Worker|Beta Roster Secret|Beta Secret Role|request-beta/);
  }
});

test("keeps Ask Nexus read-only and leaves the source snapshot untouched", () => {
  const snapshot = fixture();
  const before = structuredClone(snapshot);
  const response = runAgencyNexusQuery({
    tenantId: "agency-alpha",
    query: "Who is ready for this request?",
    context: { requestId: "request-leeds" },
    snapshot,
    now: NOW,
  });
  assert.equal(response.writePerformed, false);
  assert.deepEqual(snapshot, before);
  assert.ok(response.suggestedActions.every((item) => item.writePerformed === false));
});

test("never exposes revoked Worker App fields", () => {
  const response = query("Find workers");
  const serialized = JSON.stringify(response);
  assert.doesNotMatch(serialized, /Private Revoked Name|Private revoked trade|private revoked skill|private revoked licence|Private location/);
  assert.match(serialized, /Agency Retained Record/);
  assert.match(serialized, /Agency roster/);
});

test("returns source, freshness and readiness reasons for live matches", () => {
  const response = query("Who is ready for this request?", {
    requestId: "request-leeds",
  });
  const ready = response.resultGroups.find((group) => group.id === "ready")?.results[0];
  assert.equal(response.supported, true);
  assert.equal(response.writePerformed, false);
  assert.equal(ready?.title, "Alice Joiner");
  assert.equal(ready?.readiness, "READY");
  assert.deepEqual(ready?.readinessReasons, ["all visible requirements met"]);
  assert.ok(ready?.sources.includes("Worker App · recruiter-safe"));
  assert.ok(ready?.sources.includes("Request"));
  assert.ok(ready?.updatedAt);
  assert.ok(response.dataFreshness.checkedAt);
  assert.ok(response.evidence.length >= 2);
});

test("shows every visible gap instead of inventing a recommendation", () => {
  const response = query("Why is this worker blocked?", {
    requestId: "request-leeds",
    personId: "person-eve",
  });
  const result = response.resultGroups[0]?.results[0];
  assert.equal(result?.readiness, "BLOCKED");
  assert.match(result?.readinessReasons.join(" ") || "", /worker busy/i);
  assert.match(result?.missing.join(" ") || "", /Joinery|CSCS/);
});

test("unsupported questions return no fabricated records", () => {
  const response = query("What will the weather be on site?");
  assert.equal(response.intent, "UNSUPPORTED");
  assert.equal(response.supported, false);
  assert.equal(response.resultGroups.length, 0);
  assert.equal(response.writePerformed, false);
  assert.match(response.answer, /not supported yet/i);
});

test("treats opened external contact as not SENT until explicit confirmation", () => {
  const response = query("Which contacts were opened but not confirmed as sent?");
  const serialized = JSON.stringify(response);
  assert.equal(response.dataFreshness.resultCount, 1);
  assert.match(serialized, /Agency Imported Worker/);
  assert.match(serialized, /OPENED · NOT SENT/);
  assert.doesNotMatch(serialized, /Alice Joiner/);
  assert.equal(response.writePerformed, false);
});

test("reports expiring evidence and missing placement rates from stored data", () => {
  const expiry = query("Which licences expire in 30 days?");
  assert.match(JSON.stringify(expiry), /Eve Electrician/);
  assert.match(JSON.stringify(expiry), /ECS/);
  const rates = query("Which placements are missing pay or bill rates?");
  assert.equal(rates.dataFreshness.resultCount, 1);
  assert.match(JSON.stringify(rates), /pay rate/);
  assert.doesNotMatch(JSON.stringify(rates), /placement-beta/);
});
