# NOSMO Workforce continuation checkpoint — 2026-09-13


## Stage 1 update — live Agency v28 API QA completed
See [AGENCY_V28_PREVIEW_QA_2026-09-13.md](AGENCY_V28_PREVIEW_QA_2026-09-13.md) for newer evidence. Browser rendering, source asset parity, healthy isolated database, synthetic Agency A/B authorization, Ask Nexus privacy, denied mutations, CSRF and payload/header controls were verified. Fixture cleanup was independently confirmed. Initial protection-access limitations below are historical. OIDC login remains blocked (503); Worker Preview is next. Production was unchanged.

## Scope and owner instruction
Continue Agency Sites v28 / V1.0026 and Worker Sites v95 / V1.0102. Preview only. Do not change production, merge PR #18, redesign UI, or touch Emergency/Nexus Core. Owner requested smaller bounded stages with a concrete result after each stage.

## Canonical state
Repository: mateuszfurmanski-droid/nosmo-workforce.
Branch: security/nosmo-security-gate. Main: 911557f489721affba7ae414f49db36f20375b25.
Source checkpoint before this note: ca6c412c0e77bf6ac5893d08e8f1470124e807c9.
Agency v28 integration commit: f774573e277a2f50252635814de3ca4b20224f46.
All five PR workflows at f774573 passed: v24 archive parity, v28 parity, Security Gate, Worker Agency handoff, Worker V1.0102 Browser QA.

## Stage 1: Agency v28 Preview created and READY
Project: prj_PuaPLBCXCfzno0U0FB1QTE3IteDT (existing nosmo-agency-v10025-preview project; the project name retains the old version, but this deployment contains the accepted v28 client).
Team: team_xYGLaQSQvOQxxs3S5O6cfkQR.
Deployment: dpl_7Nw8Qwb5J79kTT27sAw3F5Spa26o.
URL: https://nosmo-agency-v10025-preview-5kowuycak.vercel.app
Inspector: https://vercel.com/mateuszfurmanski-3044s-projects/nosmo-agency-v10025-preview/7Nw8Qwb5J79kTT27sAw3F5Spa26o
Confirmed READY, target null, aliases empty, 5 Node.js functions.

Uploaded exactly 42 Git-tracked files under apps/agency/runtime from ca6c412 (3,400,022 raw bytes), with that prefix removed. Text assets were sent as UTF-8 and PNG assets as base64. No secrets or untracked files were included. Connector does not retain supplied git metadata: source provenance is the exact tracked export, not deployment metadata.
Settings: framework null; empty build command; install npm ci --ignore-scripts --no-audit --no-fund; outputDirectory public; rootDirectory null.
A base64-only attempt exceeded the connector's 4 MiB limit and created no deployment; UTF-8 text files resolved this without omitting assets.

## Confirmed live evidence on the new deployment
Connected Vercel fetch of /api/agency/pipeline returned HTTP 401 with NEXUS_AUTH_REQUIRED. Response included CSP, HSTS, nosniff, DENY, referrer policy, restrictive permissions policy, COOP, no-store and rate-limit headers.
Browser navigation to the root reached Vercel deployment-protection sign-in. This is not an application render test.
Concurrent connector fetches encountered a temporary share-link 409; a sequential health fetch returned Vercel SSO 302. Database health, full client rendering, OIDC and tenant integration are NOT newly credited on this deployment.
Prior 28aba296 live integration evidence in SECURITY_GATE.md remains historical, not a pass for this new deployment.

## Exact remaining work
1. Complete protected Preview root/health and browser verification using authorized Vercel access; do not weaken protection. Then run existing synthetic tenant-isolation.e2e.mjs against the isolated Neon QA branch and verify cleanup.
2. Resolve existing Agency OIDC_CLIENT_ID / REPL_ID configuration. Previous evidence found it missing; this turn did not add or recover it. Do not invent a client ID or replace the identity provider silently.
3. Worker Preview: no Worker deployment or code changes were made in this stage. Existing Vercel project list has no Worker project. It uses Vinext/Cloudflare build scripts. Before any Vercel deployment, address identity trust: app/worker-server.ts and app/chatgpt-auth.ts currently trust oai-authenticated-user-email, which is platform-authenticated on Sites, but must not be trusted as a caller-supplied header on Vercel. Preserve accepted UI and Sites behavior; fail closed on unsupported hosts.
4. Verify Worker compatible CSP/headers, body limits, clear-device privacy control and mapped-source runtime; then update full Security Gate.

## Isolation and classification
Verified existing Neon branch br-gentle-poetry-afn2t6ur, project morning-glitter-88911562, name security-gate-20260907: ready, primary false, default false, protected false. No database writes were performed in this stage.
Release classification remains DEMO ONLY. Deployment READY is not PILOT READY.
Production deployment, aliases, database and Sites publications were not changed.

## Useful local checkouts
Current isolated checkout: /workspace/scratch/dd163c53874b/nosmo-workforce
Recovered earlier checkout: /workspace/scratch/bff05f80aed2
Use GitHub as the durable authority; scratch may be cleaned.
