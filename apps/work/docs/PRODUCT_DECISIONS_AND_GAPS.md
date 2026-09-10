# NOSMO Work — product decisions and implementation gaps

This file records decisions that previously existed mainly in design
conversations. A feature must be marked `Implemented and verified` before it is
described externally as working.

## Current public prototype

- Worker Card, Documents, Jobs, Apps and Settings navigation.
- Documents uses one primary `Add files` action, a compact category strip and progressive disclosure for Agency replies and CV tools.
- Jobs uses one live-search surface, collapsed search preferences and one compact saved-jobs toolbar instead of repeated titles, filters and add controls.
- Settings groups preferences, work controls and local data; phone imports and the private inbox stay folded until requested.
- Ask Nexus entry point and AI-assisted live job search.
- Application and employer records with local browser persistence.
- Light and dark appearance modes.
- Work app launcher and work-camera prototype, with secondary external services collapsed by default.

### Search V2 — implemented, production observation pending

- Each search batch starts four independent background Responses API tasks for
  job boards, recruitment agencies, direct employers and local/specialist
  sources. Each lane gathers up to eight candidates; the server combines,
  validates and deduplicates them into a maximum of 20 returned vacancies.
- The initial request returns the task IDs quickly. The browser then checks the
  task group with short polling requests, so a mobile connection does not have to
  remain open while the complete web search runs. The task group is kept in
  session storage for nine minutes, allowing a connection failure or another
  tap on Search to resume the same paid search instead of starting it again.
- Live web search is required independently in every source lane. Search calls,
  page opens and in-page finds are counted separately, so the UI reports the
  number of real web queries rather than all tool actions.
- Candidate discovery requires sourced company, role, source and direct advert
  URL. Missing optional metadata is left blank. The server enforces the direct
  link shape and freshness window; undated results also undergo an active-page
  and closed-vacancy check before they are shown.
- `Search next 20` continues the same query and appends only unseen direct
  vacancy links. It never replaces earlier results.
- URL canonicalisation removes tracking parameters before duplicate detection.
- The UI reports the real number returned and says clearly that 20 is a maximum,
  not a promised minimum. It also reports how many live web searches actually
  ran and how many candidate links reached direct-page verification.
- Vacancies from the last seven UTC days are prioritised, then still-open roles
  from the last 30 days fill the remaining places. Explicit future and older
  dates are rejected. If an open individual advert exposes no reliable date, it
  is accepted only after its direct page responds successfully and does not say
  that the role is closed; the row is labelled `Active - date not shown`.
- When an inspected undated vacancy page exposes structured `datePosted` or
  `datePublished` data, the server checks that source date and rejects an older
  page.
- The AI endpoint requires ChatGPT sign-in and a server-side account allowlist,
  so anonymous visitors cannot spend the owner's API credit.
- Public builds do not bundle personal CV files. Existing or imported CVs remain
  in the worker's device storage.

The production search still needs observation across blocked job boards,
timeouts and several consecutive batches before it can be described as fully
reliable.

Limitations: browser storage is not a multi-device worker account. The native
Android Share implementation exists in the Android module but has not yet had a
clean SDK build and real-device verification, and a live AI search can return
fewer than 20 results when it cannot obtain enough suitable direct vacancy
links.

## Confirmed product decisions

### Android contact and job intake — implemented, device verification pending

- NOSMO Work appears in Android Share from WhatsApp, Messages, Gmail and other
  apps.
- It accepts shared text, vCards and screenshots.
- Screenshot OCR extracts phone/email/company/job details as editable
  suggestions.
- Nothing is saved before confirmation.
- Duplicate detection uses normalized phone and email.
- No background scanning of private apps, gallery or contacts.
- Confirmed items cross into the existing Jobs or Contact register through a
  private native queue; the web layer acknowledges each item only after save,
  duplicate resolution or explicit discard.

Full specification: `android-app/README.md`.

### Work-only camera and Drive — prototype/incomplete

- Work photos stay separate from the private camera roll where Android storage
  capabilities permit.
- Google Drive setup is optional.
- `Remind me later` keeps the configuration icon visible until setup genuinely
  completes.
- Work images and documents are never uploaded without informed user action.

### Communication intake — first safe path implemented

- Jobs received through WhatsApp, SMS or email can enter Jobs through Android
  Share after a native editable review.
- The initial safe implementation uses Android Share and explicit imports.
- Background inbox monitoring requires separate provider permissions, consent,
  revocation controls and store-policy review; it is not currently implemented.

### Applications and document packs — partial/planned

- Application status becomes `Applied` only after the worker confirms a real
  submission.
- Direct vacancy links should open the exact advert/application route where one
  is available.
- Automatic CV/document-pack preparation and sending requires a visible review
  step and explicit worker confirmation.
- WhatsApp application assistance must not send messages automatically without
  confirmation.

### Availability and agency visibility — implemented, production E2E pending

- Worker controls `Available`, `Busy` and `Ready on date` through one live-status selector.
- A recruiter-safe Agency connection requires one explicit worker approval.
- Connected Agency workspaces read the same canonical status; no availability message or WhatsApp draft is sent.
- Private documents, notes and photos remain outside the connection scope.

### Privacy boundary — confirmed

- Worker owns the data.
- NOSMO does not inspect private documents, photos, contacts or installed-app
  lists by default.
- App discovery, OCR and parsing should run on-device where practical.
- Cloud processing must identify what is uploaded, why, where and for how long.

### Later version

- Payroll-company question handling is a possible paid/V2 capability, not a
  current feature.
- Worker and Agency are separate products/apps; do not add a public
  Worker/Agency mode switch to the worker product.

## Highest-priority gaps

1. Run a clean Android SDK build and real-device tests for Share Target, rotated
   screenshots, OCR edge cases and process restoration.
2. Add a real user account and encrypted durable data model instead of relying
   only on browser-local state.
3. Complete Google Drive authorization and the dedicated work folder lifecycle.
4. Observe and tune Search V2 source coverage, latency and consecutive batches
   against real production searches.
5. Add explicit consent screens and a privacy dashboard for every external
   integration.
6. Implement import adapters for WhatsApp/text/email through user-driven Share
   before considering background monitoring.
7. Complete production multi-worker observation of Worker-to-Agency status synchronisation and revocation.
