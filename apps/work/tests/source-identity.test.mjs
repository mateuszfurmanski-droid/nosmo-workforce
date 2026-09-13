import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

test("canonical Work release inherits the accepted Sites v93 recovery baseline", async () => {
  const manifest = JSON.parse(await read("source-manifest.json"));
  assert.equal(manifest.schema, "nosmo-work-source-manifest/v2");
  assert.equal(manifest.currentRelease.displayedVersion, "V1.0102");
  assert.equal(manifest.currentRelease.inheritsRecoveryBaseline, true);
  assert.equal(manifest.recoveryBaseline.versionNumber, 93);
  assert.equal(
    manifest.recoveryBaseline.commitSha,
    "a8dc178daaaea7328d8177a18c8cfb2bc3f5ae74",
  );

  assert.equal(manifest.recoveryBaseline.hashesDescribeImportedBaseline, true);
  for (const [path, expected] of Object.entries(manifest.recoveryBaseline.sha256)) {
    assert.match(path, /^(?:app\/|package-lock\.json)/);
    assert.match(expected, /^[a-f0-9]{64}$/);
  }
});

test("canonical Work release records the accepted Sites v95 live baseline", async () => {
  const manifest = JSON.parse(await read("source-manifest.json"));
  const accepted = manifest.acceptedLiveBaseline;

  assert.equal(accepted.versionNumber, 95);
  assert.equal(
    accepted.commitSha,
    "f6027c9ff045aa3dbd201d02a6089a3b11a3b774",
  );
  assert.equal(accepted.gitTree, "09e5dd42c2e3affbee26cd9ce43e9f48a2736643");
  assert.equal(accepted.displayedVersion, "V1.0102");
  assert.equal(accepted.emergencyIntegrationReverted, true);
  assert.equal(accepted.sourceRepositoryVerified, true);

  for (const [path, expected] of Object.entries(accepted.sha256)) {
    assert.match(path, /^(?:app\/|public\/|package-lock\.json)/);
    assert.match(expected, /^[a-f0-9]{64}$/);
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
