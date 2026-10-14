# Legacy UNICON Migration Index

**Status:** MIGRATION COMPLETE — CANONICAL / MASTER DOCUMENTS RECOVERED  
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

These files are retained as supplementary evidence. The OneDrive archive has now also been recovered and inventoried.

---

## 4. OneDrive source archive — recovered

Live OneDrive access was connected and the historical UNICON archive was located.

Confirmed archive locations include:
- `/UNICON/UNICON_ARCHIVE`
- `/UNICON/UNICON_ARCHIVE/01_KANON`
- `/UNICON/UNICON_ARCHIVE/02_MASTER_DOCS`
- `/UNICON/UNICON_ARCHIVE/02_MASTER_DOCS/HARDWARE_SYSTEM`
- `/UNICON/UNICON_ARCHIVE/02_MASTER_DOCS/HUD_VISOR`
- `/UNICON/UNICON_ARCHIVE/06_REFERENCE`
- gold snapshot under `UNICON_ARCHIVE__SNAPSHOT_GOLD__20260206_2210`

Confirmed files include:
- `all Master Docs.txt`
- `SOURCE_OF_TRUTH.md`
- `KANON__TECHNICAL__HARDWARE_SYSTEM__LOCKED.md`
- `KANON__MAIN_SCREEN_DISPLAY_INTERACTION__V1__LOCKED.md`
- `KANON__TIMESPACE__v1.0__LOCKED.md`
- `MASTERDOC__HUD_VISOR_SYSTEM__v1.0__SOURCE_OF_TRUTH.md`
- `MASTERDOC__SYSTEM_ARCHITECTURE__v2.0__ADDENDUM.md`
- `MASTERDOC__v1.3__FINAL__LOCKED.md`
- `CODING_OPERATOR_MASTER_DOC_v1.0.md`

Archive ZIPs confirmed:
- `/UNICON/UNICON_ARCHIVE.zip`
- `/UNICON/UNICON_PROJECT_v0.1_LOCKED_2025-12-20.zip`

A full preserved copy of the consolidated OneDrive master-doc source has now been committed as:
- `docs/legacy-unicon/ONEDRIVE__all_Master_Docs.txt`

The archive is now considered **located and migrated for canonical/master documentation**.

Migration evidence is recorded in:
- `docs/legacy-unicon/LEGACY_UNICON_SOURCE_MANIFEST.md`
- `docs/legacy-unicon/ONEDRIVE__all_Master_Docs.txt`
- `docs/legacy-unicon/onedrive/`

The large ZIP archives remain on OneDrive as cold-history backups rather than being duplicated into Git.

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

### SOURCE RECOVERY RESULT
- hardware Master v1.3: recovered;
- system architecture v2.0 addendum: recovered;
- HUD / visor source-of-truth: recovered;
- main-screen interaction canon: recovered;
- hardware canon: recovered;
- Timespace canon: recovered;
- Source of Truth and Kanon Index: recovered;
- consolidated historical master bundle: recovered.

No standalone completed Wall Scanner Master was found in the canonical master set. The recovered HUD/visor source itself records Wall Scanner and Sensor Fusion as future master documents with no data at that time. The concept is therefore preserved as an R&D track rather than reconstructed as if a historical specification existed.

---

## 6. Current destination documents

Canonical current work:
- `NOSMO_SMART_HELMET_MASTER.md`
- `NOSMO_SMART_HELMET_HARDWARE_ARCHITECTURE.md`
- `NOSMO_SMART_HELMET_DISPLAY_AND_VISOR.md`
- `NOSMO_FIELD_SPATIAL_SENSING_AND_WALL_SCANNER.md`
- `NOSMO_HUMAN_AUGMENTATION_MASTER.md`
- `NOSMO_CONSTRUCTION_HARDWARE_MASTER.md`

Migration control:
- `legacy-unicon/LEGACY_UNICON_SOURCE_MANIFEST.md`
- `legacy-unicon/ONEDRIVE__all_Master_Docs.txt`
- `legacy-unicon/INDEX.md`

Possible future product document:
- `NOSMO_SMART_HELMET_FABRICATION_INTEGRATION.md`

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

Legacy UNICON recovery is now complete at the canonical/master-document level. Before any FabStation helmet proposal is sent:
- review the previous FabStation conversation;
- define one bounded fabrication-to-field PoC;
- keep FabStation described as a potential integration/collaboration path unless they explicitly agree otherwise.


---

## 8. Current OneDrive-derived NOSMO documents

The following current documents were created from recovered legacy material:

- `NOSMO_SMART_HELMET_HARDWARE_ARCHITECTURE.md`
- `NOSMO_SMART_HELMET_DISPLAY_AND_VISOR.md`
- `NOSMO_FIELD_SPATIAL_SENSING_AND_WALL_SCANNER.md`

These reinterpret legacy UNICON decisions for the current NOSMO architecture.

Important rule:
- old `LOCKED` labels remain historical;
- current NOSMO engineering may supersede them where testing, safety, current technology or Nexus integration requires it.


---

## 9. Migration completion

**Completed:** 14 October 2026

The historical UNICON material is now split cleanly into two layers:

1. **Historical evidence**
   - original private `UNICON` repository;
   - OneDrive archive and cold ZIP backups;
   - preserved Git source copies / source records under `docs/legacy-unicon/`.

2. **Current NOSMO engineering**
   - Smart Helmet Master;
   - Hardware Architecture;
   - Display & Visor Architecture;
   - Spatial Sensing / Wall Scanner R&D;
   - Human Augmentation Master;
   - Construction Hardware Master.

No historical UNICON document has been deleted or overwritten in its original location.
