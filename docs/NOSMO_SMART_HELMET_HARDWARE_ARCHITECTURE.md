# NOSMO Smart Helmet — Hardware Architecture

**Status:** ACTIVE TECHNICAL DIRECTION / REVALIDATION REQUIRED  
**Date:** 14 October 2026  
**Legacy basis:** UNICON hardware canon recovered from OneDrive

---

## 1. Primary design objective

Keep the head-worn assembly as light as possible.

Recovered UNICON hardware rules explicitly separated lightweight head components from heavier compute and power components.

That architecture is retained as the default starting point.

---

## 2. Head-mounted components

Target head-mounted set:
- forward camera;
- IMU;
- compact HUD / optical module;
- microphone;
- minimal cabling;
- only those sensors that must physically move with the head.

Do not place heavy compute, large batteries or unnecessary sensor modules on the helmet unless testing proves a strong reason.

---

## 3. Body / belt / EXO-mounted components

Candidate off-head components:
- main compute;
- battery;
- DC/DC conversion;
- communications modules;
- larger LiDAR / depth units where necessary;
- data / power distribution.

With the EXO programme now active, the body frame may become a better carrier for power and compute than a belt or backpack.

This creates a useful common architecture:

**Helmet = lightweight sensing + display**  
**EXO / body module = power + compute + heavy hardware**

The helmet must still support a standalone configuration for workers not using EXO.

---

## 4. Compute architecture

### Prototype
Legacy:
- Raspberry Pi 4 / 5;
- Linux;
- headless operation;
- Python / C++;
- OpenCV / OpenGL;
- REST / JSON / WebSocket.

Current recommendation:
- retain Raspberry Pi for low-cost prototypes where sufficient;
- benchmark modern edge-AI modules before locking production architecture;
- keep compute vendor-agnostic.

The old references to specific future compute products are historical and must not be treated as current procurement decisions.

---

## 5. Core sensor set

Recovered V1 canon listed:
- 6/9-axis IMU;
- front camera;
- LiDAR / ToF;
- microphone.

This remains a strong Gen 1 sensor baseline.

Possible additions only when justified:
- stereo camera;
- dedicated depth camera;
- eye tracking;
- second range sensor;
- thermal / environmental sensors;
- UWB / RTK for specific industrial use cases.

Avoid adding sensors merely because they are available.

---

## 6. Sensor-fusion model

Target data roles:
- IMU -> fast orientation / motion;
- camera -> visual context / localization;
- LiDAR / ToF -> range / scale / stabilization;
- optional fiducials -> controlled reference during early testing.

The new system should expose these through a sensor abstraction layer so individual vendors can be replaced.

---

## 7. Physical architecture

Preferred modular blocks:
1. Head unit
2. Optical module
3. Sensor pod
4. Compute module
5. Power module
6. Communications module
7. Nexus / Worker interface

Each block should have:
- defined electrical interface;
- defined data interface;
- replaceable mounting;
- diagnostic state;
- version identifier.

---

## 8. Power

Legacy concept included use of external tool batteries.

Current architecture should evaluate:
- dedicated hot-swappable battery;
- construction tool-battery adapter;
- EXO shared power bus where safe;
- USB-C PD for development rigs.

Production power architecture must include:
- fuse / over-current protection;
- thermal monitoring;
- battery state reporting;
- protected connectors;
- safe cable routing;
- independent shutdown.

---

## 9. Software boundary

The smart helmet is not the system of record.

It is a field endpoint.

Nexus owns:
- worker context;
- task context;
- documents;
- project object identity;
- evidence history;
- AI / knowledge layer.

Helmet runtime owns:
- low-latency sensor processing;
- local display;
- measurement execution;
- local safety-related device status;
- offline cache;
- evidence capture.

This prevents the old UNICON software platform from duplicating Nexus.

---

## 10. Communications

Legacy standards retained where appropriate:
- HTTP / REST;
- JSON;
- WebSocket;
- local LAN / direct connection.

Additional modern options can be evaluated:
- BLE for low-bandwidth controls;
- Wi-Fi Direct / local Wi-Fi;
- USB;
- cellular through phone / Worker App.

The helmet should continue useful operation when cloud connectivity is unavailable.

---

## 11. Production path

### Gen 0
Development rig using modular commercial components.

### Gen 1
Wearable integrated prototype.

### Gen 2
Custom carrier board / reduced cabling / ruggedized housing.

### Gen 3
Custom electronics where volume and reliability justify it.

Do not jump to custom PCB before the sensor / optics architecture is stable.

---

## 12. Integration with EXO

Potential shared components:
- battery;
- compute;
- wireless link;
- device identity;
- maintenance telemetry;
- task state.

No hard dependency:
- EXO works without helmet;
- helmet works without EXO;
- together they form a higher-capability Human Augmentation system.

---

## 13. Safety boundary

Before site deployment:
- mechanical retention must be tested;
- cable snag hazards must be controlled;
- display obstruction must be measured;
- heat near the head must be limited;
- electromagnetic / electrical safety assessed;
- PPE certification implications reviewed.

No current document should state that the system is certified for protective use.
