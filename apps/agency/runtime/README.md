# NOSMO Agency accepted Sites runtime

This runtime serves the accepted ChatGPT Sites v28 / NOSMO Agency V1.0026 frontend without redesign and supplies a standalone compatibility API at `/api/agency/*`.

## Source of truth

- Accepted UI: `apps/agency/sites/v28/public`
- Runtime public bundle: `apps/agency/runtime/public`
- UI byte parity is enforced by `tests/contract.mjs`.
- Compatibility API: `compat.js`
- Standalone host/auth/database runtime: `server.js`

## Product boundaries

- No NOSMO Work frontend code is owned here.
- No Nexus Core implementation is owned here.
- Worker App data is exposed only through active `RECRUITER_SAFE` grants.
- Agency-owned imported roster data is kept distinct from Worker App-confirmed data.
- Ask Nexus uses the exact accepted v28 response engine, is tenant-scoped and remains read-only.
- Placement writes enforce readiness checks.
- Creating a Worker App invite does not grant consent or recruiter-safe access.

## Required live environment

- `DATABASE_URL`
- `OIDC_CLIENT_ID` or `REPL_ID`
- optional `ISSUER_URL`
- `NEXUS_ONBOARDING_INVITE_SECRET` (minimum 32 characters)
- `WORK_APP_BASE_URL`

The accepted v28 `/login` entry is bridged to the existing hardened OIDC endpoint.
Preview origin derivation is allowed only when `VERCEL_ENV=preview`; production
continues to require the explicit/canonical production origin. The CSP authorizes
only the fixed hashes of the accepted Vinext inline bootstrap scripts and does not
enable arbitrary inline JavaScript.

A live deployment is not considered release-ready until real OIDC, database, tenant isolation, recruiter-safe projection, roster/request/pipeline writes, placement gates, Ask Nexus and invite handoff have passed against the deployed preview.
