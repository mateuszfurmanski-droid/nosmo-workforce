import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const runtime = path.resolve(here, "..");
const repo = path.resolve(runtime, "../../..");

const files = {
  agencyOnboarding: path.join(runtime, "api/person-card/onboarding/[...path].js"),
  agencyAvailability: path.join(runtime, "api/person-card/onboarding/availability.js"),
  workerPage: path.join(repo, "apps/work/app/page.tsx"),
  workerServer: path.join(repo, "apps/work/app/worker-server.ts"),
  workerRoute: path.join(repo, "apps/work/app/api/worker/[...path]/route.ts"),
};

for (const file of Object.values(files)) {
  assert.ok(fs.existsSync(file), `missing handoff file: ${path.relative(repo, file)}`);
}

const agencyOnboarding = fs.readFileSync(files.agencyOnboarding, "utf8");
const agencyAvailability = fs.readFileSync(files.agencyAvailability, "utf8");
const workerPage = fs.readFileSync(files.workerPage, "utf8");
const workerServer = fs.readFileSync(files.workerServer, "utf8");
const workerRoute = fs.readFileSync(files.workerRoute, "utf8");

assert.ok(agencyOnboarding.includes("WORK_APP_BASE_URL"), "Agency invite must use the configured Work deployment");
assert.ok(agencyOnboarding.includes("NEXUS_ONBOARDING_PUBLIC_ORIGINS"), "Agency onboarding origin allowlist missing");
assert.ok(agencyOnboarding.includes("'RECRUITER_SAFE'"), "Agency recruiter-safe scope missing");
assert.ok(agencyOnboarding.includes("privateDocumentsIncluded:false"), "Agency must not expose private documents");
assert.ok(agencyOnboarding.includes("contactDetailsIncluded:false"), "Agency must not expose private contact details");
assert.ok(agencyOnboarding.includes("cvTextIncluded:false"), "Agency must not expose private CV text");
assert.ok(agencyOnboarding.includes("shareWithInvitingAgency"), "Agency explicit-consent gate missing");

assert.ok(agencyAvailability.includes("nexus-person-work-availability-sync/v1"), "Agency availability contract missing");
assert.ok(agencyAvailability.includes("privateWorkerFieldsIncluded:false"), "Status sync must exclude private Worker fields");
assert.ok(agencyAvailability.includes("WORK_APP_BASE_URL"), "Agency availability endpoint must enforce Worker origin");

assert.ok(workerRoute.includes("handleWorkerRequest"), "Worker API route must use the canonical server handler");
assert.ok(workerServer.includes('request.headers.get("oai-authenticated-user-email")'), "Worker identity must come from verified auth headers");
assert.ok(workerServer.includes("process.env.NEXUS_IDENTITY_PEPPER"), "Worker identity binding must be pseudonymous");
for (const status of ["available", "busy", "ready_on_date"]) {
  assert.ok(workerServer.includes(`value === "${status}"`), `Worker status ${status} missing`);
}
assert.ok(workerServer.includes("NEXUS_INVITE_ALREADY_USED"), "Worker invite must be one-time");
assert.ok(workerServer.includes("NEXUS_INVITE_EXPIRED"), "Worker invite expiry gate missing");
assert.ok(workerServer.includes('scope: "RECRUITER_SAFE"'), "Worker recruiter-safe consent scope missing");
assert.ok(workerServer.includes("WORKER_INVITE_ACCEPTED"), "Worker consent source must be recorded");
assert.ok(workerServer.includes("assertSameOrigin(request)"), "Worker write routes need same-origin protection");
assert.ok(workerServer.includes("connectedAgencies"), "Worker status response must resolve consented agencies");

assert.ok(workerPage.includes('credentials: "same-origin"'), "Worker API requests must remain same-origin");
assert.ok(workerPage.includes('>("/status")'), "Worker must load the canonical status");
assert.ok(workerPage.includes('>("/connection/preview"'), "Worker must preview an invite before consent without URL credentials");
assert.ok(workerPage.includes('body: JSON.stringify({ token: normalizedToken })'), "Worker invite preview token must travel in the request body");
assert.ok(!workerPage.includes('/connection?token='), "Worker invite token must not be placed in a URL");
assert.ok(!workerPage.includes('.get("connect")'), "Worker must not recover invitation authority from browser query parameters");
assert.ok(!workerPage.includes('/?connect='), "Worker sign-in return path must not carry invitation authority");
assert.ok(workerPage.includes('type="password"'), "Worker must provide an in-page invitation code field");
assert.ok(workerPage.includes('workerApi("/connection"'), "Worker must accept the reviewed invite");
assert.ok(workerPage.includes("Approve recruiter-safe Work Profile access"), "Worker consent copy missing");
assert.ok(workerPage.includes("Future status changes update automatically"), "Post-consent status sync copy missing");
assert.ok(!workerPage.includes("Person Card Freeware"), "Retired Person Card donor returned to Worker");
assert.ok(!workerPage.includes("Emergency Core"), "Emergency must remain outside Worker");

console.log(JSON.stringify({
  schema: "nosmo-worker-agency-handoff-contract/v2",
  configuredWorkerOrigin: true,
  authenticatedWorkerIdentity: true,
  oneTimeInvite: true,
  explicitConsentRequired: true,
  recruiterSafeProjection: true,
  privateWorkerFieldsExcluded: true,
  canonicalAvailabilityStates: 3,
  postConsentStatusSync: true,
}, null, 2));
