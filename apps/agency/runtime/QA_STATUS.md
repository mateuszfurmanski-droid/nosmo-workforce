# NOSMO Agency runtime QA status

Verified on branch `fix/agency-sites-v24-backend-parity` before merge:

- accepted Sites v24 UI copied byte-for-byte into runtime public;
- server.js syntax check passed;
- compat.js syntax check passed;
- 21 unique `/api/agency/*` method+route contracts are guarded by the permanent contract test;
- Ask Nexus compatibility path is read-only (`writePerformed: false`);
- Worker App private fields are not included by the compatibility API;
- recruiter-safe access is membership/consent scoped;
- imported roster writes keep `workerAppConfirmed: false`;
- placement BLOCKED/CHECK readiness gates are present;
- successful runtime assembly did not modify `apps/work`.

Not yet claimed as live-tested:

- deployed OIDC login/callback/logout;
- deployed Neon reads/writes;
- deployed multi-tenant isolation canary;
- deployed invite handoff with real `WORK_APP_BASE_URL`;
- deployed end-to-end recruiter workflow.
