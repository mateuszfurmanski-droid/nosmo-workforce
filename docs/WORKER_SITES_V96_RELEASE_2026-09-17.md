# NOSMO Work Sites v96 release checkpoint

Date: 2026-09-17

## Released state

- ChatGPT Sites project: `appgprj_6a93f57013108191a7a78c97da0b378c`
- Sites version: 96
- deployed source commit: `847222882f4a96720e9f32223d94fb09b69364a8`
- live URL: `https://mateusz-furmanski-job-hub.mateusz-furmanski.chatgpt.site`
- audience remains public
- deployment completed successfully; the live root returned HTTP 200

Version 96 moves the current Worker chat-first app preparation flow from the separate Vercel Preview into the canonical Sites application. It includes the twelve app workspaces, Ask Nexus action planning, first-login workspace, contact help, local privacy controls and the Worker security boundary.

## Configuration and verification

- Sites runtime contains `OPENAI_API_KEY` and `OPENAI_MODEL` by name. Secret values were not read or copied.
- The complete Sites build passed.
- 97 tests passed, 0 failed.
- The live `/api/nexus-actions` route rejected an identity-less synthetic request with `401 sign_in_required`, confirming that the deployed route and identity boundary are active.
- Recent Worker logs showed no runtime crash or server error for the release checks.

## Important remaining proof

A real signed-in Ask Nexus model response is still required before recording AI roundtrip PASS. The identity-less bypass is intentionally not accepted as a Worker identity, and caller-supplied identity headers are stripped by Sites. Do not weaken that boundary for testing.

The earlier Vercel `not_configured` result was from a separate deployment environment. The key was configured on ChatGPT Sites, so that Vercel result did not test the Sites runtime.

## Canonical source follow-up

PR #18 contains the Node 24 test compatibility and updated chat-first Apps assertions at commit `e1093a1968cef624aa1308d3ba5eb44784ccef7f`. Agency production and its database were not changed by this Worker release.
