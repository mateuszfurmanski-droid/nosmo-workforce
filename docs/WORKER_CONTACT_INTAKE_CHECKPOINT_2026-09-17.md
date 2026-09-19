# Worker contact intake checkpoint — 2026-09-17

## Recovery anchors
- Correct product: existing NOSMO Worker, apps/work, Vercel project prj_OV3yHKWZm91ULCE7bf4lrL3iKped (nosmo-worker-v95-preview).
- Previous Preview: dpl_8EKrX1Wnsh7BkcmUBZVcJibHYxiU, https://nosmo-worker-v95-preview-frmfo9vr5.vercel.app/ . Confirmed READY, no production aliases.
- Parent source: 5a9fbc83f926c34baabbd8054197dc92cd53c9ba.
- Local return point: return-point/worker-2026-09-17-before-contact-intake.
- Earlier mandatory-onboarding attempt a48a311 is not the active source and was not deployed.
- Mandatory imports means required product functionality, NOT mandatory user completion or app lockout.
- A previous GitHub push was rejected by automatic approval review because the destination was not verified for this code. No further push attempted. Local branches/commits alone are not a durable remote backup; explicit authorization is needed before retrying that destination.

## This bounded change
- Parse VCF and Google/Outlook/NOSMO CSV contacts with company, role and notes.
- Review before saving, keyword/company matching, select all/individual selection/cancel.
- Phone picker uses the same review flow; unsupported browsers retain file fallback.
- Store selected contacts only. Reject empty/invalid/oversized files and register overflow visibly.
- Existing Clerk/Google auth, optional onboarding, production and other products preserved.

## Verification before Preview
- VERCEL=1 next build --webpack: PASS, including TypeScript. Plain next build without VERCEL uses the other provider's configuration and fails; use the correct environment.
- npm test (including vinext build): 103/103 PASS.
- New contact modules targeted ESLint: PASS.
- Browser cannot open localhost (ERR_BLOCKED_BY_CLIENT). Previous protected Preview redirects this browser to Vercel sign-in.
- Preview deployment, feature UI and real-device tests still pending at this checkpoint.

## Still not complete
- This is selected-file/system-picker import, not automatic background source discovery or Google account contact sync.
- Native Android companion points to the old Sites address; its auth and contact provider require a separate verified change. Do not ship it as ready for the Clerk Preview.
- Document discovery and continuous screen/call capture are not implemented by this change.
- AI provider configuration/model roundtrip remains a separately unverified blocker documented in earlier checkpoints.
