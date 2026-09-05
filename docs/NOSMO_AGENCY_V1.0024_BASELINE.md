# NOSMO Agency V1.0024 — Existing Product Baseline

Status: LOCKED MIGRATION REFERENCE
Date: 2026-09-05

## Product identity

- Product: NOSMO Agency
- Baseline: V1.0024
- Previous public baseline: V1.0023
- Next version after migration/finalisation: V1.0025
- Existing Sites project: `appgprj_6a967b267b348191904db8faca122765`
- Known Sites version: 24
- Known baseline commit: `70883401530b0f686f3c1e8a66daa4906d1c9c1e`

NOSMO Agency is the recruiter / agency-side application. It remains a separate frontend from NOSMO Work.

## Existing V1 scope

Core product areas include:

- worker/candidate records
- search and filtering
- jobs / assignments
- matches
- candidates / pipeline
- employer/agency communication
- availability visibility
- recruiter-safe worker information access
- Ask Nexus entry
- file/data import workflows

## Migration rule

Do not redesign or rebuild Agency while migrating it into `nosmo-workforce`.

The first migration objective is source preservation and parity with the existing V1.0024 application. Functional changes belong to V1.0025+ only after parity is demonstrated.

## Boundary with NOSMO Work

Shared contracts may include worker identity, availability, qualifications/documents, job/application status, communication events and explicit sharing permissions.

NOSMO Agency must not directly own or silently expose private worker documents. Worker-side sharing rules remain authoritative.

## Boundary with Nexus Core

Nexus Core is not part of this repository. Agency may integrate with Nexus only through explicit interfaces. Do not copy Nexus Core implementation into this repository.
