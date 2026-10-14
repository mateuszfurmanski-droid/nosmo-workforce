# Legacy UNICON Migration Index

**Status:** ACTIVE MIGRATION CONTROL  
**Date:** 14 October 2026  
**Destination repository:** `mateuszfurmanski-droid/nosmo-workforce`  
**Legacy repository:** `mateuszfurmanski-droid/UNICON`

---

## 1. Purpose

This file controls migration of the old UNICON / smart-helmet documentation into the current NOSMO hardware documentation system.

The original UNICON repository is preserved.

No legacy source should be deleted.

---

## 2. Legacy repository sources already confirmed

### UNICON root
- `README.md`
- `RELEASE_NOTES_v0.1.md`
- `WHERE_IS_WHAT.txt`

### UNICON core
- `UNICON_CORE/UNICON_SYSTEM_OVERVIEW.md`
- `UNICON_CORE/UNICON_V1_STATE.md`
- `UNICON_CORE/style_tokens.json`
- `UNICON_CORE/tool_registry.json`
- `UNICON_CORE/tool_selector_rules.json`
- `UNICON_CORE/core_manifest.json`
- `UNICON_CORE/hud_lidar.html`
- `UNICON_CORE/hud_v1/*`

### UNICON docs
- `UNICON_DOCS/00_INDEX.md`
- `UNICON_DOCS/30_TOOL_LEVEL_MEASURE_CANON.md`
- `UNICON_DOCS/31_TOOL_WORKTOP_LEVEL_MEASURE.md`
- `UNICON_DOCS/32_TOOL_FRAME_PLUMB_3D.md`
- `UNICON_DOCS/33_TOOL_CUT_MITRE_SAW.md`
- `UNICON_DOCS/34A_TOOL_DOOR_GAP_TOLERANCE.md`
- `UNICON_DOCS/35_TOOL_HINGE_LOAD_CHECK.md`
- `UNICON_DOCS/36_TOOL_FINAL_CLIENT_CHECK.md`
- `UNICON_DOCS/ROLE_AND_TASK_FLOW.md`

### Sensor / runtime evidence
- camera runtime;
- TF-Luna / LiDAR code;
- IMU installation / module records;
- dual-camera HUD code;
- ArUco / world anchoring experiments;
- HUD snapshots under `_LOCKS`.

---

## 3. Legacy external/library material found

Indexed retained website material confirms the old concept included:

- Smart HUD;
- digital measurements;
- task management;
- site intelligence;
- AI assistance;
- integration layer;
- stereo cameras;
- LiDAR;
- IMU;
- AR projection;
- electrochromic visor;
- battery pack;
- compute module;
- field-worker / helmet ecosystem concept;
- roadmap from R&D prototype through spatial intelligence.

These files are not treated as a substitute for the missing full OneDrive archive.

---

## 4. OneDrive source archive still required

User has identified historical OneDrive material including:
- `UNICON_ARCHIVE`;
- historical UNICON project archive;
- old Master Docs;
- hardware / visor / wall-scanner documentation.

The complete archive has not yet been retrieved into the current tool-accessible source set.

Likely historical structure to verify from source:
- MASTER DOCS;
- ARCHITECTURE;
- HARDWARE SYSTEM;
- HUD / VISOR;
- KANON;
- SOURCE OF TRUTH;
- wall scanner / spatial sensing material.

Do not mark these as fully migrated until their actual OneDrive source files are inspected.

---

## 5. Migration classification

### RETAIN
- software-first / hardware-agnostic core principle;
- Task -> Tool -> HUD workflow;
- minimal HUD;
- local edge operation;
- modular sensors;
- tolerance-driven tools;
- camera / IMU / LiDAR research;
- object/task evidence loop.

### SUPERSEDED
- UNICON as current public product brand;
- UNICON as a separate software operating platform competing with Nexus;
- any legacy assumption that duplicates modern Nexus responsibilities.

### MERGE INTO CURRENT NOSMO
- helmet / HUD hardware;
- sensing;
- field guidance;
- physical worker interface;
- measurement tools;
- construction evidence capture;
- future EXO integration.

### NEEDS SOURCE RECOVERY
- old Master v1/v2/v3;
- visor/display master;
- wall scanner master;
- archived hardware BOMs;
- full OneDrive architecture / source-of-truth folders.

---

## 6. Current destination documents

Canonical current work:
- `NOSMO_SMART_HELMET_MASTER.md`
- `NOSMO_HUMAN_AUGMENTATION_MASTER.md`
- `NOSMO_CONSTRUCTION_HARDWARE_MASTER.md`

Future docs after archive recovery:
- `NOSMO_SMART_HELMET_HARDWARE_ARCHITECTURE.md`
- `NOSMO_SMART_HELMET_DISPLAY_AND_VISOR.md`
- `NOSMO_FIELD_SPATIAL_SENSING_AND_WALL_SCANNER.md`
- `NOSMO_SMART_HELMET_FABRICATION_INTEGRATION.md`
- `LEGACY_UNICON_SOURCE_MANIFEST.md`

---

## 7. FabStation boundary

FabStation is a potential integration / collaboration path based on previous Nexus discussions.

Do not represent FabStation as an agreed helmet-development partner.

Relevant previous technical themes:
- SOLIDWORKS;
- IFC;
- KSS;
- stable IFC GlobalId;
- revision handling;
- construction/fabrication handoff;
- field evidence.

Future helmet work should be proposed only after:
- legacy UNICON recovery;
- current helmet architecture is coherent;
- previous FabStation conversation is reviewed;
- a bounded PoC is defined.
