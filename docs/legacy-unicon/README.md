> Legacy source copy from `mateuszfurmanski-droid/UNICON/README.md`. Preserved for migration traceability. Do not treat as current NOSMO product specification without checking current master documents.

# UNICON PROJECT

## What is UNICON
UNICON is a universal, platform-agnostic construction workflow system.
It combines:
- snag lists
- task-aware measurement tools
- minimal AR/HUD overlays
- consistent tolerance logic

The system is designed to work across:
- phone
- tablet
- desktop
- future wearable / helmet HUD

No platform lock-in. No hardcoded UI decisions.

---

## Core Philosophy
- Snag defines the task
- Task selects the tool
- Tool defines the measurement overlay
- Overlay follows strict visual and tolerance rules

User does not choose tools manually.
System chooses the correct tool based on task context.

---

## Folder Structure

### UNICON_CORE
Platform-independent core specification.

Contains:
- style_tokens.json  
  Visual DNA (90s thin TXT HUD, colors, line thickness, font rules)

- tool_registry.json  
  List of all tools with IDs, issue types, documents, and previews

- tool_selector_rules.json  
  Rules mapping issue_type → tool_id

- core_manifest.json  
  Index file describing the core pack

This folder never contains platform code.

---

### UNICON_DOCS
Human-readable system documentation and examples.

Contains:
- Tool documentation (31–36)
- Snag data schema
- Example snag records
- Example snag list
- App flow description

This folder explains HOW the system behaves.

---
## Roles and Task Assignment (LOCK)

UNICON is built around real site hierarchy:

- **Manager / Supervisor**
  - creates the full snag list
  - defines standards and tolerances
  - assigns tasks to installers
  - reviews evidence and accepts work

- **Installer / Joiner**
  - sees ONLY assigned tasks (not the full project list)
  - executes the work
  - follows tool-guided checks
  - provides evidence and marks status

**Installer never chooses tools or tolerances.**
Tools are selected automatically based on the assigned task type.

See: `UNICON_DOCS/ROLE_AND_TASK_FLOW.md`

## How the System Works (High Level)

1. A snag is created (photo + issue_type)
2. issue_type is read from snag
3. tool_selector_rules selects a tool_id
4. tool_registry resolves tool details
5. style_tokens define how overlays look
6. Tool runs with correct measurements and tolerances
7. Result is stored back into the snag

---

## Measurement Logic
- All measurements are tolerance-based
- Colors indicate result:
  - GREEN = OK
  - YELLOW = Attention
  - RED = Issue

Exact numbers are hidden by default.
Details can be shown on demand.

---

## Current Tools (v0.1)

31 — Worktop level + measure  
32 — Frame plumb 3D (left/right, front/back, head)  
33 — Mitre saw cut verification  
34 — Door gap tolerance (3mm around, <8mm bottom)  
35 — Hinge load / door balance  
36 — Final client check (summary)

---

## Platform Status
- Core logic: COMPLETE
- Documentation: COMPLETE
- Android / iOS: NOT IMPLEMENTED (by design)
- AR integration: PLANNED
- Wearable HUD: FUTURE

---

## Why This Structure
This project separates:
- WHAT the system does (CORE + DOCS)
from
- HOW it is implemented (platforms later)

This allows:
- faster prototyping
- easier onboarding
- long-term scalability

---

## Next Possible Steps
- Implement minimal client (Android / iPad / Web)
- Add automatic image-based location matching
- Integrate external sensors (IMU / LiDAR)
- Prepare demo / grant documentation
