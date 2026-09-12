# NOSMO SECURITY GATE

Date: 2026-09-12

Scope: NOSMO Agency + NOSMO Work / Worker. NOSMO Emergency Button is intentionally out of scope.

Canonical source was initially inspected at `main` commit `c4d8b544f98e0e39d612b2ceff7f5f5162589b8d`. Before the 2026-09-11 continuation, the security branch was re-inspected and merged with current `main` at `911557f489721affba7ae414f49db36f20375b25` without force-push or UI replacement. On 2026-09-12, `main` was still at that commit and PR #18 was 0 commits behind. Security hardening remains on `security/nosmo-security-gate`. Pull request: #18.

Live deployment evidence in this document covers Agency runtime commit `f9209488ce05896421892102a5fc8f53a9dfc8fb`.

- Vercel project: `nosmo-agency-v10025-preview` (`prj_PuaPLBCXCfzno0U0FB1QTE3IteDT`)
- Environment: Preview only
- Current inspected URL: `https://nosmo-agency-v10025-preview-fyzx20gze.vercel.app`
- Deployment: `dpl_ERSg41gHxjuSNpj3QJqZDQJT4q2F`
- Runtime root: `apps/agency/runtime`
- Deployment state: READY
- Production target: none; production aliases: none
- Production environment variables on this dedicated Preview project: none

## 1. Architecture summary

- NOSMO Agency accepted UI remains the canonical static bundle under `apps/agency/sites/v24/public`, mirrored exactly into `apps/agency/runtime/public` and protected by the existing contract test. The capture manifest now declares and hashes two narrow security overlays: the body-only invite delivery adapter and its bundle import. The accepted layout was not redesigned.
- Agency runtime is Node.js 24 / Express 5 / PostgreSQL (`pg`) / `openid-client`, with Vercel serverless entrypoints and compatibility APIs.
- NOSMO Work / Worker is now a Next/Vinext application with a same-origin `/api/worker/*` server boundary. Worker identity is resolved server-side from the platform-authenticated `oai-authenticated-user-email` header, pseudonymised with `NEXUS_IDENTITY_PEPPER`, and bound to `person_id` through `nexus_identity_bindings`. The previous normal-path draft-token/localStorage authority description is no longer the canonical Worker architecture. GitHub Pages now serves only a canonical redirect, not the Worker application runtime.
- Current Agency database tables are present in Neon project `nosmo-nexus-mvp-dev` (`morning-glitter-88911562`). The separate `nosmo-nexus-cloud-staging` project does not contain the Agency table set.
- A hardened Vercel Agency Preview is now deployed from the exact source metadata above. Its sanitized health endpoint returns HTTP 200 with `databaseReady:true`, `missingTableCount:0`, and `securityGate:"ENFORCED"`.
- The current public Worker URL is a Sites deployment at version 95 with Sites source commit `f6027c9ff045aa3dbd201d02a6089a3b11a3b774`. That source commit cannot be resolved in `mateuszfurmanski-droid/nosmo-workforce`, so the public Worker must not be treated as a deployment of this PR.

## 2. Authentication model

Agency uses the existing OIDC implementation and it has not been replaced.

Observed controls:

- OIDC discovery.
- Authorization Code flow with PKCE S256.
- Cryptographically random `state`, `nonce`, and PKCE verifier.
- Expected `state` and `nonce` validation during callback.
- ID token expected during authorization-code grant.
- Identity mapping uses OIDC `sub` as the stable NOSMO user ID; email/name/picture are profile attributes, not tenant authority.
- Access/refresh tokens are stored inside the server-side session record, not in browser JavaScript.
- Security gate requires a configured canonical production origin (`NOSMO_AGENCY_PUBLIC_ORIGIN` or trusted Vercel production URL) and pins the callback origin to it, preventing callback construction from an attacker-controlled Host header.
- Production OIDC issuer must be HTTPS.

Live Preview findings:

