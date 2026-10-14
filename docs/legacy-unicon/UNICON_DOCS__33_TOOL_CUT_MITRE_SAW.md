> Legacy source copy from `mateuszfurmanski-droid/UNICON/UNICON_DOCS/33_TOOL_CUT_MITRE_SAW.md`. Preserved for migration traceability. Do not treat as current NOSMO product specification without checking current master documents.

# UNICON TOOL – MITRE SAW CUT ANALYSIS (CANON)


## PURPOSE

To detect the REAL cutting angle produced by a mitre saw,
independent of saw scale accuracy.

The system analyses a probe cut edge
and reports angular deviation from target.
## CORE PROBLEM

Mitre saw angle scales are often inaccurate due to:
- blade flex
- fence misalignment
- worn pivots
- transport damage

Even a 1–2° error causes:
- visible gaps
- cumulative length errors
- poor joints
## PROBE CUT (CALIBRATION CUT)

Before final cutting, a probe cut is required.

Procedure:
1. Set saw to target angle (e.g. 90°, 45°)
2. Make a short test cut on scrap material
3. Present the freshly cut edge to the camera
4. System detects actual cut plane
## ANGLE DETECTION

The system analyses:
- cut edge straightness
- edge-to-camera plane relation
- blade trace direction

Measured angle = REAL CUT ANGLE
(not the saw scale value)
## ERROR VISUALISATION (COLOR CODE)

Deviation from target angle:

WHITE:
±0.2°
Perfect / acceptable cut

YELLOW:
±0.2° – ±1.0°
Minor correction advised

RED:
> ±1.0°
Correction required before final cut
## USER FEEDBACK

System displays:
- measured angle (e.g. 89.2°)
- deviation (e.g. -0.8°)
- suggested correction direction

Example:
"Rotate saw +0.8° clockwise"
## USER FEEDBACK

System displays:
- measured angle (e.g. 89.2°)
- deviation (e.g. -0.8°)
- suggested correction direction

Example:
"Rotate saw +0.8° clockwise"
## LENGTH ERROR FROM ANGLE DEVIATION

Angular deviation causes length error:

Example:
- target: 500 mm @ 90°
- real cut: 89°
- effective length error increases with piece width

System warns when:
- error exceeds tolerance
- cumulative error affects joints
## SERIES CUT MODE

For repeated cuts:
- system locks calibrated angle
- monitors drift over time
- warns if deviation increases

Used for:
- architraves
- skirting boards
- panels
- worktop strips
## TASK INTEGRATION

Mitre Saw Tool is activated when task requires:
- angled cuts
- frame fitting
- finishing carpentry

Tool auto-loads from task image recognition.
