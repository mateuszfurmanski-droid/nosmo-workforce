# NOSMO Agency

Canonical location for the existing NOSMO Agency recruiter / agency application.

## Exact current Sites baseline

The accepted public Agency UI has been captured directly from the live ChatGPT Sites deployment and preserved byte-for-byte at:

`apps/agency/sites/v24/public/`

Source:
- Sites project: `appgprj_6a967b267b348191904db8faca122765`
- Sites version: `24`
- public URL: `https://nosmo-agency.mateusz-furmanski.chatgpt.site/`
- displayed product version: `NOSMO Agency V1.0025`
- capture manifest: `apps/agency/sites/v24/CAPTURE_MANIFEST.json`
- exact byte verification: `apps/agency/sites/v24/verify-byte-parity.mjs`

This captured Sites bundle is the visual and client-behaviour baseline. Do not redesign, restyle, simplify, modernise, or replace it during migration.

The older source snapshot under `apps/agency/legacy/v1.0024/` is preserved for backend/data-contract provenance. Its older `Agency Desk` frontend is **not** the accepted current Sites UI and must not be promoted over the captured Sites bundle.

NOSMO Agency and NOSMO Work may share contracts, but they must not become one frontend application. Agency migration work must not modify `apps/work`.