- `ISSUER_URL=https://replit.com/oidc` is explicitly configured for Preview.
- The required `OIDC_CLIENT_ID` is not configured and could not be recovered from the connected repository, Vercel project, or existing source history. The code fallback `REPL_ID` is also not configured.
- Login initiation therefore fails safely with HTTP 503 rather than entering a partial flow.
- A callback without valid state is rejected and redirected to the login entrypoint.
- Static/contract QA still proves PKCE S256, random state/nonce/verifier generation, expected state/nonce checks, ID-token expectation, and server-side session design.

Not yet proven: successful authorization at the real identity provider, callback account mapping, server session creation, Secure/HttpOnly/SameSite attributes on the newly created session cookie, refresh/expiry at the provider, and authenticated end-session behavior. These remain release blockers and must not be inferred from static code.

## 3. Authorization model

Authentication is not treated as authorization.

Agency roles accepted by the hardened runtime are:

- `OWNER`
- `ADMIN`
- `RECRUITER`

Unknown roles, Worker roles and invited/not-active identities do not satisfy Agency role authorization. Existing active membership continues to come from the database.

Least-privilege change in this gate:

- Existing Agency data endpoints require an authenticated active Agency membership with an accepted Agency role.
- Agency account rename/update by an existing member is limited to `OWNER` / `ADMIN`; a `RECRUITER` can no longer rename the Agency merely because they are logged in.
- First-time authenticated Agency creation remains possible for a user with no existing membership.
- Ambiguous multiple active Agency memberships fail closed with `409 NOSMO_AGENCY_CONTEXT_AMBIGUOUS` rather than selecting an arbitrary tenant.
- Unauthenticated protected Agency calls fail at the security perimeter and are audit logged.

Permanent negative role checks are included in `apps/agency/runtime/tests/security-gate.mjs`. HTTP role tests are included in the isolated integration runner.

## 4. Tenant isolation model

Tenant identity is derived server-side from the authenticated user's active `nexus_person_agency_members` membership. Browser-supplied agency IDs are not used as tenant authority.

Relevant Agency database reads and mutations retain `agency_id` predicates. Cross-tenant IDs therefore do not become sufficient authority by themselves.

Evidence completed during this pass:

- Created isolated Neon branch `security-gate-20260907` (`br-gentle-poetry-afn2t6ur`) from the Agency database.
- Added synthetic Agency A and Agency B identities/data on that branch only.
- Agency A query using Agency B request ID returned 0 rows.
- Agency A query using Agency B roster worker ID returned 0 rows.
- Agency A UPDATE targeting Agency B request ID returned 0 rows.
- Control data remained present separately for Agency A and Agency B.

Permanent HTTP A/B test: `apps/agency/runtime/tests/tenant-isolation.e2e.mjs`. It requires either explicit `SECURITY_QA_ALLOW_MUTATION=isolated-branch` plus a dedicated database URL, or `preseeded-isolated-branch` plus an HTTPS Preview and a local fixture file. The second mode exists so database rows can be seeded/verified through the connected Neon control plane when direct PostgreSQL networking is unavailable. Fixture values are validated as synthetic, and no session credential is accepted on the command line.

The permanent runner was executed against Vercel deployment `dpl_EsrGkEm5dPs3xukXGqZ9UBVFzmkR` at commit `f9209488ce05896421892102a5fc8f53a9dfc8fb`, using only synthetic records on Neon branch `security-gate-20260907`. It passed:

- missing, invalid, and expired session denial
- Agency A/B isolation for requests/jobs, roster workers, recruiter profiles, candidates, applications, placements, and invite delivery
- cross-tenant read, write, update, POST, and unsupported DELETE denial
- OWNER/ADMIN versus RECRUITER mutation policy
- same-origin/CSRF denial
- malformed and oversized payload denial
- security headers
- exclusion of seeded private Worker markers

A separate post-run SQL verification confirmed that Agency B request, worker, application, placement, and recruiter values were unchanged and no cross-tenant action was inserted. Cleanup verification returned zero remaining test agencies, memberships, requests, workers, invites, people, sessions, and users.

## 5. Worker privacy / consent model

