# NOSMO Work

Canonical Worker application for `mateuszfurmanski-droid/nosmo-workforce`.

## Recovery baseline

- Accepted visual and functional baseline: existing ChatGPT Sites version 93.
- Sites project: `appgprj_6a93f57013108191a7a78c97da0b378c`.
- Source commit: `a8dc178daaaea7328d8177a18c8cfb2bc3f5ae74`.
- Public application: <https://mateusz-furmanski-job-hub.mateusz-furmanski.chatgpt.site>.
- Displayed recovery version: `NOSMO Work V1.0101`.

This recovery baseline intentionally excludes the Person Card Freeware donor and the
Emergency Core integration introduced in Sites version 94. Emergency remains a
separate product.

## Current incremental release

V1.0101 remains the locked recovery point. The current live visual and functional
baseline was accepted on 2026-09-13 as ChatGPT Sites version 95, source commit
`f6027c9ff045aa3dbd201d02a6089a3b11a3b774`, displayed as `NOSMO Work V1.0102`.
Version 95 explicitly reverts the Emergency Core integration introduced in version
94, so NOSMO Emergency remains a separate product.

V1.0102 adds the installable PWA shell, offline reopen support and truthful install
guidance without replacing the accepted Worker visual. The Sites source repository
was retrieved and verified; the canonical `apps/work` tree retains that lineage and
adds the reviewed Worker security boundary. Production deployment of those security
changes remains a separate release decision.

## Local checks

```bash
npm run install:ci
npm test
```
