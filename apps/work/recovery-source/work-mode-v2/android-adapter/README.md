# Android Work Card V2 discovery adapter

This is an Android adapter **inside the existing NOSMO Person Card Freeware product**.

It is not:

- Nexus Worker Home;
- a second Android application;
- a launcher replacement;
- a full package-inventory scanner.

## Privacy boundary

The adapter accepts only controlled `appDefinitionId` values.

`SupportedAppPackages` maps those IDs to the exact package identifiers whose registry entries currently have `discoveryEnabled=true`.

Android package visibility is declared with targeted `<queries><package ... /></queries>`.

`QUERY_ALL_PACKAGES` is forbidden.

The adapter contains no HTTP/network client, analytics or logging path.

## Native bridge

A future Person Card Android wrapper may expose:

- `isSupportedAppInstalled(appDefinitionId)`;
- `launchSupportedApp(appDefinitionId)`.

The bridge never accepts an arbitrary Android package name.

V1 does not register or load this bridge yet. Enabling it requires the V2 UX/privacy gate and real-device tests.
