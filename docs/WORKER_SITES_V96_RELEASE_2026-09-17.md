# NOSMO Work Sites v96 rollback checkpoint

Date: 2026-09-17

## What happened

- ChatGPT Sites project: `appgprj_6a93f57013108191a7a78c97da0b378c`
- Sites version 96 was deployed and then rolled back
- deployed source commit: `847222882f4a96720e9f32223d94fb09b69364a8`
- live URL: `https://mateusz-furmanski-job-hub.mateusz-furmanski.chatgpt.site`
- audience remained public
- version 96 deployed successfully, but it was the wrong target for the required Clerk/Google login flow

Version 96 moved the Worker chat-first app preparation flow from the separate Vercel Preview into Sites. This was incorrect because Sites uses ChatGPT identity while the accepted development target uses Clerk and Google login on Vercel.

## Rollback

- public Sites was restored to accepted version 95
- restored source commit: `f6027c9ff045aa3dbd201d02a6089a3b11a3b774`
- rollback deployment: `appgdep_6aaba1f2dab481918851cf0ea8281b36`
- version 96 remains saved but inactive and can be inspected without being treated as the accepted app
- correct Clerk/Google-login return point branch: `return-point/worker-google-login-2026-09-17`
- pre-rollback trace branch: `return-point/sites-v96-before-rollback-2026-09-17`

## Evidence retained from version 96

- Sites runtime contains `OPENAI_API_KEY` and `OPENAI_MODEL` by name. Secret values were not read or copied.
- The complete Sites build passed.
- 97 tests passed, 0 failed.
- The live `/api/nexus-actions` route rejected an identity-less synthetic request with `401 sign_in_required`, confirming that the deployed route and identity boundary are active.
- Recent Worker logs showed no runtime crash or server error for the release checks.

## Correct next target

Continue only on the protected Vercel Worker Preview with Clerk/Google login. Configure and verify `OPENAI_API_KEY` in that Vercel project, then run a real signed-in Ask Nexus model response before promotion. Do not move this flow to Sites as a substitute.

The earlier Vercel `not_configured` result was from the correct Google-login deployment but a separate environment. The key configured on ChatGPT Sites does not configure Vercel.

## Canonical source follow-up

PR #18 contains the Node 24 test compatibility and updated chat-first Apps assertions at commit `e1093a1968cef624aa1308d3ba5eb44784ccef7f`. Agency production and its database were not changed by this Worker release.
