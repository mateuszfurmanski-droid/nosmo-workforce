> Legacy source copy from `mateuszfurmanski-droid/UNICON/UNICON_CORE/UNICON_V1_STATE.md`. Preserved for migration traceability. Do not treat as current NOSMO product specification without checking current master documents.

# UNICON V1 – FROZEN STATE (Snapshot)

Data: 2025-12-30
Status: WORKING PROTOTYPE (software-first)

## 1. Core
- Headless system (Raspberry Pi)
- Flask API
- MJPEG HUD stream
- Port: 8081

## 2. Tool Engine
Dostępne narzędzia:
- DISTANCE_MEASURE
- LEVEL_MEASURE
- PLUMB
- TASKS

Przełączanie:
- lokalnie (UI)
- przez API (/api/tool/set)

## 3. Task Engine
Pliki:
- tasks.json
- active_task.json

API:
- GET /api/tasks/current
- POST /api/tasks/next
- POST /api/tasks/set

Task fields:
- id
- title
- location
- tool

## 4. Workflow
Manager / system:
→ ustawia task
→ task wskazuje narzędzie
→ HUD prowadzi wykonawcę

## 5. HUD
- overlay na obraz z kamery
- reticle
- HOLD STEADY / LOCKED
- informacje o tool + task

## 6. Sensors
- IMU: mock (logika gotowa)
- LiDAR: mock (logika gotowa)

## 7. Status V1
- Core: DONE
- Workflow: DONE
- Hardware: PENDING
- UI polish: PENDING

V1 gotowy do:
- dotacji
- demo
- dalszego rozwoju
