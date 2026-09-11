import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const security = await readFile(new URL("../app/worker-security.ts", import.meta.url), "utf8");
const route = await readFile(
  new URL("../app/api/worker/[...path]/route.ts", import.meta.url),
  "utf8",
);
const nextConfig = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");

test("Worker API cannot bypass the security boundary", () => {
  assert.match(route, /secureWorkerRequest/);
  assert.match(route, /handleWorkerRequest/);
  assert.match(route, /secureWorkerRequest\(request, path/);
});

test("Worker browser mutations fail closed on missing or cross-origin Origin", () => {
  assert.match(security, /if \(!origin\) return false/);
  assert.match(security, /new URL\(origin\)\.origin === new URL\(request\.url\)\.origin/);
  assert.match(security, /NEXUS_ORIGIN_DENIED/);
});

test("Worker API has payload and abuse guards", () => {
  assert.match(security, /MAX_MUTATION_BYTES = 64 \* 1024/);
  assert.match(security, /GENERAL_LIMIT = 120/);
  assert.match(security, /CONNECTION_LIMIT = 30/);
  assert.match(security, /NEXUS_PAYLOAD_TOO_LARGE/);
  assert.match(security, /NEXUS_RATE_LIMITED/);
});

test("Worker API rejects session-style credentials in URLs", () => {
  for (const key of ["sid", "sessionId", "draftToken", "token", "authorization"]) {
    assert.ok(security.includes(`\"${key}\"`));
  }
  assert.match(security, /NEXUS_CREDENTIAL_IN_URL_DENIED/);
});

test("Worker host emits baseline browser security headers", () => {
  for (const header of [
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Cross-Origin-Opener-Policy",
    "Strict-Transport-Security",
  ]) {
    assert.ok(nextConfig.includes(header), `${header} missing from next.config.ts`);
  }
  assert.match(nextConfig, /source: "\/:path\*"/);
});
