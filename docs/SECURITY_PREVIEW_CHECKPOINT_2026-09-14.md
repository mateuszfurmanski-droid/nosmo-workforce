# NOSMO Preview checkpoint — 2026-09-14

Scope: Agency v28 and Worker v95, Preview only. Production, Emergency and Nexus Core are not modified.

## Worker
- Clerk Preview: https://nosmo-worker-v95-preview-dox97hxjk.vercel.app
- Deployment: dpl_2Zb3AdCMouGrzq8gcf7TT6eGmZJV (READY, target null).
- User reported successful login and visible profile icon.
- Full authenticated Worker-to-Agency consent/handoff E2E is still outstanding.

## Agency
- Source commit: f7696b0bdb293c24055b01f34d70fb17dae89597.
- Branch: security/nosmo-security-gate in mateuszfurmanski-droid/nosmo-workforce; PR #18.
- Preview: https://nosmo-agency-v10025-preview-6sz9u4ztx.vercel.app
- Deployment: dpl_E7LEej2qMur4ohsb73P5rVHPQcrF (READY, target null, aliases empty).
- Accepted v28 static UI preserved byte-for-byte.
- /api/login renders Clerk sign-in. Sign-up stays on Agency via mode=sign-up.
- Preview-only integration verifies Clerk JWT signature, issuer, authorized party, subject and session.
- Exchanges validated identity for opaque HttpOnly Agency session; each API request validates upstream Clerk session status/expiry/user once, shared by role gate and application.
- Existing active membership and role checks remain authoritative; no email-based account linking.
- Logout deletes Agency session and revokes the linked Clerk session.
- Preview refuses legacy sessions; non-Preview authentication behavior is preserved.
- npm run check passed: 3 Clerk security tests, 9 Agency Nexus tests, runtime contract, Worker handoff contract, static Security Gate.
- Local HTTP checks passed: login 200, signed-out user endpoint 200, private roster 401, exchange without origin 403, missing token 400.
- Live browser confirmed Google, email/password inputs, and same-origin Sign up link.
- Live API connector returned Vercel SSO redirects: no application-level live API verdict claimed.
- User login, account creation, logout and two-tenant isolation under real Clerk sessions still require verification.
- Clerk session verification calls Backend API on each request; latency/rate-limit resilience remains a Preview limitation.

## Remaining gate
DEMO / PREVIEW ONLY; Security Gate is not complete. Verify real Agency login first, then authenticated roles/tenant isolation and Worker consent handoff. Apple, Microsoft, email OTP and phone/second-device login are not yet verified/configured. Do not claim these methods work.

Clerk application: app_3JKNfA5L1KCva6oAPuSYM79oOEB, Marketplace connected to both Preview projects. Do not read existing environment files or expose secret keys. The previous CLI login flow was unusable; do not restart it unnecessarily. Keep stages short and communicate progress.

Local checkout: /workspace/scratch/dd163c53874b/auth-integration. Its local history predates connector commits; do not force-push it. Base future GitHub API commits on current remote branch HEAD.
