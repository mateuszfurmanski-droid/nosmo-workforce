# NOSMO Agency V1.0024 migration plan

This file tracks the Agency-only migration into `nosmo-workforce`.

Scope for this chat:
- migrate NOSMO Agency only;
- preserve V1.0024 source and behavior;
- keep `apps/work` untouched;
- preserve recruiter-safe consent boundaries;
- preserve tenant-scoped Agency data access;
- keep Nexus Core/e-SAFE out of this repository.

Migration sequence:
1. preserve Agency frontend source;
2. preserve Agency backend/API source;
3. preserve Agency SQL migrations and QA fixtures;
4. establish standalone Agency package boundaries;
5. run parity audit before V1.0025 changes.
