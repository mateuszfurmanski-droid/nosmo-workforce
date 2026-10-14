# NOSMO Field Spatial Sensing & Wall Scanner

**Status:** CONCEPT / R&D TRACK  
**Date:** 14 October 2026  
**Origin:** Legacy UNICON concept

---

## 1. Scope

The old UNICON master compilation repeatedly referenced a future **Wall Scanner Mode** and a dedicated Wall Scanner master document, but the recovered archive index currently does not expose a complete standalone wall-scanner specification.

Therefore this document preserves the concept without inventing missing historical details.

---

## 2. Intended purpose

Potential construction use cases:
- identify likely hidden services before drilling;
- combine known model data with live sensing;
- indicate safe / caution / unknown zones;
- compare expected installation from drawings/model against observed field conditions;
- store scan evidence against a Nexus project object / location.

This system must never claim hidden-service detection certainty unless validated by the actual sensing technology.

---

## 3. Sensor-fusion relationship

Wall-scanner output may combine:
- dedicated wall-scanning sensor;
- camera;
- IMU;
- LiDAR / depth;
- known BIM / drawing data;
- user-confirmed reference points.

Nexus provides project context.
The helmet provides visualization and evidence capture.
A dedicated scanner provides material / hidden-service sensing.

---

## 4. Display rule

Wall-scanner information should use uncertainty explicitly.

Possible states:
- CONFIRMED FROM SENSOR;
- EXPECTED FROM MODEL;
- POSSIBLE / UNCERTAIN;
- NOT SCANNED;
- CONFLICT BETWEEN MODEL AND SENSOR.

Do not visually present model data as if it were live sensor detection.

---

## 5. Drill-safety workflow concept

A future bounded workflow could be:

1. worker selects / receives drilling task;
2. Nexus identifies location and known services;
3. worker scans target area;
4. device records sensor confidence;
5. HUD shows safe / caution / unknown area;
6. worker confirms drilling point;
7. evidence is attached to the task.

This is a research workflow, not a current safety-certified process.

---

## 6. Next source-recovery task

Search the remaining OneDrive archive and snapshots for:
- wall scanner;
- hidden services;
- service detection;
- drill / drilling mode;
- sensor fusion;
- radar / GPR;
- capacitive / electromagnetic sensing;
- thermal sensing.

Any recovered source is to be preserved under `docs/legacy-unicon/` before this current document is expanded.
