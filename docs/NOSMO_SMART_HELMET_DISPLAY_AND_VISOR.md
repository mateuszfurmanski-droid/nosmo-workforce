# NOSMO Smart Helmet — Display & Visor Architecture

**Status:** ACTIVE TECHNICAL DIRECTION / REVALIDATION REQUIRED  
**Date:** 14 October 2026  
**Legacy source:** UNICON HUD / VISOR master documents recovered from OneDrive

---

## 1. Role of the visor

The visor is not a general-purpose screen.

Its purpose is to provide compact, task-relevant field information while leaving the worker's real-world view dominant.

Core rule:

> The display must add information without taking ownership of the worker's field of view.

The old UNICON material repeatedly established:
- quiet / mostly empty default display;
- no decorative graphics;
- information only when needed;
- central reference point;
- peripheral status information;
- strong semantic colour use;
- no full-screen opaque interface.

These principles are retained.

---

## 2. Legacy interaction model retained for research

Recovered UNICON documents described a non-classical interaction model using:
- head orientation from IMU;
- distance context from LiDAR;
- hand-reference / glove anchor point;
- dwell / stability timing;
- central reticle;
- right-side LIVE world;
- left-side timeline / planning world;
- manual theme switching by gesture.

This is preserved as prior R&D.

It is **not automatically locked for the new NOSMO product**. The modern prototype must compare this model against simpler controls such as:
- physical buttons;
- voice;
- phone / Worker App;
- limited gesture control.

Construction usability and reliability take priority over novelty.

---

## 3. Quiet-screen rule

The screen should be almost empty when:
- no measurement is active;
- no safety alert is active;
- no task instruction needs attention;
- the user is not interacting.

This is a retained design principle.

The worker should never have to visually "manage an interface" while performing physical work.

---

## 4. Display layers

Current proposed layer model:

### World / geometry layer
- simple lines;
- edges;
- axes;
- reference points;
- no opaque geometry unless a specific task requires it.

### Measurement layer
- distance;
- level;
- plumb;
- depth;
- tolerance state.

### Task layer
- current task;
- location;
- next action;
- required tool;
- key tolerance / specification.

### Alert layer
- warnings;
- no-go information;
- conflict / collision information;
- system faults.

### System layer
- battery;
- sensor status;
- connection state;
- recording / evidence state.

The alert layer always has priority over informational layers.

---

## 5. Colour system

Legacy UNICON material converged on a minimal colour system.

For the new NOSMO prototype, the starting point is:
- green = OK / accepted / within tolerance;
- red = warning / unsafe / failed;
- blue or white = neutral system information;
- amber / yellow may be reserved for caution where required.

Exact accessibility and safety semantics must be validated before field use.

The old hard three-colour restriction is no longer treated as immutable hardware law; it remains a strong low-complexity design preference.

---

## 6. Optical architecture

Recovered legacy material rejected the idea of covering the entire construction visor with a large transparent display.

That remains a sound architectural constraint.

Candidate directions:

### Gen 1
- compact monocular display;
- micro-OLED / LCOS or equivalent;
- optical combiner or compact projection path;
- replaceable / modular mounting;
- display kept away from the primary work sightline.

### Later generations
- waveguide or more advanced transparent optics;
- wider field of view only when the use case justifies it.

No optical technology is locked until tested for:
- daylight readability;
- eye relief;
- PPE compatibility;
- weight;
- heat;
- vibration;
- optical distortion;
- cost;
- serviceability.

---

## 7. Visor and PPE separation

The smart display module and the protective visor / helmet shell should be treated as separable engineering layers.

The project should avoid making the electronics inseparable from one helmet manufacturer.

Preferred strategy:
- modular electronics;
- modular optical unit;
- certified protective components sourced separately where possible;
- mounting system designed around certification constraints.

No claim should be made that the current concept is certified PPE.

---

## 8. Visual stability

The legacy project used the concept of **SFOV** — keeping displayed information stable relative to the physical world rather than fixed to head motion.

Modern interpretation:
- IMU provides fast orientation;
- camera / visual tracking provides world-relative correction;
- LiDAR / depth assists range and stability;
- optional fiducials can be used for controlled early prototypes.

The objective is not "AR for its own sake". It is stable placement of useful construction information.

---

## 9. Gen 1 display target

A realistic first prototype should prove:
1. readable compact HUD;
2. stable central reference;
3. one measurement overlay;
4. one task instruction flow;
5. clear OK / warning semantics;
6. evidence capture without obstructing the worker.

Everything else is secondary.

---

## 10. Legacy source control

Primary recovered sources:
- `all Master Docs.txt` from OneDrive archive;
- `MASTERDOC__HUD_VISOR_SYSTEM__v1.0__SOURCE_OF_TRUTH.md`;
- `KANON__MAIN_SCREEN_DISPLAY_INTERACTION__V1__LOCKED.md`;
- `KANON__TECHNICAL__HARDWARE_SYSTEM__LOCKED.md`.

The old "LOCKED" status applies historically to UNICON. It does not prevent engineering changes in the new NOSMO product.
