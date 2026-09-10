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

## Finish mode

V1.0101 is the locked recovery point. V1.0102 changes must be incremental and must
pass repository tests, browser QA, deployment QA, and real-device acceptance before
being marked DONE.

## Local checks

```bash
npm run install:ci
npm test
```