Worker-owned data and Agency-owned imported roster data are separate trust domains.

Current classification:

**PUBLIC / RECRUITER-SAFE**

For a connected Worker, only the recruiter-safe projection required for recruitment matching/workflow may be exposed to an Agency with a valid grant: worker/person identifier, display identity, primary trade/role, general location/preference data, experience/readiness information, skills/licence summaries and availability/matching information as implemented by the existing safe candidate projection.

**CONSENTED**

The current implementation does not define an expanded "share everything" consent scope. Explicit Worker consent creates an Agency-specific active access grant with scope `RECRUITER_SAFE`. That grant enables the recruiter-safe projection for that Agency only. Consent is tied to the worker invite/onboarding flow and can be revoked in the data model.

**PRIVATE**

Worker phone, email, private address, CV text, document contents, certificate/ID document contents, emergency/private details, Worker-only internal fields and other private document material are not part of the `RECRUITER_SAFE` grant. Grant records explicitly state `privateDocumentsIncluded:false`, `contactDetailsIncluded:false`, and `cvTextIncluded:false`.

Agency-imported roster email/phone/private notes are Agency-owned operational records. They must not be represented as Worker-confirmed data and must never be merged into the Worker recruiter-safe projection merely because a possible worker match exists.

Permanent privacy contract checks are included in existing Agency contract QA and in `tests/security-gate.mjs`.

Current Worker security assessment: the canonical Worker API no longer uses the old signed draft authority token in `localStorage` for normal authenticated status/connection operations. Agency invite creation now returns only an opaque invite reference in the URL fragment; the credential is obtained through an authenticated, same-origin Agency POST and transferred to Worker in a POST body. Worker accepts an invitation code through a password-style in-page field and does not read `?connect=`.

Worker now includes **Settings -> Data & privacy -> Clear local personal data**, with double confirmation and IndexedDB/local browser-data cleanup covered by permanent QA. The browser still intentionally retains substantial local-first personal data until that control is used. Shared-device messaging, retention policy, device-compromise review, and a verified deployment of the current code remain necessary before genuine Worker PII is approved.

The public Worker Sites deployment is not source-mapped to this GitHub commit. Live negative checks on version 95 did confirm HTTPS, unauthenticated `/api/worker/status` denial, and rejection of a client-supplied platform identity header. However, its missing-origin/oversized/token-in-URL behavior differs from the current repository security boundary, and its document responses lack the intended CSP/HSTS/frame/referrer/permissions/COOP headers. It is therefore not deployment evidence for this PR.

## 6. Database security

- Runtime SQL reviewed in the current Agency server, compatibility layer and Worker onboarding handlers is parameterised. No direct `req.*` interpolation into SQL is accepted by permanent static QA.
- Multi-step Agency creation, Worker invite claim and Worker profile finalization use transactions where atomicity is required.
- Database credentials are read from environment variables; targeted repository searches found no committed PostgreSQL connection URL or `DATABASE_URL=` secret assignment.
- Production Pool creation is intercepted before legacy handler loading and forces TLS certificate verification with `rejectUnauthorized:true`. It also normalizes any legacy `sslmode=require` URL to explicit `sslmode=verify-full`, preventing the announced future `pg` major-version semantics from silently weakening certificate verification. Remaining legacy fallback literals were changed from `false` to `true`.
- `.env.example` contains placeholders only and `.gitignore` blocks real `.env` files and common key/certificate files.
- The Preview uses the isolated Neon branch `security-gate-20260907` and the dedicated `nosmo_agency_runtime_qa` role. That role was verified as limited to required DML on the 19 public QA tables; the branch is neither primary, default, nor protected. This does not prove the production role or network policy.
- Neon currently allows public connections at the project setting level and has no IP allow-list configured. Network restriction / application-role design should be reviewed before production scale.

## 7. Session security

Agency session controls:

