# NOSMO Person Card Freeware

Canonical isolated product line for the standalone Person Card / Work Profile / agency and recruitment app.

## Product boundary

- standalone, mobile-first;
- no Relationship Tree;
- no e-SAFE, DoorFlow, Electrical, Work Wallet, BIM/FabStation, Android Worker Home, Spark or SKANSKA dependency;
- Data Fetcher stays as the profile intake surface;
- Work Hub owns Find Work, Matches, Agencies, AI Check and Share Profile;
- Inbox owns agency requests/offers/work requests.

## Frozen visual donor

Source repository: `mateuszfurmanski-droid/NOSMO-website`

Frozen donor: `person-card-kamil-v47.html` / `v47top1`

Verified source blob SHA: `6b33057751dacb58555fc3462f2b6b811f53d48d`

The donor itself is not modified in this repository. `index.html` is the consolidated freeware copy derived from PR #39.

## Consolidation sources

Frontend source: NOSMO-website PR #39, head `fde179a4ad0e08ce418821b7b1017099ec9d3f14`.

Backend source: nosmo-nexus-mvp PR #182, head `d1de9c4aa5d7f9ed44284bea5ceed752f493456c`.

Superseded UI: nosmo-nexus-mvp PR #180. Do not restore.

## Current static routes

- `index.html` — canonical Person Card Freeware;
- `screen.html?screen=documents` — worker-owned Documents window;
- `screen.html?screen=work` — NOSMO Work centre with `Work Card | Jobs | Applications | Employers`; it retains the canonical worker-owned Work Card and adds local/demo job discovery, truthful application tracking, employer contacts and NOSMO Work Agent matching without creating another Person, Work Profile, CV store or Job Gateway;
- `screen.html?screen=work-mode` — Work Mode V2 fourth window with local supported-app discovery, explicit Add / Open / Remove actions, privacy information and work-app category cards;
- `onboarding.html` — worker onboarding;
- `agency-desk.html` — unified agency / recruiter workspace over the existing recruiter-safe Person Card, shortlist, Request Pack, Offer Work, Worker Registry and Agency Invite flows;
- `agency-invite.html` — worker onboarding invite flow opened from Agency Desk;
- `section.html` — CV/certs/refs/availability/vault sections;
- `data-fetcher/` — standalone profile file intake;
- `directory.html` — standalone worker registry starting point.

Server-backed Job Gateway, invite signing, AI prefill and persistence are added in the backend consolidation commits on this same branch.


## Work Card / Work Mode roadmap

The same Freeware application evolves without replacing the canonical Person or Work Profile:

- V1 — Person Card Freeware / Work Profile / agency + recruitment;
- V2 — Work Card local supported-app discovery, explicit app tiles and Privacy & Connections;
- V2.1 — supported deep links;
- V3 — explicitly authorised official connectors and cross-app workflow.

The V2 implementation package lives in `work-mode-v2/` and is now activated only by the fourth `screen.html?screen=work-mode` window.

The canonical `index.html` Person Card still does not import the package directly. Documents, Work Card and Work Mode share the same `screen.html` host, and navigation between those three windows is switched client-side with History API state rather than loading another product.

Work Mode V2 is not a second app and not a separate launcher product.

Privacy authority: `nosmo-nexus#26` / ADDON_029.

### V2 trust rule

> Your Work Card belongs to you.

> Private by default. Shared only by you.

Installed-app discovery must remain device-local. Detection is not connection, connection is not content access, and content access is not sharing.


## Work Mode V2 active boundary

- first scan shows: `App discovery happens only on this device. NOSMO does not upload or store a list of your installed apps.`;
- Android discovery uses only verified controlled package identifiers from the Construction App Registry;
- no broad installed-app inventory permission;
- detection creates no tile until the user chooses Add to Work Mode;
- OPEN launches only and grants no content access;
- Remove from Work Mode removes only the local tile;
- browser preview never simulates installed apps when the Android bridge is unavailable;
- BIM / drawings, snagging, site forms, timesheets, Work Wallet, cloud storage, communication and project management are UI categories, not new standalone product dependencies.


