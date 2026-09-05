# NOSMO Agency accepted Sites runtime

This runtime serves the accepted ChatGPT Sites v24 frontend without redesign and supplies a standalone compatibility API at `/api/agency/*`.

## Source of truth

- Accepted UI: `apps/agency/sites/v24/public`
- Runtime public bundle: `apps/agency/runtime/public`
- UI byte parity is enforced by `tests/contract.mjs`.
- Compatibility API: `compat.js`
- Standalone host/auth/database runtime: `server.js`

## Product boundaries

- No NOSMO Work frontend code is owned here.
- No Nexus Core implementation is owned here.
- Worker App data is exposed only through active `RECRUITER_SAFE` grants.
- Agency-owned imported roster data is kept distinct from Worker App-confirmed data.
- Ask Nexus compatibility responses are read-only.
- Placement writes enforce readiness checks.
- Creating a Worker App invite does not grant consent or recruiter-safe access.

## Required live environment

- `DATABASE_URL`
- `OIDC_CLIENT_ID` or `REPL_ID`
- optional `ISSUER_URL`
- `NEXUS_ONBOARDING_INVITE_SECRET` (minimum 32 characters)
- `WORK_APP_BASE_URL`

A live deployment is not considered release-ready until real OIDC, database, tenant isolation, recruiter-safe projection, roster/request/pipeline writes, placement gates, Ask Nexus and invite handoff have passed against the deployed preview.