- Session IDs are generated with 32 cryptographically random bytes.
- Session state is server-side PostgreSQL state.
- Session cookie is HttpOnly.
- Session cookie is Secure in production.
- SameSite is `Lax`.
- Session lifetime is currently seven days.
- Logout deletes the server-side session and clears the cookie.
- Expired DB sessions are deleted.
- Expired OIDC access tokens are refreshed server-side when a refresh token is available; failed refresh invalidates the session.
- Security gate blocks session IDs in URLs.
- Legacy `Authorization: Bearer <session-id>` use is blocked in production by the outer security perimeter; interactive Agency auth is cookie based.
- Access token, refresh token and full session ID are not written by the new structured audit logger.

Session rotation assessment: every successful login already creates a fresh random server session ID. The current implementation does not rotate the session ID on OIDC token refresh. Because tenant role/membership is re-read server-side for protected requests and login itself creates a new SID, refresh rotation is not treated as the present primary pilot blocker, but rotation on privilege-sensitive transitions remains a recommended hardening item.

Live Preview session evidence:

- no session and an invalid cookie are denied with HTTP 401
- a session-style query parameter is denied with HTTP 400
- a legacy bearer session is denied with HTTP 401
- a synthetic expired server session is denied
- a valid synthetic server session was recognized, same-origin logout returned HTTP 200, the database session row was deleted, and reuse of the same cookie was denied with HTTP 401

The logout response expired the `sid` cookie at the correct path. Creation-time `Secure`, `HttpOnly`, and `SameSite=Lax` attributes still require a successful real OIDC callback and are not counted as live-passed.

## 8. CSRF model

Agency browser mutations (`POST`, `PUT`, `PATCH`, `DELETE`) using the session cookie require same-origin `Origin` or `Referer` evidence. The expected production origin is the configured canonical Agency origin. SameSite=Lax provides an additional browser boundary.

Current Worker API requests are same-origin and use the platform-authenticated Worker identity supplied to the server. State-changing Worker API calls now fail closed unless an `Origin` header is present and exactly matches the request origin; the outer Worker security boundary and the inner handler both enforce this. Invite preview/acceptance is POST-based and the invite token is carried in the JSON body, not the URL. The production trust assumption that clients cannot forge or bypass the platform identity header still requires live deployment verification.

This gate fails closed for missing/wrong origin on cookie-authenticated Agency mutations. Permanent CSRF origin tests are present in static and HTTP integration QA.

## 9. Security headers

Agency hardened runtime / Vercel configuration now supplies:

- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- CSP `frame-ancestors 'none'`
- `Referrer-Policy: strict-origin-when-cross-origin`
- restrictive `Permissions-Policy`
- `Cross-Origin-Opener-Policy: same-origin`
- production HSTS
- `Cache-Control: no-store` for API responses

The CSP preserves the accepted first-party frontend architecture and allows first-party scripts/styles plus HTTPS API connectivity; it does not introduce external script origins. On the hardened Preview, the health/API response was verified over HTTPS with CSP, HSTS, `nosniff`, frame denial, Referrer-Policy, Permissions-Policy, COOP, and `Cache-Control:no-store`.

GitHub Pages is now configured only as a canonical redirect surface for NOSMO Work. The current repository has baseline Worker headers in `next.config.ts` (`nosniff`, frame denial, `no-referrer`, restrictive Permissions-Policy, COOP and HSTS), and API responses add `Cache-Control:no-store`. A strict Worker CSP was not forced without runtime verification because the current Next/Vinext build may require framework script behavior. Live version 95 does not emit these intended document headers, which is further evidence that it is not the current repository runtime.

## 10. Rate limiting

Agency security perimeter now applies reasonable best-effort rate classes:

- authentication: 30 / 10 minutes
- invitations: 60 / hour
- assistant/Nexus: 60 / minute
- state-changing Agency operations: 180 / minute
- roster/candidate/pipeline reads: 300 / minute
- general traffic: 600 / minute

Worker onboarding and availability wrappers have separate request limits and payload limits.

Current limiter is process-instance memory and therefore is not a globally consistent distributed rate limiter across multiple serverless instances. For a controlled small pilot it is defense-in-depth, not the sole abuse-control guarantee. Production scale should add provider/edge/global rate limiting (for example at Vercel Firewall/edge or another shared limiter).