## Worker and Agency operating views

Person Card Freeware now has two operating views over the same Person / Work Profile data:

### Worker View

- Person;
- Documents;
- Work Card;
- Work Mode V2;
- Work Hub / Find Work / Matches / Agencies / AI Check / Share / Inbox.

### Agency Desk

- authenticated Agency Account;
- editable Agency Profile;
- authenticated Recruiter Profile for each agency member;
- consent-gated recruiter-safe candidate pipeline;
- server-side agency-scoped shortlist / pipeline state;
- Request Pack and Offer Work draft actions;
- Agency Invite / onboarding link flow;
- server-side Agency Activity.

Agency Desk does not create a second worker profile or a second Person Card. Candidate data is read from the canonical `nexus_pm_people` and `nexus_person_work_profiles` records.

An active worker profile is not sufficient for Agency Desk visibility. The agency must also have an active `RECRUITER_SAFE` access grant from that worker.

Private worker documents are not automatically exposed to Agency Desk. Request Pack remains an explicit request flow and does not grant document access.


## Multi-worker Agency ATS backend

Agency Desk is no longer bound to the static demo Work Profile.

Authenticated Agency ATS routes:

- `GET /api/person-card/agency/account` — resolve the logged-in user's Agency Account;
- `POST /api/person-card/agency/account` — create/update the Agency Account;
- `GET /api/person-card/agency/candidates` — paginated recruiter-safe list of active worker profiles;
- `GET /api/person-card/agency/candidates/:personId` — recruiter-safe candidate detail;
- `PATCH /api/person-card/agency/candidates/:personId` — agency-scoped pipeline stage / note;
- `POST /api/person-card/agency/candidates/:personId/actions` — shortlist, request, offer, contact, share and view action log;
- `GET /api/person-card/agency/activity` — agency-scoped ATS activity feed.

Persistence is added through:

- `nexus_person_agencies`;
- `nexus_person_agency_members`;
- `nexus_person_agency_candidate_states`;
- `nexus_person_agency_actions`.

The candidate API reads canonical `nexus_pm_people` + `nexus_person_work_profiles`. It does not create a duplicate candidate/person table.

Recruiter-safe projection deliberately excludes contact details, CV text and private document payloads. Request Pack and Offer Work create agency actions/drafts only; they do not automatically transmit private worker data or confirm a placement.

The standalone Person Card Freeware server now mounts the existing OIDC auth middleware and auth routes, so Agency Account identity is session-backed. Secure Agency Invite creation is also scoped server-side to the authenticated Agency Account instead of trusting a typed agency name.

### Database activation

The schema is defined in the canonical Drizzle schema export. Before using the live ATS against a target Postgres environment, apply the schema using the existing DB workflow:

`pnpm --filter @workspace/db push`

Run that only against the intended NOSMO database with the correct `DATABASE_URL`.

Agency Desk does not substitute the old demo candidate when the authenticated ATS API/database is unavailable; it reports the missing account/API state instead.


## Agency identity and worker visibility consent

Agency-side identity has two layers:

- **Agency Profile** — company name, website, registration number, office/base location, description and verification state;
- **Recruiter Profile** — authenticated NOSMO user, display name, job title, email, phone, photo URL, bio and verification state.

Recruiter Profile rows are keyed by the authenticated `authUserId` and belong to an Agency Account. Client-supplied recruiter IDs are not accepted as identity authority.

Secure Agency Invites carry signed agency/recruiter identity. Worker onboarding verifies that signed identity through `POST /api/person-card/onboarding/invite-info` before enabling the agency-sharing checkbox.

Worker consent is explicit and off by default:

- the sharing checkbox starts unchecked and disabled;
- it becomes enabled only after the signed inviter identity is verified by the server;
- finishing a Person Card does not require granting agency access;
- granting access creates/updates `nexus_person_agency_access_grants` with scope `RECRUITER_SAFE`;
- removing consent on a later finalized save revokes the grant.

