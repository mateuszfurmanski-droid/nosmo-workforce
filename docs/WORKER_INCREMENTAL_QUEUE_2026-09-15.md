# Worker incremental delivery queue

User directive: one change at a time; preserve accumulated requirements. Worker Preview only. No production, merge, force push, Nexus Core or unrelated apps.

## Current single change
Commit 115365239894291129db01c0dfbfff3f18a6e903 changes only apps/work/app/page.tsx.
- External app tiles are placed immediately after the Apps page heading, before Work tools and integration settings.
- Removed details/summary wrapper; app grid always visible on initial entry.
- Same 12 apps, icons, order within the grid and click handlers retained.
- TypeScript syntax check: zero errors. Source ordering and absence of collapsed Apps container verified.
- Not yet deployed. No visual or mobile PASS claimed.

## Separate next stages
1. Deploy this single visibility change to Worker Preview and verify Apps entry/order.
2. Verify already-deployed first-login wizard with a real signed-in session, skipped steps, contacts and document review. Existing deployment dpl_BswUnaDdzeyPh2LBqQWmeSFiskbC passed next build; runtime checks remain open.
3. Add preparation screens for ALL external app tiles incrementally. Communication apps prepare recipient/message; other apps prepare relevant tasks. Explicit handoff only after preparation. Requirements: apps/work/docs/ADDON_WHATSAPP_INTEGRATION_PATHS.md (2026-09-15 add-on).
4. Finish pending narrow-screen Worker Card/Settings/theme/header and signed-in avatar checks. Preserve square controls, round 20% larger account avatar, top-right red !, thin nav outlines, themed Nexus and opaque Clerk modal.
5. Resume separate Worker-Agency Security Gate browser flow: invite, connect, isolation, revoke. Previously recorded 13 security tests and 8 SQL assertions do not replace browser verification.

Current readiness: Preview/demo; user visual acceptance still pending.
