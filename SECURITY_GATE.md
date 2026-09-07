# NOSMO SECURITY GATE

Date: 2026-09-07

Scope: NOSMO Agency + NOSMO Work / Worker. NOSMO Emergency Button is intentionally out of scope.

Canonical source inspected before changes: `main` at `c4d8b544f98e0e39d612b2ceff7f5f5162589b8d` (`Worker V1.0102: synchronize status to Agency`). No open pull requests existed at the start of this security pass. Security hardening is being performed on `security/nosmo-security-gate`; accepted Agency UI files are not redesigned or replaced.

## 1. Architecture summary

- NOSMO Agency accepted UI remains the canonical static bundle under `apps/agency/sites/v24/public`, mirrored byte-for-byte into `apps/agency/runtime/public` and protected by the existing contract test.
- Agency runtime is Node.js 24 / Express 5 / PostgreSQL (`pg`) / `openid-client`, with Vercel serverless entrypoints and compatibility APIs.
- NOSMO Work / Worker remains a static PWA. The worker onboarding and availability handoff call Agency-hosted serverless endpoints with signed worker authority tokens.
- Current Agency database tables are present in Neon project `nosmo-nexus-mvp-dev` (`morning-glitter-88911562`). The separate `nosmo-nexus-cloud-staging` project does not contain the Agency table set.
- The currently discoverable Vercel Agency production deployment is `nosmo-agency-v10025-preview`. It is stale: `/api/person-card/agency/v1/_health` returns 404 and `/` serves an older V1.0025 preview bundle containing `preview-mock.js`. Therefore it is not evidence that the canonical runtime or this security gate is deployed.
- Vercel HTTPS/HSTS is active on that stale deployment, but current canonical application authentication/database behavior has not been verified there.

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

Not yet proven: a successful end-to-end login/callback/logout/refresh cycle on a deployment of the hardened canonical runtime. This is a release blocker.

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

Permanent HTTP A/B test: `apps/agency/runtime/tests/tenant-isolation.e2e.mjs`. It requires explicit `SECURITY_QA_ALLOW_MUTATION=isolated-branch` and a dedicated `SECURITY_QA_DATABASE_URL`, then checks unauthenticated denial, invalid session denial, cross-tenant reads, cross-tenant writes, SQL-looking identifiers, role denial, CSRF denial, malformed/oversized requests and security headers. It is intentionally not allowed to mutate a database unless the isolated-branch opt-in is supplied.

The SQL-layer A/B test passed. The HTTP A/B integration test has not yet been executed against a deployed hardened runtime. Under the release rule, tenant isolation is therefore not yet considered fully passed for PILOT READY.

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

Remaining Worker security blocker: the static Worker app currently stores its signed draft authority token and local Worker draft data (including personal profile fields) in browser `localStorage`. The token can authorize loading/saving the Worker server profile for up to the current token lifetime. This is materially different from the HttpOnly Agency session model and remains a blocker for a real-person-data pilot until Worker has a stronger authenticated storage/session boundary or the authority is redesigned to a safely constrained model. A quick storage change was not forced because it would break the existing persistence/recovery flow without adding a real Worker authentication boundary.

## 6. Database security

- Runtime SQL reviewed in the current Agency server, compatibility layer and Worker onboarding handlers is parameterised. No direct `req.*` interpolation into SQL is accepted by permanent static QA.
- Multi-step Agency creation, Worker invite claim and Worker profile finalization use transactions where atomicity is required.
- Database credentials are read from environment variables; targeted repository searches found no committed PostgreSQL connection URL or `DATABASE_URL=` secret assignment.
- Production Pool creation is now intercepted before legacy handler loading and forces TLS certificate verification with `rejectUnauthorized:true`.
- `.env.example` contains placeholders only and `.gitignore` blocks real `.env` files and common key/certificate files.
- The actual production application database role/least-privilege grants have not been proven because the live canonical Vercel environment is not available/verified. Do not assume the app uses a least-privilege PostgreSQL role.
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

## 8. CSRF model

Agency browser mutations (`POST`, `PUT`, `PATCH`, `DELETE`) using the session cookie require same-origin `Origin` or `Referer` evidence. The expected production origin is the configured canonical Agency origin. SameSite=Lax provides an additional browser boundary.

Worker onboarding does not use the Agency session cookie. It uses signed bearer authority in the request body with an explicit CORS origin allow-list and the Worker client uses `credentials:"omit"`. Therefore synchronizer-token CSRF is not applied to that non-cookie authority model.

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

