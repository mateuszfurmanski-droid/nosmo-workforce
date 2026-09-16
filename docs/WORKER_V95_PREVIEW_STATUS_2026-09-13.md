# Worker v95 Vercel attempt — 2026-09-13

Status: BLOCKED — deployment environment mismatch; DEMO ONLY.

## Source and validation
- Canonical repository: mateuszfurmanski-droid/nosmo-workforce.
- Branch: security/nosmo-security-gate, implementation commit 1c5ec73bcbde0e834ab923edad36f725a44de71e.
- Accepted Worker v95 / V1.0102 UI preserved; native details defaultOpen corrected to open for TypeScript.
- Next build completed including TypeScript, dynamic root and proxy.
- 11 targeted security tests passed: Vercel identity rejection, actual streamed body limit, original body readability, spoofed identity rate-limit bypass prevention, existing security contracts.
- Vercel rejects Sites identity headers both in proxy and application handlers; authentication is checked before database access.
- No Worker database credentials or identity-provider secrets were configured.
- CSP nonce support added; live browser/CSP verification remains pending.

## Deployment incident
The connected deploy tool was explicitly called with target: preview, name: nosmo-worker-v95-preview, teamId: team_xYGLaQSQvOQxxs3S5O6cfkQR, and 183 source files exported from apps/work.
The creation response said "targeting preview". Subsequent get_deployment inspection returned:
- Deployment: dpl_3vaBmtebnGzTirES5FSmeSPhzdW4
- Project: prj_OV3yHKWZm91ULCE7bf4lrL3iKped
- URL: https://nosmo-worker-v95-preview-e9bwxqp70.vercel.app
- READY, target: production
- Aliases: nosmo-worker-v95-preview.vercel.app and nosmo-worker-v95-preview-mateuszfurmanski-3044s-projects.vercel.app.

This DOES NOT satisfy the user's Preview-only requirement. Do not present it as a completed Preview or claim that no production-target deployment was created. Existing Agency, Emergency, Core and other established production projects were not modified in this Worker attempt. No promote command or production target was requested. The cause of the target mismatch is not confirmed.

Deployment writes stopped after detection. Available connector tools have no delete/cancel/update-project endpoint; VERCEL_TOKEN and standard local CLI authentication are absent. Cleanup is not complete.

## Required recovery
1. Remove ONLY the unintended deployment dpl_3vaBmtebnGzTirES5FSmeSPhzdW4 using an authorized Vercel management session. Do not delete or modify established products.
2. Establish a deployment path that demonstrably preserves Preview target; verify target and aliases immediately after creation.
3. Complete live browser and API QA on the actual Preview.
4. Configure and test a verified identity provider before any real-data pilot. Sites headers must remain rejected on Vercel.

Agency v28 evidence remains in docs/AGENCY_V28_PREVIEW_QA_2026-09-13.md. Its live tenant-isolation checks do not establish real IdP login. Overall Security Gate remains DEMO ONLY.
