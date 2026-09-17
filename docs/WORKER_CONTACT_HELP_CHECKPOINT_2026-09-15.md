# Contact help and confirmed AI blocker — 2026-09-15

Parent 35dab2515cbca4d83fc1064468616f4c1eef5414. Worker-only small stage: I don't have a contacts file button in first-login and import contacts. Device-specific instructions explain exporting existing work contacts via Apple/Samsung Contacts; no manual spreadsheet creation. Supported contact picker remains available. Guidance sources: https://support.apple.com/guide/ipad/ipada42ba52d/ipados and https://www.samsung.com/uk/support/mobile-devices/how-do-i-manage-my-contacts/ .

User screenshot IMG_0449 confirms authenticated /api/nexus-actions reports not_configured. Therefore current Preview does not have an operational AI backend; OPENAI_API_KEY absent per existing endpoint contract. Earlier builds/UI tests were not model roundtrips. No .env read. No connected secure OpenAI key provisioning tool found. Do not claim AI ready. Configuration of server-side provider credential on Worker Preview remains required, followed by signed-in test.

User wants automatic source discovery and intake, not manual exports. Next separate stages: consented source connection/selection; search those sources; recognize and import documents; shared offer/contact/call/document context. Current browser does not have unrestricted device storage/contact/inbox access. Ask Nexus alone cannot search unconnected sources. This help stage does not implement automatic document search or attachment sharing. Production, Core, Agency, Neon unchanged.

Syntax checks passed; build/browser verification pending at source commit.


## Confirmed deployment

Source e7c62af319c4877f100b1d93d9394f38c39520a1. Deployment dpl_8VYHkEkdj6qAn9NwHzYSif5W8gTu READY, Preview only, no aliases. URL https://nosmo-worker-v95-preview-6d1cu6w6p.vercel.app/ .
Previous source 162137f35e2d9d706f0ef4af413955fd28e0fd5b had the same help component browser-verified: Apps -> Manage apps & imports -> Import from phone -> I don't have a contacts file -> iPad/iPhone opens instructions. Final source adds the missing I have a contacts file action in Imports. Final build passed; that additional file-picker button has not been browser-verified. Signed-in wizard and mobile not tested in our browser. User acceptance pending.
AI not_configured remains unresolved; do not call this an operational AI flow. User also sees ChatGPT Reasoning failed/stream interruptions; these do not establish a deployment failure. Remote commit and Vercel status rechecked after interruption. No duplicate deployment was created for the status check.

## AI configuration redeployment — 2026-09-16 user local time

User reports saving OPENAI_API_KEY for Preview in Vercel. Secret not read or copied by agent. Confirmed branch HEAD before deployment a9cc1ddd30eab43600e31a3b07ee802123944583. Local Worker source blob hashes matched remote HEAD (only addon documentation differed). Redeployed existing application, no feature changes. Deployment dpl_6SUMzZgrC697eDdyKLBnutn5ArFm READY; target preview requested; aliases empty. URL https://nosmo-worker-v95-preview-fei0xaq8a.vercel.app/ . Build passed. Authenticated model response and runtime credential availability remain unverified; user must test Ask Nexus while signed in. Do not claim AI PASS from successful build. Production/Core/Agency/database untouched.

## Inline instructions — 2026-09-16

Source a15cba45fdfb41727127ba3ec2896b534c79f62f. Full contact instructions now visible without expanding, covering iPad/iPhone, Samsung/Android, saving/finding .vcf and transfer from another device. Preview dpl_HnFBH2A9APmG4AJJa8QJgmh9o8CD READY; https://nosmo-worker-v95-preview-6olijzhgb.vercel.app/ . Build passed; visual/mobile verification and acceptance pending. User screenshot of preceding fei0xaq8a Preview still shows not_configured while signed in: AI configuration blocker remains unresolved despite reported key setup. No production/Core/Agency/database changes.

## Phone end-user correction — 2026-09-16

Source aa722b9b0c6a294b8e963613fdf661fa8015ce5b. User clarified this is end-user phone onboarding, not instructions tailored to developer's iPad. Removed iPad-specific copy; full visible instructions cover iPhone, Samsung Contacts and Google Contacts with return to NOSMO on the same phone. Cross-device transfer is optional. Preview dpl_AvPHPKJuMfqpeSwdAWUBKNoibxNk READY: https://nosmo-worker-v95-preview-jf1fxsp5d.vercel.app/ . Build passed. Actual phone visual verification and user acceptance pending. AI configuration blocker unchanged; no production changes.

## System selection — 2026-09-16

Contact guide now starts with Android/iPhone selection; Android then asks Samsung/Google. Only the selected four-step guide is rendered. Shortened onboarding introduction; extra file-finding help remains optional. TSX syntax checks passed for both components. Deployment dpl_8EKrX1Wnsh7BkcmUBZVcJibHYxiU READY, https://nosmo-worker-v95-preview-frmfo9vr5.vercel.app/ . Build passed, no production aliases. Browser/mobile interaction verification and user acceptance pending. AI configuration remains unresolved. Source commit 6ad082021cfedd1347c5b0f3a7d7fc2c3568195f.
