# NOSMO Work V1.0101 Recovery Sources

This file tracks source provenance for recovering the existing NOSMO Work V1.0101 application into `apps/work`.

## Canonical acceptance reference

The recovered source is accepted only when it matches `docs/NOSMO_WORK_V1.0101_BASELINE.md`.

Verified V1.0101 product identity:

- Ask Nexus at the top.
- Bottom navigation: Worker Card / Documents / Jobs / Apps / Settings.
- Worker Card with one compact availability control.
- Documents with VALID / EXPIRING / NO EXPIRY / PRIVATE states and separate CVs.
- Jobs with NOSMO WORK AGENT, saved jobs, application/reply counters and persisted search/application state.
- Apps with work tools first: Drawings, Nexus Upload, Work Camera, Private Vault; connected apps secondary/collapsed.
- Settings with Midnight Black, Nexus Blue, Eco Green, Silent Gold, Windows Grey and Architect White.

## Historical sources that may be used as donors

These contain real earlier Work implementation logic and can be selectively reused only after comparison with the V1.0101 baseline:

1. `mateuszfurmanski-droid/nosmo-nexus-mvp`
   - `modules/person-card-freeware/`
   - historical branches around `codex/person-card-freeware`
   - contains Work Profile, Documents, Work Hub/job/application logic, recruiter-safe sharing and Work Mode-related code.

2. `mateuszfurmanski-droid/NOSMO-website`
   - `apps/person-card-freeware-preview/`
   - historical public preview synced in late August 2026.
   - contains earlier NOSMO Work centre, Work hub runtime and safe application flow.

3. ChatGPT Site historical deployment
   - historical public host used for the V1.0101 UI.
   - user confirmed this is the correct visual/product lineage.
   - treat as behavioural/visual reference until a direct source export is available.

## Explicit non-canonical sources

Do not copy these wholesale into `apps/work`:

- old Person Card Freeware UI shell as the final product;
- native NEXUS Worker Home 0.7.x;
- old four-item Work Mode launcher;
- Nexus Core application shell;
- NOSMO Agency code;
- Job Hub product code where it is not part of the confirmed NOSMO Work V1.0101 behaviour.

## Reuse rules

- Logic may be reused when behaviour is still correct.
- UI may be reused only when it matches the locked V1.0101 captures.
- Do not rename or redesign screens during recovery.
- Do not introduce V1.0102 changes until V1.0101 recovery is accepted.
- Private documents are never auto-shared.
- Opening WhatsApp/email/external job source never marks an application as APPLIED.
- APPLIED requires explicit user confirmation.

## Migration branch

Work migration is isolated on:

`codex/work-v1.0101-migration`

This avoids collisions with concurrent Agency work in the same repository.
