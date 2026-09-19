import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { sitesIdentityAllowed } from "../app/sites-identity-policy.mjs";
import { secureWorkerRequest } from "../app/worker-security.ts";

test("Vercel cannot use caller-supplied Sites identity", () => {
  assert.equal(sitesIdentityAllowed({ VERCEL: "1" }), false);
  assert.equal(sitesIdentityAllowed({ VERCEL_ENV: "preview" }), false);
  assert.equal(sitesIdentityAllowed({ VERCEL_ENV: "production" }), false);
  assert.equal(sitesIdentityAllowed({}), true);
});

test("actual oversized stream is denied without Content-Length", async () => {
  let called = false;
  const request = new Request("https://worker.example/api/worker/status", {
    method: "PATCH", headers: { origin: "https://worker.example" },
    body: new ReadableStream({ start(c) { c.enqueue(new Uint8Array(70 * 1024)); c.close(); } }),
    duplex: "half",
  });
  assert.equal(request.headers.has("content-length"), false);
  const result = await secureWorkerRequest(request, ["status"], async () => {
    called = true; return Response.json({});
  });
  assert.equal(result.status, 413);
  assert.equal(called, false);
});

test("body measurement preserves a valid request for the handler", async () => {
  const request = new Request("https://worker.example/api/worker/status", {
    method: "PATCH", headers: { origin: "https://worker.example" },
    body: JSON.stringify({ status: "busy" }),
  });
  const result = await secureWorkerRequest(request, ["status"], async () => Response.json(await request.json()));
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { status: "busy" });
});

test("changing spoofed identities cannot reset the Vercel rate bucket", async () => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = "1";
  try {
    let result;
    for (let i = 0; i < 121; i++) {
      const request = new Request("https://worker.example/api/worker/status", {
        headers: { "oai-authenticated-user-email": `fake-${i}@example.invalid`, "x-forwarded-for": "192.0.2.81" },
      });
      result = await secureWorkerRequest(request, ["status"], async () => Response.json({}));
    }
    assert.equal(result.status, 429);
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});

test("all Worker data handlers reject spoofed Vercel identity before database access", () => {
  const moduleUrl = new URL("../app/worker-server.ts", import.meta.url).href;
  const code = `import { handleWorkerRequest } from ${JSON.stringify(moduleUrl)};
    const cases = [["GET","status"],["PATCH","status"],["POST","connection/preview"],["POST","connection"]];
    const statuses = [];
    for (const [method,path] of cases) {
      const request = new Request("https://worker.example/api/worker/"+path, {
        method, headers: {origin:"https://worker.example", "oai-authenticated-user-email":"spoof@example.invalid"},
        ...(method === "GET" ? {} : {body:"{}"})
      });
      statuses.push((await handleWorkerRequest(request,path.split("/"))).status);
    }
    console.log(JSON.stringify(statuses));`;
  const child = spawnSync(process.execPath, ["--experimental-transform-types", "--input-type=module", "-e", code], {
    encoding: "utf8", timeout: 15_000,
    env: { ...process.env, VERCEL: "1", DATABASE_URL: "", NEXUS_IDENTITY_PEPPER: "" },
  });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), [401, 401, 401, 401]);
});
