import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/compact-theme.css", import.meta.url), "utf8");

test("selected phone contacts become separate durable work-contact rows", () => {
  assert.match(page, /type WorkContact = \{/);
  assert.match(page, /makeWorkContacts\(contacts, "Phone", importedAt\)/);
  assert.match(page, /rememberWorkContacts\(contactRows\)/);
  assert.match(page, /localStorage\.setItem\(WORK_CONTACTS_KEY, JSON\.stringify\(workContacts\)\)/);
  assert.match(page, /readLocalFile\(`nosmo-import-\$\{record\.id\}`\)/);
});

test("contact register supports name, category, trade and region filtering", () => {
  assert.match(page, /className="work-contact-register panel"/);
  assert.match(page, /contact\.category !== contactCategory/);
  assert.match(page, /contact\.trade !== contactTrade/);
  assert.match(page, /contact\.region !== contactRegion/);
  assert.match(page, /Name, phone, email, trade or region/);
  for (const category of ["Agency", "Manager", "Worker", "Other"]) assert.match(page, new RegExp(`"${category}"`));
});

test("the app maintains CSV and XLSX contact sheets in the background", () => {
  assert.match(page, /saveLocalFile\("NOSMO-Work-Contacts\.csv"/);
  assert.match(page, /saveLocalFile\("NOSMO-Work-Contacts\.xlsx"/);
  assert.match(page, /makeContactsWorkbook\(workContacts\)/);
  assert.match(page, /autoFilter ref="A1:K\$\{endRow\}"/);
  assert.match(page, /downloadContactsSheet\("xlsx"\)/);
  assert.match(page, /downloadContactsSheet\("csv"\)/);
});

test("inferred contact tags can be corrected and persisted", () => {
  assert.match(page, /WORK_CONTACT_TAGGING_VERSION = "agency-tags-v2"/);
  assert.match(page, /contact\.category === "Other" \? inferContactCategory/);
  assert.match(page, /function updateWorkContact/);
  assert.match(page, /function saveContactTags/);
  assert.match(page, /contact-category-select/);
  assert.match(page, /Trade or specialism/);
  assert.match(page, /The contact workbook is refreshing in the background/);
});

test("mobile contact rows remain compact without horizontal overflow", () => {
  assert.match(css, /\.contact-register-filters\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.contact-register-list article\s*\{[^}]*grid-template-columns:\s*32px minmax\(0, 1fr\) auto/s);
  assert.match(css, /\.contact-register-links\s*\{[^}]*min-width:\s*0/s);
});
