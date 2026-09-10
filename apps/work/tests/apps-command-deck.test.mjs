import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/apps-command.css", import.meta.url), "utf8");

test("V1.0102 keeps the Apps screen as a NOSMO Work command deck", () => {
  assert.match(page, /NOSMO WORK · V1\.0102/);
  assert.match(page, /nexus-command-identity/);
  assert.match(page, /NOSMO WORK/);
  assert.match(page, /Powered by NEXUS/);
  assert.doesNotMatch(page, /<small>NEXUS COMMAND DECK<\/small>/);
});

test("CSCS mark stays inside its icon column and privacy copy describes chosen imports", () => {
  assert.match(css, /\.nexus-command-glyph\.glyph-cscs\s*\{[^}]*width:\s*34px[^}]*font-size:\s*8px[^}]*white-space:\s*nowrap/s);
  assert.match(page, /Private launcher — you choose what NOSMO imports/);
  assert.doesNotMatch(page, /NOSMO does not scan your installed apps/);
});

test("command deck puts four work tools first and folds connected services", () => {
  const tools = page.indexOf("{ui.workTools}");
  const connected = page.indexOf("nexus-command-disclosure", tools);
  const manage = page.indexOf("nexus-command-manage", connected);
  assert.ok(tools > -1 && connected > tools && manage > connected);
  assert.match(page, /aria-label="Work tools"/);
  assert.match(page, /aria-label="Connected work apps"/);
  assert.match(page, /<details className="nexus-command-disclosure">/);
  assert.match(page, /aria-label="App and import settings"/);
  assert.doesNotMatch(page, /aria-label="NOSMO core apps"/);
});

test("all required modules retain their real destinations", () => {
  for (const label of [
    "Drawings", "Nexus Upload", "Work Camera", "Private Vault", "Manage apps & imports",
    "Gmail", "WhatsApp", "Call", "Messages", "Indeed",
    "LinkedIn", "Reed", "Totaljobs", "CV-Library", "Drive", "Calendar", "CSCS / CITB",
  ]) assert.match(page, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.match(page, /setActive\("Drawings"\)/);
  assert.match(page, /setWorkCameraModal\(true\)/);
  assert.match(page, /setDocumentCategory\("ID \/ Right to Work"\);setActive\("Documents"\)/);
  assert.match(page, /onClick=\{openIntegrations\}/);
  assert.match(page, /analyseNexusFiles\(files\)/);
  assert.match(page, /https:\/\/mail\.google\.com\//);
  assert.match(page, /https:\/\/uk\.indeed\.com\//);
  assert.match(page, /https:\/\/www\.linkedin\.com\/jobs\//);
  assert.match(page, /https:\/\/www\.reed\.co\.uk\/jobs/);
  assert.match(page, /https:\/\/www\.totaljobs\.com\//);
  assert.match(page, /https:\/\/www\.cv-library\.co\.uk\//);
  assert.match(page, /https:\/\/drive\.google\.com\//);
  assert.match(page, /https:\/\/calendar\.google\.com\//);
  assert.match(page, /https:\/\/www\.cscs\.uk\.com\//);
});

test("mobile command deck is angular, readable and two-column without decorative gradients", () => {
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /border-radius:\s*2px/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /@media \(max-width: 390px\)[\s\S]*font-size:\s*13\.5px/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
  assert.match(css, /var\(--surface\)/);
  assert.match(css, /var\(--bg\)/);
  assert.match(css, /var\(--ink\)/);
  assert.match(css, /var\(--line\)/);
});

test("Command Deck bars, shields and state signals follow the selected theme", () => {
  assert.match(css, /--command-accent:\s*var\(--accent\)/);
  assert.match(css, /\.nexus-command-security\s*\{[^}]*color:\s*var\(--command-accent\)/s);
  assert.match(css, /\.nexus-command-section-title::before\s*\{[^}]*background:\s*var\(--command-accent\)/s);
  assert.match(css, /\.nexus-command-signal\.is-core,[\s\S]*--signal:\s*var\(--command-accent\)/);
  assert.match(css, /\.nexus-command-privacy svg\s*\{[^}]*color:\s*var\(--command-accent\)/s);
});

test("bottom navigation remains the existing five-module worker navigation", () => {
  const navStart = page.indexOf('<nav className="bottom-nav worker-bottom-nav">');
  const navEnd = page.indexOf("</nav>", navStart);
  const nav = page.slice(navStart, navEnd);
  for (const label of ["ui.workerCard", "ui.documents", "ui.jobs", "ui.appsTitle", "ui.settingsTitle"]) assert.match(nav, new RegExp(`\\{${label.replace(".", "\\.")}\\}`));
  assert.equal((nav.match(/<button/g) || []).length, 5);
});
