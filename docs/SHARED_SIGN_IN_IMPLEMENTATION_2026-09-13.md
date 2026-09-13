# NOSMO shared sign-in — accepted scope 2026-09-13

Implementation status: NOT CONNECTED. This document records the owner-approved provider expansion and the concrete activation contract. It does not credit any new authentication checks as passed.

## Methods for both products
| Method | Intended use | Activation dependency |
|---|---|---|
| Google | Worker and recruiter accounts | OAuth connection with verified callback configuration |
| Apple | Apple accounts, including Hide My Email | Owner-controlled Apple Developer setup, primary App ID, Services ID, signing key and allowed return URL |
| Microsoft | Personal Microsoft accounts and agency work accounts | Registered connection; explicitly test personal and organizational accounts |
| Email one-time code | Users without a supported social account | Verified email delivery, code expiry, replay prevention and attempt limits |

No Facebook, GitHub, LinkedIn or SMS is required for this release. Additional methods can be considered later without changing NOSMO account identity.

## Integration choice
Use one managed authentication tenant for Agency and Worker. Clerk is the proposed implementation platform because it supports both Next.js and server-side applications and has a Vercel Marketplace integration. Provision a DEVELOPMENT instance first. Never auto-provision it into the existing production projects.
Activation entry: https://vercel.com/marketplace/clerk

The current callable tools expose no Clerk tenant provisioning or configuration endpoint, and the Vercel CLI has no authenticated session. The available Neon OAuth connector lacks an Apple provider, so it is not sufficient for the accepted full provider set through the exposed operations.

Do not treat a marketplace connection as proof that every social method is enabled. Confirm each method in the tenant and with a real callback test.

## Application changes to implement once tenant configuration is available
1. Worker: use managed server-verified sessions on Vercel, replace the Sites-only sign-in route with /sign-in, and preserve Sites behavior on the existing Sites deployment.
2. Agency: replace the unconfigured Replit initiation flow with the same managed tenant, retaining server-derived membership checks.
3. Use a single managed user identifier as the external subject in both applications. Scope it by the configured tenant/issuer. Map it explicitly to an internal NOSMO user/person.
4. Never link existing accounts by matching email alone. Apple relay email, changed email and identical subjects from different issuers must not cause account takeover or data loss. Migration of existing accounts requires proof of control or an audited administrator process.
5. Keep cookies host-scoped. A shared account directory does not imply a cookie shared across unrelated vercel.app hosts. Use supported redirect/session flows.
6. Tenant membership remains in NOSMO; authentication-provider user metadata or a supplied agencyId must never grant recruiter/owner access.
7. Enable only configured methods on the sign-in screen. Preserve accepted app layout outside authentication.

## Concrete verification gate
- Google, Apple, Microsoft and email code: successful sign-in, cancellation and sign-out.
- Apple Hide My Email and repeated sign-in resolve to the same account.
- Wrong/expired/replayed code rejected; repeated guesses rate-limited.
- Invalid state/nonce, altered callback, wrong issuer/audience, expired/revoked session rejected.
- Forged oai-authenticated-* headers remain rejected on Vercel.
- Worker availability and invite acceptance require a verified session.
- Agency A/B isolation survives the provider change; signing in never grants agency access by itself.
- Existing records remain intact; no automatic email-based merge.
- Test session creation, expiry, logout and reauthentication in both applications.
- Verify on isolated Preview and database branch before changing the release classification.

## Current evidence and limits
Agency v28 Preview and Worker v95 Preview are deployed. Worker implementation source: 1c5ec73; verified Preview: dpl_5D42mNeKvFE47i86bNUCyDuGwhkZ. Latest QA commit before this decision: 40c62ceb90b1ce081ff1aa551ec6cee274d1e8c7.
Existing negative-auth checks remain valid. They do not establish managed-provider login. Security Gate remains DEMO ONLY until the above flow is integrated and tested.

## Primary references
- https://vercel.com/marketplace/clerk
- https://clerk.com/docs/quickstarts/nextjs
- https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/
