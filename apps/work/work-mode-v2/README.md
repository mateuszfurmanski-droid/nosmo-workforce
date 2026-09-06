# Work Mode V2 — App Discovery, Launcher and Privacy

Status: ACTIVE FOURTH WINDOW — LOCAL-ONLY V2
Parent application: NOSMO Person Card Freeware
Canonical product PR: #184
Privacy authority: ADDON_029

This directory extends the existing Freeware application. It is not a separate launcher application and it does not create another Person Card.

## Activation rule

The canonical V1 `index.html` remains unchanged and does not import this package directly.

Work Mode V2 is activated only by:

`../screen.html?screen=work-mode`

The fourth window imports `work-mode-screen.mjs`, which reuses the existing local discovery controller, local store, controlled registry and Android bridge.

Discovery itself still does not run until the user presses **Scan for work apps**. Before the first scan the UI shows the local-only privacy notice and requires an explicit acknowledgement.

## Construction App Registry

`construction-app-registry.json` is product metadata listing only supported applications.

Only entries with:

- `discoveryEnabled: true`;
- `identifierStatus: verified-controlled`;
- explicit platform identifiers

may be probed.

Construction-specific apps whose package identifiers are not yet verified remain present as planned definitions with discovery disabled. This is intentional and prevents guessing identifiers.

## Local discovery

`local-discovery.mjs` takes a platform-specific `probeInstalled` callback.

It never enumerates the device itself and contains no network transport.

Android V2 uses the existing targeted package visibility/query adapter for the controlled registry. It does not request unrestricted package inventory solely for this feature.

When the Android bridge is unavailable (for example in a normal browser preview), the UI does not simulate installed apps and reports that local native discovery is unavailable.

## User-facing levels

- OPEN — launch only.
- DEEP_LINK — navigate to a supported destination.
- CONNECTED — exchange explicitly authorised data.

These levels are user-facing capability truth and are separate from finer connector implementation levels in ADDON_047.

## Privacy

DetectedAppLocalState is device-local only.

The installed-app inventory must never be sent to:

- Nexus servers;
- analytics;
- logs;
- crash reports;
- support exports;
- employer or agency views.

Detection creates no tile, connection, consent grant or share without explicit user action.
