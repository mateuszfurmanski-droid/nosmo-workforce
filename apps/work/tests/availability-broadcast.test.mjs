import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/compact-theme.css", import.meta.url), "utf8");
const server = await readFile(new URL("../app/worker-server.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/worker/[...path]/route.ts", import.meta.url), "utf8");

test("Worker Card has one live status control instead of an agency broadcast", () => {
  assert.match(page, /className="availability-command"/);
  assert.match(page, /One status\. Connected agencies update automatically\./);
  assert.match(page, /className={`availability-sync-row \$\{availabilitySyncState\}`}/);
  assert.equal((page.match(/availability-led-trigger/g) || []).length, 1);
  assert.doesNotMatch(page, /availability-broadcast-cta/);
  assert.doesNotMatch(page, /availability-broadcast-modal/);
  assert.doesNotMatch(page, /Tell agencies I&apos;m available/);
  assert.doesNotMatch(page, /Start WhatsApp queue|mailto:\?bcc=|agencyRecipientIds|selectedAgencyContacts/);
});

test("the LED opens a deliberate three-state menu with a calendar", () => {
  assert.match(page, /availability-led-trigger/);
  assert.match(page, /aria-haspopup="menu"/);
  assert.match(page, /role="menuitemradio"/);
  assert.match(page, />Available<\/b>/);
  assert.match(page, />Busy<\/b>/);
  assert.match(page, />Ready on date<\/b>/);
  assert.match(page, /input type="date"/);
  assert.match(page, /setAvailabilityState\("green"\)/);
  assert.match(page, /setAvailabilityState\("red"\)/);
  assert.match(page, /chooseAvailabilityDate\(event\.currentTarget\.value\)/);
  assert.match(css, /\.availability-menu-popover\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /\.availability-menu-popover \.availability-led\.unlit\s*\{[^}]*background:\s*transparent !important;[^}]*box-shadow:\s*none !important/s);
  assert.match(css, /\.card-availability-picker \.availability-menu-popover\s*\{[^}]*right:\s*auto;[^}]*left:\s*0;[^}]*width:\s*100%;[^}]*max-width:\s*100%/s);
});

test("status is persisted server-side and exposed only through active recruiter-safe grants", () => {
  assert.match(server, /if \(method === "GET" && route === "status"\)/);
  assert.match(server, /if \(method === "PATCH" && route === "status"\)/);
  assert.match(server, /status === "available"/);
  assert.match(server, /status === "busy"/);
  assert.match(server, /status === "ready_on_date"/);
  assert.match(server, /grant_row\.scope = 'RECRUITER_SAFE'/);
  assert.match(server, /grant_row\.status = 'ACTIVE'/);
  assert.match(server, /'AVAILABILITY_UPDATED'/);
  assert.match(route, /handleWorkerRequest/);
});

test("agency connection is one-time, explicit and keeps private documents out of scope", () => {
  assert.match(page, /ONE-TIME AGENCY CONNECTION/);
  assert.match(page, /Connect \{connectionInvite\.agency\.name\}/);
  assert.match(page, /no availability messages are sent/);
  assert.match(server, /NEXUS_INVITE_ALREADY_USED/);
  assert.match(server, /acceptedBy: "worker"/);
  assert.match(server, /scope: "RECRUITER_SAFE"/);
  assert.match(server, /WITH claimed_invite AS/);
  assert.match(server, /claimed_person_id = \$\{worker\.personId\}/);
  assert.match(server, /if \(!claimed\.length\)/);
  assert.doesNotMatch(server, /smartDocuments|shareCode|passport|private vault/i);
});

test("the Worker UI is simplified without an embedded Agency workspace", () => {
  assert.doesNotMatch(page, /Choose workspace|setAppMode|AgencyWorkspace|agency-bottom-nav/);
  assert.doesNotMatch(page, /menu-scrim|sidebar-availability-picker|active === "Work Mode"/);
  assert.match(page, /<details className="worker-card-details">/);
  assert.match(page, /Work profile/);
  assert.match(css, /\.worker-card-details\s*\{/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.availability-sync-row/s);
});