The recruiter-safe grant includes role/trade, locations, availability, work preferences and readiness states. It explicitly excludes phone, email, CV text, private documents and Vault contents.

The Agency ATS candidate query inner-joins the agency access grant and requires:

- matching `agencyId`;
- `status = ACTIVE`;
- `scope = RECRUITER_SAFE`.

Therefore an agency cannot enumerate all active NOSMO workers merely because they have active Person Cards.


## Dev DB activation and E2E sequence

Current intended database target:

- Neon project: `nosmo-nexus-mvp-dev`;
- project ID: `morning-glitter-88911562`;
- default branch: `main`;
- branch ID: `br-snowy-base-afc4itrb`;
- database: `neondb`.

The current dev database already contains `users` and `nexus_pm_people`, but at the time of this checkpoint it does not yet contain the Person Card onboarding / Work Profile / Agency ATS tables.

Canonical SQL artifacts are committed in the same Freeware branch:

- `artifacts/api-server/src/person-card-freeware/sql/001-person-card-agency-persistence.sql` — creates the complete Person Card + Agency persistence package;
- `artifacts/api-server/src/person-card-freeware/sql/verify-person-card-agency-e2e.sql` — rollback-only database E2E smoke test.

The migration creates nine Person Card persistence tables:

1. `nexus_person_agencies`;
2. `nexus_person_onboarding_invites`;
3. `nexus_person_work_profiles`;
4. `nexus_person_work_events`;
5. `nexus_person_agency_members`;
6. `nexus_person_agency_recruiter_profiles`;
7. `nexus_person_agency_access_grants`;
8. `nexus_person_agency_candidate_states`;
9. `nexus_person_agency_actions`.

The E2E SQL runs inside a transaction and ends in `ROLLBACK`. It verifies:

- an active worker without an Agency Access Grant is not visible;
- a worker with explicit `ACTIVE / RECRUITER_SAFE` consent becomes visible;
- a second consented worker becomes visible;
- revoking the first worker removes that worker from the agency-visible set;
- recruiter profile, shortlist/pipeline state and agency action logging can be persisted;
- access-grant privacy flags keep private documents, contact details and CV text excluded.

After DB activation, the application-level E2E sequence is:

`Agency Account -> Recruiter Profile -> Secure Invite -> Worker onboarding -> signed inviter verification -> optional explicit worker consent -> active Work Profile -> Agency Desk visibility -> Shortlist -> Request Pack -> Offer Work`.

The connected Neon write tools currently expose a parameter-mapping defect: the local wrapper accepts camelCase arguments while the Neon backend rejects them and requires snake_case. Read-only Neon discovery works, but write/migration calls cannot currently be sent safely through this connector. No migration was applied to another Neon project as a workaround.

Do not use `nosmo-nexus-cloud-staging` as a substitute target for this Person Card Freeware migration.


## Agency ATS runtime readiness

`GET /api/person-card/agency/_health` now checks the actual database using PostgreSQL registry lookups.

It returns:

- `status: ok` only when all nine Person Card / Agency tables exist;
- `status: database-migration-required` with the missing table list when the schema is not activated;
- `status: database-unavailable` if the database itself cannot be reached.

Agency Desk calls this health endpoint before account/pipeline loading. When persistence is not activated it shows `DB activation pending` and never substitutes demo candidates.

## UI / visual pass sequencing

Do not redesign the worker or agency UI while the persistence/E2E line is still being activated.

After the live functional flow is proven, run a separate visual/readability pass across the complete Person Card Freeware application. Priority should be readability and hierarchy before decoration:

- fewer competing borders and nested cards;
- larger primary type and tap targets;
- clearer information hierarchy;
- higher contrast for secondary text;
- consistent spacing and section rhythm;
- simpler worker navigation;
- simpler Agency Desk pipeline;
- clearer consent/privacy surfaces;
- consistent NOSMO visual language across Worker View and Agency Desk.

Functional/privacy contracts must remain unchanged during that visual pass.
