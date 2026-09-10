import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/compact-theme.css", import.meta.url), "utf8");

test("Settings and imports use one quiet progressive-disclosure path", () => {
  assert.match(page, /className="settings-data-disclosure"/);
  assert.match(page, /className="integration-source-disclosure"/);
  assert.match(page, /className="import-inbox integration-inbox-disclosure panel"/);
  assert.match(page, /Imports & contacts/);
  assert.match(page, /NOSMO WORK · V1\.0101/);
  assert.match(css, /V1\.0099: settings and imports use progressive disclosure/);

  const openIntegrations = page.match(/function openIntegrations\(\) \{[\s\S]*?\n  \}/)?.[0] || "";
  assert.match(openIntegrations, /setActive\("Integrations"\)/);
  assert.doesNotMatch(openIntegrations, /setIntegrationGuideOpen/);
});
