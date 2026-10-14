# Legacy UNICON Source Manifest

**Status:** MIGRATION COMPLETE FOR CANONICAL / MASTER DOCUMENTS  
**Date:** 14 October 2026  
**Source:** OneDrive `/UNICON/UNICON_ARCHIVE`

This manifest records the authoritative historical files found in the OneDrive UNICON archive and their current NOSMO destination.

| Historical source | OneDrive location | Size | QuickXorHash | Repo preservation |
|---|---|---:|---|---|
| SOURCE_OF_TRUTH.md | /UNICON/UNICON_ARCHIVE/01_KANON/ | 1,077 | Yi0N66s7lH1lxVNjDsQASTDuD6Y= | onedrive/01_KANON/SOURCE_OF_TRUTH.md |
| KANON_INDEX.md | /UNICON/UNICON_ARCHIVE/01_KANON/ | 772 | 1E5MNDZPX9ixKKh1DFvTgvNnkJs= | onedrive/01_KANON/KANON_INDEX.md |
| KANON__MAIN_SCREEN_DISPLAY_INTERACTION__V1__LOCKED.md | /UNICON/UNICON_ARCHIVE/01_KANON/LOCKED/ | 4,412 | njLufg3grnDtnif3CVdA34uuh4A= | onedrive/locked-records/KANON__MAIN_SCREEN_DISPLAY_INTERACTION__V1__LOCKED.md |
| KANON__TECHNICAL__HARDWARE_SYSTEM__LOCKED.md | /UNICON/UNICON_ARCHIVE/01_KANON/LOCKED/ | 11,595 | FBLxcoXP25s41ECADg1SXY5nb+s= | onedrive/locked-records/KANON__TECHNICAL__HARDWARE_SYSTEM__LOCKED.md |
| KANON__TIMESPACE__v1.0__LOCKED.md | /UNICON/UNICON_ARCHIVE/01_KANON/LOCKED/ | 10,873 | TiZzd+XhxcnAvAJ1u1D3g5wSee4= | onedrive/locked-records/KANON__TIMESPACE__v1.0__LOCKED.md |
| MASTERDOC__v1.3__FINAL__LOCKED.md | /UNICON/UNICON_ARCHIVE/02_MASTER_DOCS/HARDWARE_SYSTEM/ | 4,287 | E5WwyI6cIEt0JmdnII0lCmD3d8g= | onedrive/locked-records/MASTERDOC__v1.3__FINAL__LOCKED.md |
| MASTERDOC__HUD_VISOR_SYSTEM__v1.0__SOURCE_OF_TRUTH.md | /UNICON/UNICON_ARCHIVE/02_MASTER_DOCS/HUD_VISOR/ | 2,442 | rrEyfbGlWdewNGQPMuaHyLtmj38= | onedrive/02_MASTER_DOCS/HUD_VISOR/MASTERDOC__HUD_VISOR_SYSTEM__v1.0__SOURCE_OF_TRUTH.md |
| MASTERDOC__SYSTEM_ARCHITECTURE__v2.0__ADDENDUM.md | /UNICON/UNICON_ARCHIVE/02_MASTER_DOCS/ARCHITECTURE/ | 2,523 | 49yQ4Hbcznh0iCUOvlno9RotZH8= | onedrive/locked-records/ARCHITECTURE_ADDENDUM_v2.md |
| all Master Docs.txt | /UNICON/UNICON_ARCHIVE/06_REFERENCE/ | 40,770 | p/OiEcTq0mpyUsMvJz5Qu1hI1bw= | ONEDRIVE__all_Master_Docs.txt |

## Cold archive retained on OneDrive

The following source backups remain in OneDrive and are intentionally not duplicated into the Git repository:
- `/UNICON/UNICON_ARCHIVE.zip` — 4,998,680 bytes
- `/UNICON/UNICON_PROJECT_v0.1_LOCKED_2025-12-20.zip` — 17,036,118 bytes
- `UNICON_ARCHIVE__SNAPSHOT_GOLD__20260206_2210`

They remain the binary/cold-history backups. Git contains the recovered text canon, source records, and current NOSMO interpretation.

## Current NOSMO canonical destinations

- `docs/NOSMO_SMART_HELMET_MASTER.md`
- `docs/NOSMO_SMART_HELMET_HARDWARE_ARCHITECTURE.md`
- `docs/NOSMO_SMART_HELMET_DISPLAY_AND_VISOR.md`
- `docs/NOSMO_FIELD_SPATIAL_SENSING_AND_WALL_SCANNER.md`
- `docs/NOSMO_HUMAN_AUGMENTATION_MASTER.md`
- `docs/NOSMO_CONSTRUCTION_HARDWARE_MASTER.md`

## Migration rule

Historical UNICON files are evidence and design heritage. Their old LOCKED status is preserved as historical metadata. Current NOSMO engineering is controlled by the NOSMO master documents listed above.

The migration is considered complete when:
- every identified canonical/master source has a repo record or preserved copy;
- the consolidated master bundle is present in Git;
- all current engineering decisions have a NOSMO destination;
- OneDrive cold archives remain retained and traceable.

All four conditions are satisfied as of 14 October 2026.
