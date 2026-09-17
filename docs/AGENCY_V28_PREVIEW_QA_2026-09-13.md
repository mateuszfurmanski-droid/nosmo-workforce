# Agency v28 Preview — live security QA, 2026-09-13

This is the newer Agency Preview evidence. It supersedes the initial-access limitations in SECURITY_PREVIEW_CHECKPOINT_2026-09-13.md. It does not approve a personal-data pilot.

## Exact target
- Source export: ca6c412c0e77bf6ac5893d08e8f1470124e807c9, apps/agency/runtime.
- Accepted client: Sites v28, displayed V1.0026.
- Deployment: dpl_7Nw8Qwb5J79kTT27sAw3F5Spa26o.
- URL: https://nosmo-agency-v10025-preview-5kowuycak.vercel.app
- Existing Vercel project: prj_PuaPLBCXCfzno0U0FB1QTE3IteDT.
- READY; target null; no production aliases.
- Test database: project morning-glitter-88911562, branch br-gentle-poetry-afn2t6ur (security-gate-20260907), explicitly non-primary/non-default.

## Browser and source verification
Authorized temporary access through the Vercel connector enabled browser inspection without disabling deployment protection.
The Agency Desk rendered V1.0026. Workers, Requests and Settings navigation worked in unauthenticated SAFE MODE. Agency profile save controls were disabled without identity.
All 18 static assets (JavaScript, CSS, icons and logos) matched SHA-256 of the tracked runtime files. HTML differed only by Vercel's injected feedback-toolbar script; the application HTML was unchanged.
This proves rendering and the inspected navigation, not authenticated recruiter workflows or full mobile visual QA.

## API checks
- Health: 200, databaseReady true, missingTableCount 0, securityGate ENFORCED.
- No application session: 401 NEXUS_AUTH_REQUIRED.
- Session credential in query string: 400 NOSMO_SESSION_URL_FORBIDDEN.
- Login initiation: 503, sign-in not configured. Real OIDC is still BLOCKED.

## Synthetic Agency A/B integration
Executed the permanent tenant-isolation.e2e.mjs suite using explicitly preseeded synthetic fixtures on the isolated branch.
Authentication and read sections completed in the original sequential run: missing/invalid/expired sessions denied; Agency A only received its requests, roster, recruiter profile, candidates, applications and placements; private Worker markers were excluded.
The accepted v28 Ask Nexus response was read-only, returned Agency A records without Agency B records, and rejected browser-supplied agencyId.
The original all-in-one runner exceeded the outer runtime limit. It is NOT recorded as a successful full run. Remaining checks were completed using explicit write and perimeter phases.

The runner now supports SECURITY_QA_PHASE=auth|read|write|perimeter|all. Each response emits only check number, method and status. Each HTTP request has a 35-second timeout. A selected phase reports PHASE_PASS, never a whole-suite PASS; default all preserves the full sequence.
Test runner commits: 98ccdc62003605ad850906e4cd1f6f6d86fef042 (timeout/progress), 0f8d912b5e9b1df0f26a6f01590b1eec0b7754fb (explicit phases). No deployed application code was changed in this stage.

## Completed phase results and cleanup
- write: PHASE_PASS, 15 requests. Cross-tenant PATCH/POST/DELETE, invite delivery and SQL-looking identifier access denied; recruiter account mutation denied.
- perimeter: PHASE_PASS, 5 requests. Missing/wrong Origin denied, malformed JSON rejected, oversized payload rejected, security headers verified.
- Combined with the completed authentication/read sections, all 31 distinct assertions-bearing HTTP checks in the suite were exercised successfully across the bounded runs.
- Independent post-run SQL confirmed Agency B request OPEN, trade Joiner, application CONTACTED, placement PLACED and recruiter name unchanged; zero Agency B actions.
- Exact synthetic fixture cleanup completed in one isolated-branch transaction. Verification found zero remaining test agencies, memberships, people, users and sessions.
- Synthetic sessions test authorization boundaries; they do not establish successful identity-provider authentication.

## Remaining gate
DEMO ONLY. OIDC client/provider setup and real callback/session-creation/refresh tests remain unverified. The UI labels sign-in as ChatGPT while the retained server implementation uses Replit OIDC; this existing provider mismatch must be reconciled explicitly, not hidden by a label-only fix.
Worker v95 Preview remains a separate next stage. Its Sites identity headers must not become caller-controlled identity on Vercel.
Production and public Sites deployments were unchanged.
