> Legacy source copy from `mateuszfurmanski-droid/UNICON/UNICON_DOCS/ROLE_AND_TASK_FLOW.md`. Preserved for migration traceability. Do not treat as current NOSMO product specification without checking current master documents.

# UNICON — ROLES AND TASK FLOW (v0.1)

## Core Rule (LOCK)
Installer does NOT see the full project snag list.
Installer sees ONLY tasks assigned by a manager.

Task scope is defined before work starts.
Installer does not choose tools or sequence.

---

## Roles

### 1. Manager / Supervisor
Responsibilities:
- create full project snag list
- define standards and tolerances
- assign tasks to installers
- review results and evidence

Manager controls:
- WHAT is done
- WHERE it is done
- WHAT standard applies

Manager does NOT control:
- HOW installer performs physical work

---

### 2. Installer / Joiner
Responsibilities:
- execute assigned tasks
- follow system-guided measurement flow
- provide evidence (photos / snapshots)
- mark task status

Installer controls:
- physical execution of work

Installer does NOT control:
- task selection
- tool selection
- tolerance values

---

## Task Assignment Model

Tasks are grouped into task packages.

Example task package:
- Install door x2
- Install handles x4
- Apply fire door signage

Each task package:
- is pre-defined by manager
- has fixed scope
- has required tools and checks

---

## Installer View (MY TASKS)

Installer application view shows:
- ONLY assigned tasks
- ordered execution flow
- no access to other trades or rooms

Example:
- Door 1 — Install & verify
- Door 2 — Install & verify
- Handles — Install & check
- Fire door signage — Verify presence

Installer cannot add or remove tasks.

---

## Task Execution Flow (Door Example)

### Step 1 — Frame set true
Tool: 32 FRAME PLUMB 3D

Required checks:
- left leg: side plumb
- left leg: depth plumb
- right leg: side plumb
- right leg: depth plumb
- head: level

All checks must be completed to proceed.

---

### Step 2 — Door gaps
Tool: 34 DOOR GAP TOLERANCE

Rules:
- 3 mm gap around
- bottom gap always < 8 mm

System enforces measurement order.

---

### Step 3 — Hardware install
Tool: simple measure / visual confirmation

Checks:
- handle height consistency
- correct side / handing
- secure fixing

---

### Step 4 — Fire door compliance
Tool: visual verification

Checks:
- sign present
- sign readable
- correct location

Evidence required:
- photo proof

---

## Status Logic

Each task step returns:
- GREEN — OK
- YELLOW — Attention
- RED — Issue

Task status:
- DONE only if all steps GREEN or accepted
- DOING if any YELLOW
- TODO if RED or incomplete

---

## Manager Review

Manager sees:
- aggregated task status
- evidence per step
- no raw measurement clutter

Manager decision:
- accept
- request correction

---

## Why This Model Exists

- eliminates discussion on site
- enforces consistent quality
- protects installer and manager
- creates clear accountability

UNICON does not replace skill.
UNICON enforces standard.
