# NOSMO Workforce

Canonical product repository for the NOSMO workforce platform.

This repository contains two separate applications that share controlled contracts and selected UI primitives:

- `apps/work` — NOSMO Work, worker-side mobile-first application.
- `apps/agency` — NOSMO Agency, recruiter / agency-side application.

Shared code belongs only in:

- `packages/shared` — schemas, types, contracts and shared business rules.
- `packages/ui` — deliberately shared visual primitives and design tokens.

Documentation and recovery baselines belong in `docs`.

## Product boundaries

NOSMO Work and NOSMO Agency are separate applications and must remain separately deployable.

This repository must NOT absorb Nexus Core. Nexus Core remains in its existing repository and may only be integrated through explicit, versioned interfaces later.

Do not copy old experiments into this repository merely because they are related to workers or recruitment. In particular, do not treat Person Card Freeware, old Worker Home 0.7.x builds, Work Mode experiments or Agency prototypes as canonical product source unless they are explicitly reconciled against the locked baselines.

## Current baselines

- NOSMO Work: V1.0101 recovery baseline.
- NOSMO Agency: V1.0024 existing product baseline.

Next user-facing versions:

- NOSMO Work -> V1.0102
- NOSMO Agency -> V1.0025

## Source-of-truth rule

GitHub in this repository is the canonical retained source for NOSMO Work and NOSMO Agency going forward. Preview/deployment systems must not be the only copy of product code.
