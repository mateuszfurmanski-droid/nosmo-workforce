# NOSMO Smart Helmet / Field Augmentation — Master Strategy

**Status:** ACTIVE STRATEGY / WORKING MASTER  
**Date:** 14 October 2026  
**Legacy project name:** UNICON  
**Current strategic family:** NOSMO Human Augmentation / Construction Hardware  
**Related masters:**  
- `docs/NOSMO_HUMAN_AUGMENTATION_MASTER.md`
- `docs/NOSMO_CONSTRUCTION_HARDWARE_MASTER.md`

---

## 1. Purpose

This document re-establishes the old UNICON smart-helmet / HUD work as a controlled NOSMO hardware R&D track.

UNICON is treated as a **legacy source project**, not the current product name.

The strategic goal is to preserve the useful technical work already completed, then evolve it into a modern NOSMO head-worn field system that can operate independently or as part of the wider Human Augmentation stack.

Working principle:

> **Head = perception and guidance. Body = augmentation. Nexus = context and intelligence. Robotics = automation.**

---

## 2. Legacy UNICON baseline

The private legacy repository is:

`mateuszfurmanski-droid/UNICON`

Confirmed legacy architecture from the repository:

- software-first platform;
- edge/local operation;
- Raspberry Pi / headless compute;
- Flask API;
- JSON configuration;
- Task Engine;
- Tool Engine;
- HUD overlay logic;
- camera input;
- IMU;
- LiDAR / TF-Luna work;
- local REST / LAN interfaces;
- modular sensor approach;
- platform-independent core;
- future wearable / helmet HUD target.

The legacy system overview explicitly separates:
- CORE;
- MODULES;
- INTERFACES;
- Task Engine;
- Tool Engine;
- HUD.

The old design rule remains useful:

**Core logic must not depend on a specific helmet, display, sensor vendor or operating system.**

---

## 3. Confirmed legacy hardware direction

Recovered legacy documentation and retained website material describe a technical concept containing:

- stereo cameras;
- LiDAR;
- IMU;
- AR / HUD projection;
- electrochromic visor concept;
- battery pack;
- compute module;
- camera-based field view;
- spatial measurements;
- task context;
- digital measurements;
- local edge processing.

The old repository also contains working or experimental code for:
- camera streaming;
- LiDAR UART;
- TF-Luna sensor handling;
- dual-camera HUD;
- HUD rendering;
- ArUco/world anchoring experiments;
- task selection;
- tool selection;
- level / plumb / distance workflows.

This is not a claim that a production-ready smart helmet exists. It is a retained R&D baseline.

---

## 4. Product identity going forward

Do not revive UNICON as the main brand.

Preferred product family naming should sit under NOSMO.

Working naming options:
- **NOSMO Field Helmet**
- **NOSMO Smart Helmet**
- **NOSMO Field Augmentation**
- **NOSMO Head System**

Final commercial naming is not locked.

UNICON should remain the legacy codename / archive reference so old documents and code remain traceable.

---

## 5. Core product thesis

The helmet should not become a generic AR headset.

Its job is to provide **minimal, task-relevant field intelligence**.

The worker should see only what is needed for the current task.

Core operating rule inherited from UNICON:

**Task -> selects tool -> tool selects measurement / guidance -> HUD shows only relevant information -> result returns to the project record.**

This remains stronger than a cluttered always-on AR interface.

---

## 6. Gen 1 target architecture

### Compute
- local edge compute;
- offline-first capability;
- vendor-independent processing layer;
- secure sync to Nexus when connectivity exists.

### Perception
- forward camera;
- optional stereo/depth configuration;
- IMU;
- compact LiDAR / ranging sensor;
- visual markers / ArUco / equivalent anchoring where useful.

### Display
- compact monocular or visor HUD;
- minimal text / line guidance;
- high-contrast field visibility;
- no unnecessary 3D graphics;
- safety-first visual hierarchy.

### Power
- replaceable battery;
- separate thermal and electrical safety design;
- runtime sufficient for useful site shifts or modular hot-swap.

### Interaction
Possible inputs:
- physical buttons;
- voice;
- Worker App / phone;
- tool state;
- supervisor / Nexus task context.

Do not make touch interaction on the helmet a dependency.

---

## 7. First practical workflows

The initial helmet should solve bounded construction problems rather than attempt full mixed-reality site control.

Candidate first workflows:

1. **Measure / level / plumb**
   - distance;
   - level;
   - frame plumb;
   - tolerance indication.

2. **Task-guided installation**
   - current task;
   - location;
   - required tool;
   - tolerance / specification;
   - evidence capture.

3. **Door / joinery verification**
   - gaps;
   - dimensions;
   - hardware / fixing checks;
   - final evidence.

4. **Fabrication / installation handoff**
   - model/object identity;
   - drawing / model context;
   - installation status;
   - revision awareness;
   - field evidence returned to Nexus.

5. **EXO integration**
   - show supported tool mode;
   - load / posture warnings where sensors exist;
   - tool-change instruction;
   - task sequence;
   - maintenance / inspection alerts.

---

## 8. Relationship to NOSMO EXO / Human Augmentation

