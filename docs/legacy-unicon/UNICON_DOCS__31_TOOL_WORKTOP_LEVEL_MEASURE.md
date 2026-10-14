> Legacy source copy from `mateuszfurmanski-droid/UNICON/UNICON_DOCS/31_TOOL_WORKTOP_LEVEL_MEASURE.md`. Preserved for migration traceability. Do not treat as current NOSMO product specification without checking current master documents.

# TOOL PROFILE — WORKTOP (LEVEL + MEASURE)

## PURPOSE
Leveling and measuring kitchen worktops during:
- replacement
- installation
- adjustment

This tool is optimized for walking along the worktop.

---

## TRIGGER
- SNAG type: WORKTOP REPLACE / WORKTOP LEVEL
- Auto-detect: horizontal plane at approx. 850–950 mm height

When detected:
WORKTOP DETECTED
ANCHOR LOCKED

---

## ANCHORING (LOCK)
- Tool is anchored to the worktop surface
- Overlay is world-fixed (does not move with camera)
- User movement does not affect overlay position

Anchor placement:
- AUTO: system places anchor at detected worktop
- PIN: user locks anchor manually if needed

---

## OVERLAY GEOMETRY (LOCK)
Two thin axis lines on the worktop surface:

- X axis — WIDTH (left ↔ right, along the run)
- Y axis — DEPTH (wall ↔ front edge)

Both axes are active simultaneously.

Visual concept:
- thin lines only
- one small bubble marker per axis
- no panels
- no icons

---

## DEFAULT DISPLAY
- X level indicator (width)
- Y level indicator (depth)
- no numbers
- no text

User reads correction visually, not numerically.

---

## MEASUREMENT INTEGRATION
The same axes act as measurement references.

X axis provides:
- total run length
- segment length (optional A–B)

Y axis provides:
- worktop depth

Measurement markers appear only on demand.

---

## NUMBERS (ON DEMAND ONLY)
Triggered by DETAILS (hold or voice).

Displayed temporarily:
X:
  LENGTH: <value>
  LEVEL: ± mm/m

Y:
  DEPTH: <value>
  LEVEL: ± mm/m

Numbers auto-hide after release.

---

## SENSITIVITY
- High sensitivity
- Strong smoothing
- No jitter allowed

Micro-adjustments must be visible.

---

## COLOR FEEDBACK
Axis markers use tolerance colors:
- GREEN  — acceptable
- YELLOW — adjustment recommended
- RED    — out of tolerance

---

## NOTES
- Tool must remain usable in bright kitchens
- Lines must not obscure real edges
- Priority is visual correction, not reading numbers