Worker `/api/worker/*` now has a separate best-effort per-instance boundary: 120 requests/minute general, 30 requests/minute for connection flows, plus a 64 KiB mutation Content-Length limit. Like the Agency limiter, this is not a substitute for a distributed provider/edge control.

Live Preview evidence: a 35-request login burst on the tested `f9209488` deployment produced 29 safe HTTP 503 responses for the missing OIDC client and 6 HTTP 429 responses. This proves enforcement on the exercised instance, not globally distributed enforcement.

## 11. Logging / audit trail

New structured security audit events record, where applicable:

- login start/callback and success/failure result
- logout
- unauthenticated protected access denial
- role denial
- ambiguous tenant denial
- CSRF/origin denial
- session-in-URL denial
- legacy bearer-session denial
- account mutation
- recruiter invitations
- profile mutation
- other Agency data mutations
- unhandled security/runtime failures

Fields are limited to event type, timestamp, actor ID, Agency ID, role, result, HTTP method/path and request ID. Request bodies, passwords, access tokens, refresh tokens and complete session IDs are not included.

Existing Worker onboarding events continue recording Worker profile/consent lifecycle without persisting the authority token. Production error logging is redacted before legacy handler errors reach `console.error`.

Vercel build/runtime logs for the tested hardened deployment were inspected after health, authentication-negative, payload, rate-limit, tenant, invite, and logout tests. No database URL, bearer/session credential, invite credential, synthetic private-field marker, or test email was found. The expected missing-`OIDC_CLIENT_ID` login error was present. After the TLS normalization change, the prior `pg` sslmode compatibility warning was absent from the new deployment logs.

## 12. Secret management

- No real credential was intentionally committed during this pass.
- `.env.example` uses placeholders only.
- `.gitignore` blocks `.env`, `.env.*` (except `.env.example`), PEM/key/P12/PFX files and local build/runtime artifacts.
- Permanent security QA scans committed text for high-confidence private keys, GitHub tokens, AWS access keys, OpenAI-style keys and PostgreSQL URLs containing apparent passwords.
- Targeted repository searches during the audit found no committed PostgreSQL credential URL and no `DATABASE_URL=` assignment containing a secret.
- PR #18 security CI ran the committed-source scan successfully.

Production credentials must remain in deployment/provider secret storage. Secret values must not be copied into QA logs or this document.

Preview-only Vercel configuration now contains:

- `DATABASE_URL` for the isolated Neon QA branch
- `WORK_APP_BASE_URL`
- `NEXUS_ONBOARDING_PUBLIC_ORIGINS`
- independent `NEXUS_ONBOARDING_INVITE_SECRET` and `NEXUS_ONBOARDING_DRAFT_SECRET`
- `ISSUER_URL`

`OIDC_CLIENT_ID` remains missing. No secret was added to source or production configuration.

## 13. Backup / recovery status

Neon metadata inspected for the two known NOSMO projects shows:

- current history retention setting: 21,600 seconds (6 hours)
- no manual snapshots currently listed
- provider project/branch recovery capability exists, but an application-specific restore exercise has not been completed in this security pass

For Agency, the identified database project is `nosmo-nexus-mvp-dev`. What NOSMO still needs to decide/configure externally before relying on this for production-grade recovery:

- acceptable recovery point objective and retention period
- whether to extend provider history retention
- snapshot/backup policy if required beyond provider history
- documented restore procedure
- a restore drill using non-production data

No backup capability has been fabricated or inferred beyond the provider metadata actually inspected.

## 14. Automated tests completed

2026-09-11 Worker security additions:

