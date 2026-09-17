# Worker v95 Preview live QA — 2026-09-13

Status: PREVIEW VERIFIED FOR DEMO; overall Security Gate remains DEMO ONLY.

## Current deployment
- URL: https://nosmo-worker-v95-preview-cpqyqkxfy.vercel.app
- Deployment: dpl_5D42mNeKvFE47i86bNUCyDuGwhkZ
- Project: nosmo-worker-v95-preview / prj_OV3yHKWZm91ULCE7bf4lrL3iKped
- Source: implementation commit 1c5ec73bcbde0e834ab923edad36f725a44de71e, apps/work exported as 183 files.
- READY, target null, aliases [] confirmed by get_deployment.
- No database credentials or identity-provider secrets added.

## Validation
Next build and 11 targeted security tests passed before deployment.
On the actual Preview, 10 live checks passed:
1. Root HTTP 200, CSP nonce matches HTML.
2. Worker status without identity: 401.
3. Worker status with forged Sites email header: 401.
4. Status mutation without Origin: 403.
5. Status mutation with foreign Origin: 403.
6. URL credential: 400.
7. Autopilot with forged identity: 401.
8. Nexus import with forged identity: 401.
9. 70 KB mutation payload: 413.
10. CSP nonce changes between requests.

Browser interaction confirmed Worker Card, Documents and Settings render; Settings displays V1.0102. Documents uses existing demo entries; no real documents were imported. Worker Card displays "Sign in for agency sync" and "Your device status is unchanged."
This is not evidence of successful login, real job search, authenticated imports, cloud persistence, or a completed agency invitation.

## Prior deployment retained by owner
The first deployment dpl_3vaBmtebnGzTirES5FSmeSPhzdW4 was unexpectedly marked production by Vercel despite an explicit preview request. The owner subsequently instructed that it should be left in place and work should continue. Deletion is no longer a prerequisite. This changes neither its actual target nor the historical incident record.
The new verified Preview above is separate. Established production projects were not changed. Earlier claims of no production-target deployment must not be applied to the first Worker attempt.

## Remaining authentication decision
Agency uses Replit OIDC with missing OIDC_CLIENT_ID (REPL_ID fallback also missing). Worker uses Sites-provided identity and /signin-with-chatgpt; these are not a configured identity provider on Vercel. Forged header access is deliberately rejected.
A supported real identity-provider configuration is required before authenticated end-to-end tests and any pilot-ready classification. Do not silently rename a different provider to ChatGPT or weaken the identity boundary.
