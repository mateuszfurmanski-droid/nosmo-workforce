# NOSMO Work V1.0101 — Locked Recovery Baseline

Status: LOCKED REFERENCE
Recovered: 2026-09-05

## Product identity

- Product: NOSMO Work
- Baseline: V1.0101
- Next version: V1.0102
- Product type: standalone worker-side mobile-first application
- Historical deployment: ChatGPT Site

This is an existing application recovery/finalisation track. Do not rebuild it as a new product.

## Explicit exclusions

Do NOT use these as the V1.0101 baseline:

- Person Card Freeware preview
- NOSMO Agency
- Nexus Core / Project World
- old NEXUS Worker Home 0.7.x builds
- old four-item Work Mode launchers

## Verified V1.0101 shell

- Ask Nexus search/header at the top.
- Bottom navigation has exactly five primary destinations:
  - Worker Card
  - Documents
  - Jobs
  - Apps
  - Settings
- Mobile-first phone/Fold layout.

## Worker Card

- Worker profile header.
- Live Work Status.
- One compact availability selector.
- Canonical availability labels for finalisation: `Available`, `Busy`, `Ready on date`.
- Only one state/LED active at once.
- Ready on date requires a date.
- Edit and Share actions.

## Documents

- Identity/right-to-work and worker document groups.
- Statuses include VALID, EXPIRING, NO EXPIRY and PRIVATE.
- CVs are separate and can have READY state.
- Multiple role-specific CVs are supported.
- Private documents must never be shared automatically.

## Jobs

- Jobs / Employers / Add job controls.
- NOSMO WORK AGENT.
- Find Work accepts role, trade, company or keyword.
- Search preferences are persistable.
- Saved Jobs.
- Needs attention, Applications and Replies-to-check counters.
- Search/application state must survive navigation.
- Opening WhatsApp/email/external source does not mark an application APPLIED.
- APPLIED requires explicit worker confirmation.

## Apps

- Header: `NOSMO WORK | Powered by NEXUS`.
- Work tools are visually primary.
- Verified tools include Drawings, Nexus Upload, Work Camera and Private Vault.
- Connected Apps are secondary/collapsed until needed.
- `Manage apps & imports` entry exists.
- User controls what NOSMO imports.

## Settings

Appearance options:

- Midnight Black
- Nexus Blue
- Eco Green
- Silent Gold
- Windows Grey
- Architect White

Also includes reply alerts and WhatsApp-contact visibility controls.

No purple visual system.

## V1.0102+ finalisation scope

Allowed finalisation work includes:

- reliable real PWA and/or Android installation
- substantial top/bottom bars
- zero horizontal overflow
- full light/dark audit
- Fold closed/open, Android, iPhone-size and tablet responsiveness
- current-language flag and persistent language selection
- UK workforce multilingual layer
- Ask Nexus entry via N/brain logo
- persistent job search/application state
- close/reopen state retention
- recruiter-safe sharing
- final Android home-screen / standalone acceptance

## Language target

English, Polish, Romanian, Urdu, Punjabi, Bengali, Gujarati, Arabic, Portuguese, Spanish, French, Lithuanian, Bulgarian, Ukrainian, Chinese, Turkish and Italian.

## Source-of-truth rule

GitHub in `nosmo-workforce` is the canonical retained source going forward. Preview/deployment systems must not be the only retained copy of NOSMO Work.

Any recovered source must be compared against this baseline before being accepted into `apps/work`.
