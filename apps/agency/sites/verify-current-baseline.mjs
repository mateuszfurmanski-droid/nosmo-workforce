import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseline = JSON.parse(
  await readFile(new URL("./current-baseline.json", import.meta.url), "utf8"),
);

assert.equal(baseline.schema, "nosmo-agency-sites-baseline/v1");
assert.equal(baseline.versionNumber, 28);
assert.equal(
  baseline.commitSha,
  "96d342f04f1112c22f13cd5c7bb8f55856f887c8",
);
assert.equal(baseline.gitTree, "aceeed8ea6a8669c1c7bcaa5ec852b488a15bdc1");
assert.equal(baseline.displayedVersion, "V1.0026");
assert.equal(baseline.sourceRepositoryVerified, true);
assert.equal(baseline.savedButNotDeployedVersion.versionNumber, 29);
assert.equal(baseline.savedButNotDeployedVersion.accepted, false);
assert.notEqual(
  baseline.commitSha,
  baseline.savedButNotDeployedVersion.commitSha,
);

for (const [path, expected] of Object.entries(baseline.sha256)) {
  assert.match(path, /^(?:app\/|package-lock\.json)/);
  assert.match(expected, /^[a-f0-9]{64}$/);
}

console.log(
  "NOSMO Agency current baseline PASS: Sites v28 / V1.0026; unpublished v29 excluded.",
);