The CSP preserves the accepted first-party frontend architecture and allows first-party scripts/styles plus HTTPS API connectivity; it does not introduce external script origins. CSP must still be exercised on a real preview deployment before it is credited as regression-free.

Worker is currently deployed as a static PWA through GitHub Pages workflow. Repository code alone cannot guarantee the same custom HTTP header set from that hosting surface. Worker hosting/CSP/header behavior remains a deployment verification item.

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

## 12. Secret management

- No real credential was intentionally committed during this pass.
- `.env.example` uses placeholders only.
- `.gitignore` blocks `.env`, `.env.*` (except `.env.example`), PEM/key/P12/PFX files and local build/runtime artifacts.
- Permanent security QA scans committed text for high-confidence private keys, GitHub tokens, AWS access keys, OpenAI-style keys and PostgreSQL URLs containing apparent passwords.
- Targeted repository searches during the audit found no committed PostgreSQL credential URL and no `DATABASE_URL=` assignment containing a secret.

Production credentials must remain in deployment/provider secret storage. Secret values must not be copied into QA logs or this document.

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
- invalid/missing session denied
- Agency A cannot read Agency B request/roster data
- Agency A cannot write Agency B request
- SQL-looking identifier is handled safely
- recruiter cannot perform owner/admin account mutation
- missing/wrong mutation origin denied
- malformed JSON safely rejected
- oversized request safely rejected
- security headers present
- denied cross-tenant write does not mutate Agency B

Manual isolated Neon A/B SQL-layer tenant test: **PASSED**.

Post-change GitHub CI (`npm run check` + dependency audit) and HTTP integration execution are still required before these newly added tests can be recorded as passed end-to-end.

## 15. Outstanding risks

Release blockers / material risks:

1. The current live Vercel Agency deployment is stale and does not run the canonical runtime/security gate.
2. Hardened canonical Agency OIDC + DB + cookie/session behavior is not yet tested on a real deployment.
3. HTTP-level multi-tenant A/B test has been created but not yet executed against the hardened runtime.
4. Worker draft authority and personal draft data remain accessible to Worker JavaScript/localStorage; Worker has no equivalent HttpOnly authenticated session boundary.
5. Custom Worker hosting security headers/CSP are not yet verified.
6. Production database application role/least privilege is not proven from the current deployment configuration.
7. Dependency audit has been added to CI but has not yet been executed for this security branch.
8. Backup retention is only the currently observed 6-hour Neon history setting and no restore drill has been completed.
9. In-process rate limiting is not globally distributed across Vercel instances.

Non-blocking hardening candidates after the above release blockers:

- rotate Agency SID on selected privilege-sensitive transitions / token refresh if operationally justified
- global provider/edge rate limiting
- longer recovery retention and tested restore process
- independent penetration test before broad production rollout

## 16. External tasks still required

Before a genuine personal-data pilot can be approved:

- deploy the hardened canonical Agency runtime, not the stale V1.0025 preview
- configure production secrets/environment without exposing values: `DATABASE_URL`, OIDC client/issuer, canonical Agency origin, Worker public origin/base, onboarding signing secrets
- verify actual HTTPS and Secure cookie behavior on that deployment
- execute live OIDC login, callback, expiry/refresh and logout tests
- execute the isolated HTTP A/B tenant test against the hardened runtime/database branch, then separately verify production tenant behavior without synthetic destructive writes
- verify Worker deployment/header behavior
- resolve the Worker browser credential/private-local-storage boundary before using genuine Worker PII
- confirm application database role privileges and provider network policy
- define recovery retention and perform a non-production restore drill
- complete dependency audit CI

Legal documents, insurance, Cyber Essentials, ISO 27001, penetration-test certification and GDPR legal assessment are separate external activities. None is claimed by this gate.

## 17. Final release classification

# DEMO ONLY

Evidence supporting this classification:

- Repository security controls have been materially hardened without redesigning accepted Agency UI.
- Existing OIDC design includes PKCE/state/nonce and server-side Agency sessions.
- Tenant authority is server-derived from membership.
- Recruiter-safe Worker consent/private-field boundaries are present.
- Isolated Neon SQL-layer A/B tenant tests passed.
- Permanent static and HTTP security QA have been added.

However, the minimum PILOT READY release rule is not yet satisfied because the hardened canonical runtime is not the live deployment, live authentication/database/secure-cookie behavior is unverified, HTTP tenant isolation has not yet been executed end-to-end, and the Worker browser authority/private-storage model remains unresolved for genuine personal data.

Do not use genuine worker/recruiter personal data until this document is updated with passing deployment evidence and the classification is explicitly changed.
