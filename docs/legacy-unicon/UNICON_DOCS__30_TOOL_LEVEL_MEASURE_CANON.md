> Legacy source copy from `mateuszfurmanski-droid/UNICON/UNICON_DOCS/30_TOOL_LEVEL_MEASURE_CANON.md`. Preserved for migration traceability. Do not treat as current NOSMO product specification without checking current master documents.

# UNICON TOOL — LEVEL + MEASURE (CANON)

## PURPOSE
Single integrated tool for:
- leveling
- measuring length
- measuring depth
- measuring angle

User never selects tool manually.
Tool adapts automatically based on TASK or SNAG.

---

## CORE RULE (LOCK)
LEVEL and MEASURE are one tool.
Never separate them into different modes.

---

## UI STYLE (LOCK)
- TXT / 90s HUD style
- ultra thin lines (1–2 px)
- green monochrome only
- no icons
- no gradients
- no shadows
- no floating panels

Numbers are hidden by default.

---

## WORLD ANCHORING (LOCK)
All overlays are:
- anchored to real objects (planes / edges)
- NOT screen centered
- NOT following camera

User movement does not move the overlay.

Two anchoring methods:
- AUTO — system detects surface/edge
- PIN — user locks anchor manually

---

## DEFAULT DISPLAY
- thin lines only
- small bubble marker
- no numbers
- no text

---

## NUMBERS (ON DEMAND ONLY)
Numbers appear only when:
