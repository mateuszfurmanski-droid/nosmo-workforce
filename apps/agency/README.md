# NOSMO Agency

Canonical location for the existing NOSMO Agency recruiter / agency application.

## Accepted current live Sites baseline

The current public Agency UI was accepted on 2026-09-13 as:

- Sites project: `appgprj_6a967b267b348191904db8faca122765`
- deployed Sites version: `28`
- source commit: `96d342f04f1112c22f13cd5c7bb8f55856f887c8`
- source tree: `aceeed8ea6a8669c1c7bcaa5ec852b488a15bdc1`
- public URL: `https://nosmo-agency.mateusz-furmanski.chatgpt.site/`
- displayed product version: `NOSMO Agency V1.0026`

Saved Sites version 29 was not deployed and is not the accepted baseline. Its global
navigation / Emergency-link change must not be pulled into the current product by
accident.

The previous version 24 / `NOSMO Agency V1.0025` bundle remains preserved byte-for-byte
under `apps/agency/sites/v24/public/` with its capture manifest and parity test. It is
historical migration and security-preview evidence, not the current UI baseline.

The accepted version 28 source identity and hashes are recorded in
`apps/agency/sites/current-baseline.json`. Security integration must move from the
version 24 bundle to version 28 without redesigning it. Existing Emergency code is
frozen and out of scope for this work.

The older source snapshot under `apps/agency/legacy/v1.0024/` is preserved for backend/data-contract provenance. Its older `Agency Desk` frontend is **not** the accepted current Sites UI and must not be promoted over the captured Sites bundle.

NOSMO Agency and NOSMO Work may share contracts, but they must not become one frontend application. Agency migration work must not modify `apps/work`.
