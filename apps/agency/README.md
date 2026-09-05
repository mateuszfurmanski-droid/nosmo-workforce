# NOSMO Agency

Canonical location for the existing NOSMO Agency recruiter / agency application.

Baseline: V1.0024.  
Current development line: V1.0025.

## V1.0025 core runtime

The canonical standalone frontend now lives directly in this directory:

- `index.html` — mobile-first Agency shell;
- `styles.css` — NOSMO visual system with dark/light support;
- `app.js` — authenticated Agency UI wired to the existing tenant-scoped APIs;
- `vercel.json` — same-origin `/api` proxy for standalone deployment;
- `tests/static-smoke.mjs` — critical UI/API/privacy contract checks.

The runtime deliberately reuses the existing Agency data model and API contracts. It does not create a second ATS database and does not depend on the NOSMO Work frontend.

Current working surfaces in this development branch include recruiter sign-in/session gate, Agency Account setup, Dashboard, Workers (imported vs recruiter-safe connected), Requests, explainable Matches/Pipeline, Ask Nexus, communication activity, Agency/Recruiter Profile, Settings and logout.

Important security boundary: tenant scope is derived server-side from authenticated Agency membership. The browser does not accept or expose an arbitrary tenant ID. Worker-owned profiles remain visible only through active `RECRUITER_SAFE` consent grants. Imported roster records are explicitly labelled as agency-owned and not Worker App confirmed.

## Preserved V1.0024 source

`legacy/v1.0024/` is the SHA-verified preservation snapshot used for parity and regression reference. Do not edit it as the V1.0025 implementation.

## Release gate

Do not publish V1.0025 to production until browser/session QA passes, including sign-in/callback/logout, N-logo → Ask Nexus, suggested-question clicks, narrow/wide mobile layouts, light/dark mode, tenant-isolation canary, and live API behavior.

NOSMO Agency and NOSMO Work may share contracts, but they must not become one frontend application.
