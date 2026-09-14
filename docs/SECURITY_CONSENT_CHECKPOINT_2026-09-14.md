# Security Gate: consent revocation checkpoint — 2026-09-14

## Current approved previews
- Agency v28 / V1.0026: https://nosmo-agency-v10025-preview-k3t3e3k1y.vercel.app
  Deployment dpl_FyAZLTzfG6H3jqJVjYh4BFWzTYUW, READY, target null.
  User approved top navigation, visible account state, labeled Ask Nexus shortcuts and removal of the Agency Emergency mount.
  User reported Agency login succeeded and supplied the create-workspace screen.
- Worker v95: https://nosmo-worker-v95-preview-q6ulfvbbp.vercel.app
  Deployment dpl_CjeAKAuzNYkgvsZyTAsG8tCpmZrF, READY, target null, aliases empty.
  Source 5977f28ead23328b16093469872440c035eaa5f6.
  Live root returned 200 and private/no-store headers.
- Branch security/nosmo-security-gate, repository mateuszfurmanski-droid/nosmo-workforce, PR #18. Production unchanged.

## Change
Worker Card lists connected agencies with a Stop sharing button and explicit confirmation. DELETE /api/worker/connection derives the Worker from verified identity, restricts revocation to that person's active RECRUITER_SAFE grant, and atomically records CONSENT_REVOKED. Other Workers' person IDs in the body do not control authority. Reconnection needs a new invite. Agency-owned recruitment records are retained; this is not a deletion feature.

## Evidence
- TypeScript check passed (tsconfig.vercel.json).
- 13 tests passed: consent-revocation, vercel-security and security-boundary.
  The new handler tests use a simulated database, exercise CSRF/auth failures, ignore forged personId, check missing grant and database failure responses.
- 8 assertions passed against isolated Neon project morning-glitter-88911562 / branch br-gentle-poetry-afn2t6ur / neondb.
  Tests execute the actual Agency connectedRows query and the revocation CTE: active grant visibility, cross-tenant denial, revoked grant denial, inactive profile denial, membership separation, ownership, audit event, fixture rollback.
  SQL retained in apps/agency/runtime/tests/consent-gate.sql; all synthetic fixtures rolled back in a nested transaction.
- New local HTTP + isolated database test apps/agency/runtime/tests/clerk-tenant-isolation.e2e.mjs is BLOCKED, not passed: direct PostgreSQL DNS failed (EAI_AGAIN). No fixtures were inserted by that attempt.
  Run only with SECURITY_QA_ALLOW_MUTATION=isolated-branch and a verified SECURITY_QA_DATABASE_URL, using node --experimental-test-module-mocks.
  It simulates Clerk Backend API responses and does not prove JWT/browser sign-in.

## Remaining
Security Gate remains DEMO / PREVIEW ONLY. Still verify two real authenticated Agency tenants, Worker invitation acceptance, Stop sharing in the UI, subsequent Agency API denial, session renewal and logout end-to-end. Previously displayed snapshots/agency-owned records are not erased by revocation. Do not equate SQL checks, handler mocks or deployment READY with full live browser security verification. Apple/Microsoft/email OTP/phone methods remain unverified.

Agency local history differs from connector history. Do not force-push. Base further commits on remote HEAD. Do not read existing environment files or expose credentials. Keep stages bounded.
