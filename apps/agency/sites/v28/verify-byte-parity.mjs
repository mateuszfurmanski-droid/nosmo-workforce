import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const agency = path.resolve(here, "../..");
const canonical = path.join(here, "public");
const runtime = path.join(agency, "runtime/public");
const manifest = JSON.parse(fs.readFileSync(path.join(here, "CAPTURE_MANIFEST.json"), "utf8"));
const baseline = JSON.parse(fs.readFileSync(path.join(agency, "sites/current-baseline.json"), "utf8"));
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

assert.equal(manifest.sitesVersion, 28);
assert.equal(manifest.sourceCommit, baseline.commitSha);
assert.equal(manifest.sourceTree, baseline.gitTree);
assert.equal(manifest.displayedVersion, `NOSMO Agency ${baseline.displayedVersion}`);
assert.equal(manifest.provenance.liveAssetCount, 17);
assert.equal(manifest.provenance.liveAssetsByteMatched, 17);

for (const expected of manifest.canonicalFiles) {
  const source = path.join(canonical, expected.path);
  const deployed = path.join(runtime, expected.path);
  assert.ok(fs.existsSync(source), `missing canonical file ${expected.path}`);
  assert.equal(fs.statSync(source).size, expected.bytes, `byte count changed: ${expected.path}`);
  assert.equal(sha(source), expected.sha256, `hash changed: ${expected.path}`);
  assert.ok(fs.existsSync(deployed), `missing runtime file ${expected.path}`);
  assert.equal(sha(deployed), expected.sha256, `runtime parity changed: ${expected.path}`);
}

const canonicalNames = manifest.canonicalFiles.map((entry) => entry.path).sort();
function files(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    return entry.isDirectory()
      ? files(absolute).map((nested) => path.join(entry.name, nested))
      : [entry.name];
  });
}
assert.deepEqual(files(canonical).sort(), canonicalNames, "canonical file closure changed");
assert.deepEqual(files(runtime).sort(), canonicalNames, "runtime file closure changed");

const html = fs.readFileSync(path.join(canonical, "index.html"), "utf8");
for (const marker of ["NOSMO AGENCY V1.0026", "Agency Desk", "ASK NEXUS", "Smart File Inbox", "Worker-owned data.", "EMERGENCY", "nexus-home-button"]) {
  assert.ok(html.toLowerCase().includes(marker.toLowerCase()), `missing v28 marker: ${marker}`);
}
assert.ok(!html.includes("V1.0025"), "historical Agency version leaked into v28 HTML");

const loader = fs.readFileSync(path.join(canonical, "assets/index-BPu2ZhZM.js"), "utf8");
const invite = fs.readFileSync(path.join(canonical, "invite-delivery.js"), "utf8");
assert.ok(loader.startsWith('import"../invite-delivery.js";'), "secure invite adapter is not loaded first");
assert.ok(invite.includes('method: "POST"'), "invite credential delivery must use POST");
assert.ok(invite.includes('body: "{}"'), "invite credential delivery must use a request body");
assert.ok(!invite.includes("?token="), "invite credential must not be put in a URL");

const csp = JSON.parse(fs.readFileSync(path.join(agency, "runtime/vercel.json"), "utf8"))
  .headers[0].headers.find((header) => header.key === "Content-Security-Policy").value;
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
assert.ok(inlineScripts.length > 0, "expected the accepted Vinext inline bootstrap scripts");
for (const script of inlineScripts) {
  const token = `'sha256-${crypto.createHash("sha256").update(script).digest("base64")}'`;
  assert.ok(csp.includes(token), "CSP does not authorize an accepted v28 bootstrap script");
}
assert.ok(!csp.includes("script-src 'self' 'unsafe-inline'"), "script CSP was weakened to unsafe-inline");

console.log(`NOSMO Agency Sites v28 parity PASS: ${canonicalNames.length} files, ${inlineScripts.length} inline CSP hashes, ${manifest.provenance.liveAssetsByteMatched} live assets byte-matched, runtime mirror exact.`);
