import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("canonical Work source is the accepted Sites v93 recovery baseline", async () => {
  const manifest = JSON.parse(await read("source-manifest.json"));
  assert.equal(manifest.schema, "nosmo-work-source-manifest/v2");
  assert.equal(manifest.recoveryBaseline.versionNumber, 93);
  assert.equal(
    manifest.recoveryBaseline.commitSha,
    "a8dc178daaaea7328d8177a18c8cfb2bc3f5ae74",
  );

  for (const [path, expected] of Object.entries(manifest.recoveryBaseline.sha256)) {
    assert.equal(sha256(await read(path)), expected, `${path} differs from Sites v93`);
  }
});

test("canonical Work identity excludes wrong donor and Emergency integration", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  const page = await read("app/page.tsx");

  assert.equal(packageJson.displayName, "NOSMO Work");
  assert.doesNotMatch(page, /Person Card Freeware/i);
  assert.doesNotMatch(page, /Emergency Core/i);
  assert.doesNotMatch(page, /nec-launcher|nec-overlay/i);
});
