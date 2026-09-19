import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/compact-theme.css", import.meta.url), "utf8");
const globals = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const androidMain = await readFile(new URL("../android-app/app/src/main/java/tech/nosmo/work/MainActivity.kt", import.meta.url), "utf8");

test("selected phone contacts become separate durable work-contact rows", () => {
  assert.match(page, /type WorkContact = \{/);
  assert.match(page, /makeWorkContacts\(contacts, "Phone", importedAt\)/);
  assert.match(page, /setContactImportCandidates\(mergeWorkContacts\(\[\], contactRows\)\)/);
  assert.match(page, /onSave=\{saveReviewedContacts\}/);
  assert.match(page, /localStorage\.setItem\(WORK_CONTACTS_KEY, JSON\.stringify\(workContacts\)\)/);
  assert.match(page, /readLocalFile\(`nosmo-import-\$\{record\.id\}`\)/);
});

test("Android contact permission sync is automatic after consent", () => {
  assert.match(page, /__NOSMO_RECEIVE_NATIVE_CONTACTS__/);
  assert.match(page, /NosmoAndroid\.requestContactSync\(\)/);
  assert.match(page, /saveAutomaticContacts\(contacts\)/);
  assert.match(page, /nosmo-android-contact-sync-signature/);
  assert.match(page, /Android contact setup starts automatically after one Allow/);
  assert.match(androidMain, /Set up work contacts/);
  assert.match(androidMain, /Open Android prompt/);
  assert.match(androidMain, /contactsPermission\.launch\(android\.Manifest\.permission\.READ_CONTACTS\)/);
  assert.match(androidMain, /Contacts access is still needed/);
  assert.match(androidMain, /Settings\.ACTION_APPLICATION_DETAILS_SETTINGS/);
  assert.match(androidMain, /Uri\.fromParts\("package", packageName, null\)/);
  assert.match(androidMain, /Contact setup is still required before sharing or job search/);
});

test("required import setup keeps contacts, documents and screenshots one tap away", () => {
  assert.match(page, /className="required-import-setup panel"/);
  assert.match(page, /REQUIRED FIRST SETUP/);
  assert.match(page, /sessionStorage\.getItem\("nosmo-required-import-setup-routed"\)/);
  assert.match(page, /setActive\("Integrations"\)/);
  assert.match(page, /Required setup: import phone contacts, then add CV, cards or certificates/);
  assert.match(page, /const importedDocumentCount = smartDocuments\.length \+ standaloneCvs\.length/);
  assert.match(page, /importedDocumentCount \? `\$\{importedDocumentCount\} saved` : "Required"/);
  assert.match(page, /window\.NosmoAndroid \? window\.NosmoAndroid\.requestContactSync\(\) : void importPhoneContacts\(\)/);
  assert.match(page, /Import documents and certificates/);
  assert.match(page, /analyseNexusFiles\(event\.target\.files\)/);
  assert.match(page, /Read agency screenshots/);
  assert.match(page, /analyseAgencyReplyScreenshot\(event\.target\.files\)/);
  assert.match(page, /className="required-document-checklist"/);
  for (const label of ["CV", "CSCS / ECS", "Certificates", "ID / RTW", "References"]) assert.match(page, new RegExp(label.replace("/", "\\/")));
  assert.match(page, /setDocumentCategory\(category as DocumentCategory\)/);
  assert.match(css, /\.required-import-steps\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.required-document-checklist\s*\{[^}]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.required-import-steps\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.required-document-checklist\s*\{[^}]*grid-template-columns:\s*1fr 1fr/s);
});

test("worker card keeps required setup visible until imports are complete", () => {
  assert.match(page, /const requiredSetupMissing = \[/);
  assert.match(page, /const requiredSetupComplete = requiredSetupMissing\.length === 0/);
  assert.match(page, /className="worker-required-setup"/);
  assert.match(page, /Missing: \{requiredSetupMissing\.join\(" and "\)\}/);
  assert.match(page, /onClick=\{openIntegrations\}>Finish setup/);
  assert.match(css, /\.worker-required-setup\s*\{[^}]*grid-template-columns:\s*34px minmax\(0, 1fr\) auto/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.worker-required-setup\s*\{[^}]*grid-template-columns:\s*30px minmax\(0, 1fr\)/s);
});

test("outgoing work actions are gated by required setup", () => {
  assert.match(page, /function requireRequiredSetup\(action: string\)/);
  assert.match(page, /Finish required setup before \$\{action\}: add \$\{requiredSetupMissing\.join\(" and "\)\}/);
  assert.match(page, /if \(requireRequiredSetup\("sharing your Work Card"\)\) return/);
  assert.match(page, /if \(requireRequiredSetup\("running AI job search"\)\)/);
  assert.match(page, /if \(requireRequiredSetup\("preparing an agency document pack"\)\) return/);
  assert.match(page, /if \(requireRequiredSetup\("opening an agency WhatsApp draft"\)\) return/);
  assert.match(page, /if \(requireRequiredSetup\("sharing agency files"\)\) return/);
});

test("top bar keeps auth, emergency and app-action fallback access", () => {
  assert.match(page, /const AUTH_UI_MODE = process\.env\.NEXT_PUBLIC_NOSMO_AUTH_MODE === "clerk" \? "clerk" : "link"/);
  assert.match(page, /AUTH_UI_MODE === "clerk" \? <WorkerAuthControls \/>/);
  assert.match(page, /className="worker-auth-controls"/);
  assert.match(page, /href=\{SIGN_IN_HREF\}/);
  assert.doesNotMatch(page, /CLERK_AUTH_ENABLED/);
  assert.match(page, /className="worker-emergency-shortcut"/);
  assert.match(page, /aria-label="Open NOSMO Emergency"/);
  assert.match(page, /AUTH_UI_MODE === "clerk" \? \(\s*<SignedInAppActions/s);
  assert.match(page, /:\s*\(\s*<WorkerAppActions/s);
  assert.match(globals, /\.worker-auth-controls button,\.worker-auth-controls a/);
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