The helmet and exoskeleton should be separate modular products but designed to interoperate.

### Head system
Provides:
- perception;
- measurements;
- task context;
- instructions;
- evidence capture;
- safety / status communication.

### EXO
Provides:
- passive load transfer;
- heavy-tool support;
- onboard tool power carriage;
- physical augmentation.

### Nexus
Provides:
- project context;
- worker identity;
- task;
- documents;
- model/object relationships;
- history;
- evidence;
- AI assistance.

Combined stack:

**Nexus -> Worker / Task Context -> Helmet guidance -> Human action -> EXO physical support -> Evidence back to Nexus**

The helmet must still work without EXO.
The EXO must still work without the helmet.

---

## 9. Relationship to robotics

The smart helmet is part of the same human-centred strategy as EXO.

Robotics should automate tasks when automation is practical.

The helmet should improve human perception, context and execution when the human remains the better operator.

This creates a three-part field model:
- autonomous machine;
- augmented human;
- normal human with digital guidance.

Nexus can coordinate all three.

---

## 10. FabStation collaboration track

FabStation Software is a **potential collaboration / integration track**, not a confirmed smart-helmet partner.

Previous NOSMO discussions with FabStation focused on:
- controlled real-file PoC;
- IFC object identity;
- IFC2x3 + KSS file-exchange packages;
- revision handling;
- SOLIDWORKS workflows;
- construction/fabrication handoff;
- field status/evidence returning to Nexus.

Potential smart-helmet relevance:
- show fabrication / installation instructions in the field;
- preserve object identity from design/fabrication to installation;
- validate installed condition;
- capture evidence against the correct object;
- compare revision / field status;
- create a direct fabrication-to-installer information path.

Do not claim API, live connector, FabStation partnership or hardware collaboration unless formally confirmed.

A sensible future PoC could be:

**SOLIDWORKS / FabStation -> Nexus object context -> Smart Helmet task guidance -> installer validation -> evidence back to Nexus**

---

## 11. Commercial position

The helmet should not initially compete with generic consumer AR glasses.

Target customers:
- specialist contractors;
- installation teams;
- fabrication + installation companies;
- fit-out;
- MEP;
- industrial maintenance;
- inspection / QA;
- infrastructure;
- construction training / controlled workflows.

Possible commercial models:
- equipment sale;
- lease;
- fleet;
- enterprise deployment;
- hardware + Nexus subscription;
- specialist tool/workflow packs.

---

## 12. Product generations

### Gen 0 — legacy UNICON R&D
Already explored:
- camera;
- IMU;
- LiDAR;
- HUD;
- task/tool logic;
- web/edge runtime;
- sensor experiments.

### Gen 1 — NOSMO Field Helmet prototype
Goal:
- physically wearable;
- one working display path;
- camera + IMU + ranging;
- task-guided HUD;
- one validated construction workflow;
- Nexus connection.

### Gen 2 — field pilot
Goal:
- ruggedisation;
- PPE integration;
- safety review;
- better optics;
- battery / thermal design;
- multiple workflows;
- contractor pilot.

### Gen 3 — connected augmentation system
Goal:
- EXO integration;
- richer spatial awareness;
- model/object anchoring;
- adaptive worker guidance;
- advanced field evidence.

---

## 13. Safety and product boundaries

Until tested and certified:
- no claim that the helmet is PPE;
- no claim that HUD guidance replaces drawings / approved method statements;
- no claim that measurements are survey-grade unless independently validated;
- no medical claims;
- no safety-critical automation without appropriate engineering and certification.

The display must never obstruct critical vision.

Human factors and distraction testing are mandatory before field deployment.

---

## 14. Documentation control

Legacy UNICON remains preserved as historical technical evidence.

Current NOSMO strategy should be stored in:
- `docs/NOSMO_SMART_HELMET_MASTER.md`
- `docs/NOSMO_HUMAN_AUGMENTATION_MASTER.md`
- `docs/NOSMO_CONSTRUCTION_HARDWARE_MASTER.md`

The legacy migration register is:
- `docs/LEGACY_UNICON_MIGRATION_INDEX.md`

Old documents must not be deleted or rewritten in-place merely because terminology changed.

Historical material should be copied or referenced, then classified as:
- RETAIN;
- SUPERSEDED;
- MERGE INTO CURRENT MASTER;
- ARCHIVE ONLY;
- NEEDS SOURCE RECOVERY.

---

## 15. Immediate next actions

1. Recover the full OneDrive UNICON archive / old Master Docs.
2. Inventory every document before rewriting anything.
3. Preserve original filenames and dates where available.
4. Copy source material into a controlled legacy folder / archive index.
5. Reconcile conflicts against the current UNICON GitHub repository.
6. Extract all helmet / visor / LiDAR / IMU / wall-scanner / HUD decisions.
7. Produce a modern hardware architecture document.
8. Produce a dedicated display / visor document.
9. Produce a spatial sensing / wall-scanner document.
10. Map the FabStation fabrication workflow to one helmet PoC.
11. Do not contact FabStation about helmet collaboration until the internal concept is coherent and the existing relationship is reviewed.
