> Legacy source copy from `mateuszfurmanski-droid/UNICON/UNICON_DOCS/32_TOOL_FRAME_PLUMB_3D.md`. Preserved for migration traceability. Do not treat as current NOSMO product specification without checking current master documents.

# UNICON TOOL — FRAME PLUMB 3D (CANON)

## PURPOSE
Correct installation of door frames and linings.
Detects and controls vertical alignment in TWO planes:
- LEFT / RIGHT (side plumb)
- FRONT / BACK (depth plumb)

Prevents doors leaning forward or backward.

---

## CORE PROBLEM
A frame can be:
- plumb left-right
- but tilted front-back

This causes:
- doors opening or closing by themselves
- uneven gaps
- hinge stress

Standard spirit levels do NOT detect this reliably.

---

## CORE RULE (LOCK)
Frame plumb must be checked in THREE references:
- Left leg
- Right leg
- Top head

Each leg requires TWO plumb checks:
- SIDE PLUMB (left-right)
- DEPTH PLUMB (front-back)

---

## DETECTION
Triggered by:
- SNAG type: FRAME INSTALL / FRAME ADJUST / DOOR HANG
- Auto-detection of rectangular doorway (2 verticals + top)

System creates world anchors:
- LEFT LEG
- RIGHT LEG
- TOP HEAD

---

## DISPLAY LOGIC (LOCK)
- Overlays are world-anchored to the frame
- Overlays do NOT follow camera
- Only ONE indicator is active at a time
- Active indicator = bright green
- Inactive indicators = dim green

No panels. No icons. No numbers by default.

---

## STEP SEQUENCE (LOCK)
STEP 1: LEFT LEG — SIDE PLUMB  
STEP 2: LEFT LEG — DEPTH PLUMB  
STEP 3: RIGHT LEG — SIDE PLUMB  
STEP 4: RIGHT LEG — DEPTH PLUMB  
STEP 5: TOP HEAD — LEVEL

System automatically advances steps.

---

## OVERLAY SHAPES

### SIDE PLUMB
- Thin vertical line aligned with frame leg
- Small bubble marker
- Indicates left/right tilt

### DEPTH PLUMB
- Minimal offset marker
- Indicates forward/back tilt
- Marker shifts toward or away from user

### TOP LEVEL
- Thin horizontal line on head
- Bubble marker centered

---

## COLOR FEEDBACK
- GREEN  — within tolerance
- YELLOW — adjustment recommended
- RED    — out of tolerance

Colors apply to marker only, not full lines.

---

## NUMBERS (ON DEMAND ONLY)
Shown only when user holds DETAILS or voice "details".

Example:
LEFT LEG:
  SIDE:  +0.6 mm/m
  DEPTH: -1.2 mm/m

RIGHT LEG:
  SIDE:  OK
  DEPTH: +0.4 mm/m

TOP:
  LEVEL: OK

Numbers auto-hide when released.

---

## COMPLETION
When all steps are GREEN:
