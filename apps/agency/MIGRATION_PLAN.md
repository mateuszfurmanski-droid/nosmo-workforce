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
1. preserve Agency frontend source — COMPLETE;
2. preserve Agency backend/API source — COMPLETE;
3. preserve Agency SQL migrations and QA fixtures — COMPLETE;
4. establish standalone Agency package boundaries — PENDING RECONCILIATION;
5. run parity audit before V1.0025 changes — PENDING until NOSMO Work migration is also complete.

Migration checkpoint:
- target repository: `mateuszfurmanski-droid/nosmo-workforce`;
- preserved path: `apps/agency/legacy/v1.0024/`;
- preservation source: `mateuszfurmanski-droid/nosmo-nexus-mvp`;
- exact source commit: `2d9110354e6084a3f5922e0acafc9f9a31ad1934`;
- source-pack squash commit on `main`: `cb54d2195aaea5cc4d9bf46dc5d28952bdbb124b`;
- every preserved source file is listed with its original Git blob SHA in `legacy/v1.0024/SOURCE_MANIFEST.json`;
- Worker frontend was not copied;
- `apps/work` was not modified by the Agency migration;
- Nexus Core/e-SAFE implementation was not copied.

Do not begin V1.0025 redesign/fixes from the preserved legacy directory. First reconcile the current Sites product against this source snapshot and define the canonical separately deployable `apps/agency` runtime.
