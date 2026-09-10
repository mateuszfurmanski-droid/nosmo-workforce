import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/nexus-import/route.ts", import.meta.url), "utf8");
const css = await readFile(new URL("../app/compact-theme.css", import.meta.url), "utf8");

test("an agency reply screenshot is analysed by Nexus and opens a real pack review", () => {
  assert.match(page, /function analyseAgencyReplyScreenshot/);
  assert.match(page, /formData\.append\("context", "agency_reply"\)/);
  assert.match(page, /Agency Reply Pack/);
  assert.match(page, /Read screenshot/);
  assert.match(route, /agencyReply:/);
  assert.match(route, /requestedItems/);
});

test("every pack item starts private and requires an explicit worker tick", () => {
  assert.match(page, /setAgencyPackSelections\(\[\]\)/);
  assert.match(page, /checked=\{selected\}/);
  assert.match(page, /Unticked items stay private/);
  assert.match(page, /No automatic send/);
  assert.match(page, /You choose the recipient, review the message and press Send in WhatsApp/);
  assert.doesNotMatch(page, /setAgencyPackSelections\(reply\.requestedItems\)/);
});

test("the requested pack covers the normal agency document set", () => {
  for (const label of ["Two latest references", "Right to Work share code", "Current address", "CSCS card", "Additional certificates", "Photo ID"]) {
    assert.match(page, new RegExp(label));
  }
  assert.match(page, /These fields are not saved to your Worker Card or contact register/);
  assert.match(page, /navigator\.canShare\?\.\(\{ files \}\)/);
});

test("the agency pack stays usable as a one-column mobile sheet", () => {
  assert.match(css, /\.agency-pack-modal\s*\{[^}]*width:\s*min\(720px, calc\(100% - 24px\)\)/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.agency-pack-checklist\s*\{[^}]*grid-template-columns:\s*1fr/s);
});
