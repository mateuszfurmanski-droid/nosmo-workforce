# NOSMO Agency runtime QA status

Current permanent QA target on `security/nosmo-security-gate`:

- accepted Sites v28 / V1.0026 UI mirrored into runtime public;
- all 17 deterministic client assets matched the deployed Sites v28 bytes before the documented invite overlay;
- Emergency client chunk is pinned to its accepted v28 hash and was not edited independently;
- server.js syntax check passed;
- compat.js syntax check passed;
- 21 unique `/api/agency/*` method+route contracts are guarded by the permanent contract test;
- Ask Nexus uses the accepted v28 response schema, rejects browser tenant IDs, scopes its complete snapshot by the server-derived Agency and is read-only (`writePerformed: false`);
- Worker App private fields are not included by the compatibility API;
- recruiter-safe access is membership/consent scoped;
- imported roster writes keep `workerAppConfirmed: false`;
- placement BLOCKED/CHECK readiness gates are present;
- successful runtime assembly did not modify `apps/work`.

Still not claimed as live-tested on the new v28 Preview until deployment evidence is recorded:

- deployed OIDC login/callback/logout;
- deployed Neon reads/writes;
- deployed multi-tenant isolation canary;
- deployed invite handoff with real `WORK_APP_BASE_URL`;
- deployed end-to-end recruiter workflow.