- permanent Worker API boundary regression tests for same-origin mutation enforcement, request-size limits, rate limiting, URL credential rejection and browser security headers
- Worker invite preview regression updated to require POST body token transport and to reject `/connection?token=...`
- security workflow now runs a distinct Worker job; watching `apps/work/**` no longer gives a false green result from Agency-only tests
- Worker production dependency audit initially exposed one critical and four high production issues; Next and safe transitive dependencies were patched, including Next `16.2.6` -> `16.3.4`
- final Worker production audit (`npm audit --omit=dev --audit-level=high`) passed with **0 production vulnerabilities**
- full development-tooling audit still reports 14 issues (10 high, 4 moderate) in build/dev tooling such as Vinext/Vite/Wrangler/Cloudflare/Drizzle-related chains; resolving all currently requires breaking upgrades, so these are tracked rather than hidden with `--force`

Existing functional QA is preserved. New security QA is added alongside it.

Added permanent static/contract security QA:

- authorization role policy
- owner/admin-only account mutation policy
- same-origin/CSRF origin behavior
- production PostgreSQL certificate verification policy
- outbound HTTPS URL policy
- CSP/security-header policy
- safe error projection
- rate-limit policies
- secured Agency/Vercel entrypoints
- secured Worker onboarding entrypoints
- recruiter-safe consent/private-field contract
- obvious request-to-SQL interpolation rejection
- committed environment/secret scan

Added permanent isolated HTTP integration QA:

- unauthenticated access denied
- invalid, missing, and expired session denied
- Agency A cannot read Agency B requests/jobs, roster, recruiter profile, candidates, applications, or placements
- Agency A cannot mutate Agency B requests, roster, applications, placements, candidate actions, or invitation delivery
- unsupported cross-tenant DELETE operations fail closed
- SQL-looking identifier is handled safely
- recruiter cannot perform owner/admin account mutation
- missing/wrong mutation origin denied
- malformed JSON safely rejected
- oversized request safely rejected
- security headers present
- seeded private Worker fields are excluded
- denied cross-tenant operations do not mutate Agency B

Evidence actually passed during this pass:

- Manual isolated Neon A/B SQL-layer tenant test: **PASSED**.
- Permanent `tenant-isolation.e2e.mjs` against hardened Vercel Preview commit `f9209488ce05896421892102a5fc8f53a9dfc8fb`: **PASSED**.
- Separate Neon post-run non-mutation verification and synthetic-data cleanup verification: **PASSED**.
- Live body-only invitation creation/delivery: **PASSED**; the credential appeared only in the authenticated POST response body and not in returned URLs.
- Live valid-session logout and database invalidation: **PASSED**.
- Live health, unauthenticated/invalid/expired-session, CSRF, malformed JSON, oversized payload, security headers, HTTPS, and rate-limit checks: **PASSED**.
- PR #18 `Worker Agency handoff QA`: **PASSED** on `f9209488`.
- PR #18 `NOSMO Security Gate`: **PASSED** on `f9209488`.
- PR #18 `NOSMO Agency Sites v24 parity`: **PASSED** on `f9209488`.
- PR #18 `NOSMO Work V1.0102 Browser QA`: **PASSED** on `f9209488`.
- Existing Agency runtime contract inside the gate: **PASSED** (21 compatibility routes, accepted API prefix, accepted UI byte parity, recruiter-safe consent gate, placement readiness gate, Ask Nexus read-only).
- Existing Worker↔Agency handoff contract: **PASSED** (HTTPS remote API requirement, explicit consent, recruiter-safe projection, private fields excluded, availability sync/offline retry).
- New `nosmo-security-gate-static-qa/v1`: **PASSED** (authorization, CSRF origin, production TLS verification, headers, safe errors, rate policies, secured entrypoints, Worker consent projection, SQL interpolation guard, committed-secret scan).
- Dependency audit on Node 24.20.0 / npm 11.19.0: **PASSED — `found 0 vulnerabilities`**.

Local Worker regression execution also passed its production build and all 71 tests, with 0 lint errors (9 pre-existing warnings). Agency and Worker `npm audit --omit=dev --audit-level=high` each reported 0 vulnerabilities.

An additional local interactive browser attempt for the protected Agency Preview could not start because the available runner had no Chrome binary and its network policy blocked the Chrome-for-Testing download. This is recorded as not executed, not as a pass. The permanent Worker browser workflow did pass in GitHub Actions.

