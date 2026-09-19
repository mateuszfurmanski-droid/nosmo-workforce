# Worker first-login setup - implementation checkpoint

User request: replace the technical import-first experience with guided setup immediately after the first sign-in. Existing Worker only; no production or Agency changes.

## Implemented, not deployed
- New WorkerFirstLogin component mounted below the header when Clerk mode is enabled.
- Opens for a signed-in account without a completed setup record on this device. No unauthenticated setup.
- Three stages: choose work contacts; choose and analyse CV/work documents; open Worker Card.
- Existing contact importer and document analysis/review handlers are reused. No new background data access.
- Contact picker shown only when supported; otherwise clear skip guidance and optional VCF file selection.
- Selected document upload clearly disclosed before selection. Existing analysis results and approval controls appear in Documents. No automatic approval or agency sharing.
- English and Polish copy, large angular controls, theme variables and a narrow-layout rule.
- Later hides setup for the current mount. Incomplete setup resumes on reload/sign-in. Settings provides restart/reopen.
- Progress is versioned and keyed by Clerk user ID in localStorage. It is device-local, not a server-wide first-login record. Existing users will also see setup once per device until completed.
- Completion means closing setup, not asserting any import succeeded. Cancellation, skips and failures do not claim imported data.
- WhatsApp/SMS inboxes are not automatically connected or read.

## Validation
- TypeScript 5.9.3 syntax transpilation: WorkerFirstLogin and page.tsx, zero syntax errors.
- git diff --check passed.
- Manual code review covered conditional Clerk mounting, per-account setup progress, no access/upload on mount, explicit file selection, busy/error states and existing document review.
- Full dependency typecheck/build and signed-in browser checks are pending. This checkpoint does not claim runtime or mobile PASS.

## Next separate stage
Deploy Worker Preview only, then verify first sign-in, returning completed account, Later/reopen, another account, cancellation, unsupported contacts, document errors/review and 320/360/390px layouts. Preserve the existing UI checkpoint and unresolved signed-in avatar/mobile checks.

Security Gate and pilot readiness remain unchanged: Preview/demo.


## Preview deployment result
- Deployed source HEAD: e4d2801a45716d92c791ccd9ccc160be91409dec (includes implementation 3ffe26f).
- All 137 uploaded files verified by Git blob hash against remote HEAD. No .env files read or uploaded.
- Deployment: dpl_BswUnaDdzeyPh2LBqQWmeSFiskbC.
- URL: https://nosmo-worker-v95-preview-r5rmc3rhd.vercel.app
- Vercel READY; preview target (response target=null); aliases=[]; build approximately 58 seconds.
- next build succeeded. Signed-in onboarding, real import and mobile browser verification remain pending. This supersedes the earlier not-deployed status only.
- The chat client showed a streaming interruption, but deployment completion was independently confirmed through Vercel.
