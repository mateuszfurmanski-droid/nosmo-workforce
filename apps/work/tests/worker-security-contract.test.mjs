import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.resolve(here, "..");
const read = (rel) => fs.readFileSync(path.join(workRoot, rel), "utf8");

const envExample = read(".env.example");
const workerServer = read("app/worker-server.ts");
const workerSecurity = read("app/worker-security.ts");
const workerRoute = read("app/api/worker/[...path]/route.ts");
const workerPage = read("app/page.tsx");
const workerLayout = read("app/layout.tsx");
const localPrivacy = read("app/local-privacy-control.tsx");

for (const key of ["DATABASE_URL", "NEXUS_IDENTITY_PEPPER", "OPENAI_API_KEY", "OPENAI_MODEL"]) {
  assert.match(envExample, new RegExp(`^${key}=`, "m"), `Worker runtime key ${key} missing from .env.example`);
}
assert.ok(!/postgres(?:ql)?:\/\/[^\s=]+:[^\s@]+@/i.test(envExample), "Worker .env.example must not contain a database credential");
assert.ok(!/\bsk-[A-Za-z0-9_-]{20,}\b/.test(envExample), "Worker .env.example must not contain an API credential");

assert.ok(workerRoute.includes("secureWorkerRequest"), "Worker API must pass through the security boundary");
assert.ok(workerRoute.includes("handleWorkerRequest"), "Worker API must use the canonical server handler");
assert.ok(workerServer.includes('request.headers.get("oai-authenticated-user-email")'), "Worker identity must come from authenticated Sites headers");
assert.ok(workerServer.includes("process.env.NEXUS_IDENTITY_PEPPER"), "Worker identity digest must require a server-side pepper");
assert.ok(workerServer.includes("identityDigest(identity.email)"), "Worker database identity must use the pseudonymous digest binding");
assert.ok(workerServer.includes("assertSameOrigin(request)"), "Worker write handler must enforce same-origin requests");

assert.ok(workerSecurity.includes("credentialsInUrl(request)"), "Worker security boundary must reject credentials in URLs");
for (const key of ["sid", "sessionId", "draftToken", "token", "authorization"]) {
  assert.ok(workerSecurity.includes(`\"${key}\"`), `Worker URL credential denylist missing ${key}`);
}
assert.ok(workerSecurity.includes("MAX_MUTATION_BYTES"), "Worker mutation body limit missing");
assert.ok(workerSecurity.includes("rateAllowed(request, path)"), "Worker API rate limiting missing");
assert.ok(workerSecurity.includes("mutationOriginAllowed(request)"), "Worker API origin gate missing");

assert.ok(workerPage.includes('credentials: "same-origin"'), "Worker client API calls must stay same-origin");
assert.ok(workerPage.includes('>("/connection/preview"'), "Worker invite preview must use the body-based preview endpoint");
assert.ok(workerPage.includes('body: JSON.stringify({ token })'), "Worker invite token must travel in a request body");
assert.ok(!workerPage.includes("/connection?token="), "Worker invite token must never be placed in a URL");
assert.ok(!/localStorage\.setItem\([^\n;]*(?:draftToken|inviteToken|sessionId|\bsid\b)/i.test(workerPage), "Worker authority/session material must not be persisted in localStorage");

assert.ok(workerLayout.includes("<LocalPrivacyControl />"), "Worker layout must mount the local-device privacy control");
assert.ok(localPrivacy.includes('document.querySelector(".settings-data-actions")'), "Clear-device control must live in the existing Data & privacy actions");
assert.ok(localPrivacy.includes('window.localStorage.clear()'), "Clear-device control must remove browser-local personal data");
assert.ok(localPrivacy.includes('window.sessionStorage.clear()'), "Clear-device control must remove ephemeral browser-local state");
assert.ok(localPrivacy.includes('deleteDatabase(LOCAL_DATABASE)'), "Clear-device control must remove the local file database");
assert.ok(localPrivacy.includes('const LOCAL_DATABASE = "mateusz-praca"'), "Clear-device control must target the canonical Worker IndexedDB database");
for (const retained of ["mateusz-theme", "nosmo-theme-preset", "nosmo-language"]) {
  assert.ok(localPrivacy.includes(`\"${retained}\"`), `Clear-device control should retain non-sensitive preference ${retained}`);
}
assert.ok(localPrivacy.includes("Server-side data and Agency consent will not be deleted."), "Clear-device confirmation must state its server-side boundary");
assert.ok(localPrivacy.includes("request.onblocked"), "IndexedDB deletion must fail visibly when another tab blocks it");
assert.ok(localPrivacy.includes('data-nosmo-clear-local-data="true"'), "Clear-device action needs a stable browser-QA selector");

console.log(JSON.stringify({
  schema: "nosmo-worker-security-contract/v1",
  status: "PASS",
  hostedRuntimeConfigDocumented: true,
  authenticatedSitesIdentity: true,
  pseudonymousIdentityBinding: true,
  sameOriginMutations: true,
  credentialUrlDenied: true,
  authorityNotPersistedInLocalStorage: true,
  clearDeviceControl: true,
  localFileDatabaseDeletion: true,
}, null, 2));
