> Legacy source copy from `mateuszfurmanski-droid/UNICON/UNICON_DOCS/36_TOOL_FINAL_CLIENT_CHECK.md`. Preserved for migration traceability. Do not treat as current NOSMO product specification without checking current master documents.

Ln 1, Col 1
# UNICON TOOL — FINAL CLIENT CHECK (CANON)

## PURPOSE
Provides a simplified, non-technical final verification mode
used for client handover, snag completion, and acceptance.

This tool hides all construction complexity and exposes only
clear status indicators.

---

## WHO THIS TOOL IS FOR
- client
- site manager
- landlord
- inspector
- installer (final confirmation)

---

## INPUT SOURCES
This tool does NOT measure directly.

It aggregates results from:
- 32_TOOL_FRAME_PLUMB_3D
- 33_TOOL_CUT_MITRE_SAW
- 34_TOOL_DOOR_GAP_TOLERANCE
- 35_TOOL_HINGE_LOAD_CHECK

---

## DISPLAY PRINCIPLE (LOCK)

- No numbers
- No angles
- No millimeters
- No technical language

Only status indicators.

---

## VISUAL OUTPUT

Each checked element is shown as a tile:

- 🟢 OK
- 🟡 ATTENTION
- 🔴 ISSUE

Tiles may represent:
- frame alignment
- door movement
- gaps consistency
- hinge load balance
- surface level (worktops, floors)

---

## ISSUE DESCRIPTION
If a tile is not GREEN, system shows:

- short plain-language explanation
- optional photo snapshot
- suggested corrective action (text only)

Example:
"Door may move by itself due to hinge imbalance."

---

## USER INTERACTION

- user can tap / select any tile
- system may suggest returning to a specific tool:
  - "Open FRAME PLUMB CHECK?"
  - "Open GAP ADJUSTMENT?"

Navigation is optional, not required.

---

## ACCEPTANCE MODE

When all tiles are GREEN:

System allows:
- snapshot capture
- timestamp
- optional signature / confirmation

---

## DESIGN RULES
- calm colors
- no flashing
- no technical overlays
- readable from distance

This mode must feel safe and conclusive.

---

## LOCK
This tool never overrides technical tools.
It only reflects their results.