## 15. Outstanding risks

Release blockers / material risks:

1. Agency `OIDC_CLIENT_ID` is missing in Preview. Successful identity-provider authorization, callback account mapping, session creation, creation-cookie attributes, refresh/expiry, and authenticated logout cannot be credited.
2. The public Worker is Sites version 95 from an internal source commit that is not resolvable in this GitHub repository. Its live request-order and header behavior differs from this PR, so current Worker controls are not proven deployed.
3. The current public Worker document lacks the intended CSP/HSTS/frame/referrer/permissions/COOP headers. A compatible strict CSP remains unverified.
4. Worker local-first PII has a tested double-confirmation clear-device control, but retention/shared-device messaging and device-compromise expectations are not yet approved for a genuine PII pilot.
5. The Agency interactive browser render could not be executed in this environment because Chrome was unavailable; HTTP/static checks and CI passed, but this limitation is not hidden.
6. Production database application role/least privilege and network restriction are not proven. Preview evidence is intentionally limited to the isolated QA branch and role.
7. Backup retention is only the currently observed 6-hour Neon history setting and no restore drill has been completed.
8. In-process rate limiting is not globally distributed across serverless instances.

Non-blocking hardening candidates after the above release blockers:

- rotate Agency SID on selected privilege-sensitive transitions / token refresh if operationally justified
- global provider/edge rate limiting
- longer recovery retention and tested restore process
- independent penetration test before broad production rollout

## 16. External tasks still required

Before a genuine personal-data pilot can be approved:

- add the existing Replit OIDC application client ID as `OIDC_CLIENT_ID` in Vercel project `nosmo-agency-v10025-preview`, Preview environment only, then redeploy without `--prod`
- execute live OIDC login, callback, expiry/refresh and logout tests
- verify session creation sets Secure, HttpOnly, and SameSite=Lax on the actual callback response
- publish or otherwise identify a Worker deployment whose source SHA resolves to this repository, then rerun the Worker identity/origin/payload/URL-credential/header tests
- add and test compatible Worker CSP/document headers on that mapped deployment
- approve Worker local-device PII retention and shared-device behavior around the implemented clear-device control
- confirm application database role privileges and provider network policy
- define recovery retention and perform a non-production restore drill

Legal documents, insurance, Cyber Essentials, ISO 27001, penetration-test certification and GDPR legal assessment are separate external activities. None is claimed by this gate.

## 17. Final release classification

# DEMO ONLY

Evidence supporting this classification:

- Repository security controls have been materially hardened without redesigning accepted Agency UI.
- Existing OIDC design includes PKCE/state/nonce and server-side Agency sessions.
- Tenant authority is server-derived from membership.
- Recruiter-safe Worker consent/private-field boundaries are present.
- Worker API mutations now fail closed on missing/cross-origin Origin, invite credentials are removed from URLs, baseline response headers/rate limits/payload limits are present, and Worker production dependencies pass the high-severity production audit gate.
- A hardened Agency Preview is READY on the exact tested runtime commit, with the isolated Neon database connected and TLS pinned to `verify-full`.
- Permanent live HTTP tenant A/B tests and separate database non-mutation/cleanup verification passed.
- Live negative-auth, CSRF, payload, headers, invitation, rate-limit, expired-session, and logout-invalidation tests passed.
- Existing Agency/Worker functional contracts, static security QA, Agency parity, and Worker browser QA passed on PR #18.
- Dependency audit passed with 0 vulnerabilities reported by npm for the installed runtime dependency set.

However, the minimum PILOT READY release rule is not yet satisfied. Agency OIDC cannot complete without `OIDC_CLIENT_ID`, so live account mapping/session creation and creation-cookie attributes remain unverified. The public Worker source cannot be mapped to this repository and demonstrably lacks part of the current security boundary/header behavior. Those are release blockers even though Agency database and tenant integration now pass.

Do not use genuine worker/recruiter personal data until this document is updated with passing deployment evidence and the classification is explicitly changed.
