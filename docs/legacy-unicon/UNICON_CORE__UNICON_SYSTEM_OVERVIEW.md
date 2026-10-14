> Legacy source copy from `mateuszfurmanski-droid/UNICON/UNICON_CORE/UNICON_SYSTEM_OVERVIEW.md`. Preserved for migration traceability. Do not treat as current NOSMO product specification without checking current master documents.

# UNICON – SYSTEM OVERVIEW (V1)

Data: 2025-12-30  
Status: PROTOTYP V1 – SOFTWARE-FIRST  
Zakres: dokument nadrzędny (architektura + granice systemu)

---

## 1. Czym jest UNICON (jednym zdaniem)

UNICON jest modularnym, software-first systemem wsparcia pracy na budowie, który prowadzi wykonawcę przez zadania robocze w czasie rzeczywistym, wykorzystując HUD, narzędzia pomiarowe oraz edge computing.

---

## 2. Zasada nadrzędna (NIE DO RUSZANIA)

UNICON jest projektowany jako:

**SOFTWARE-FIRST PLATFORM**

Oznacza to, że:
- core systemu jest niezależny od hardware,
- każdy sensor jest tylko źródłem danych,
- HUD jest wyłącznie rendererem informacji,
- logika systemu nie zależy od konkretnego urządzenia.

Ta zasada obowiązuje dla całego V1 i kolejnych wersji.

---

## 3. Warstwy systemu UNICON

### 3.1 CORE (NIE ZMIENIAĆ)
Elementy krytyczne, które stanowią serce systemu:

- Flask API
- JSON-based configuration
- Task Engine
- Tool Engine
- Workflow logic (task → tool → action)
- HUD logic (overlay, status, komunikaty)

Core:
- działa lokalnie (edge),
- nie wymaga internetu,
- nie zależy od producenta hardware.

---

### 3.2 MODULES (ROZSZERZALNE)
Elementy, które mogą być wymieniane lub rozwijane bez naruszania core:

- IMU (orientacja, stabilizacja)
- LiDAR (pomiary)
- Kamera (wizualne odniesienie)
- HUD hardware (wyświetlacz przy oku)

Moduły:
- komunikują się z core przez jasno określony interfejs,
- mogą być mockowane (jak w V1),
- mogą być zastąpione innymi modelami.

---

### 3.3 INTERFACES (API)
UNICON komunikuje się przez:

- REST API
- JSON
- lokalną sieć (LAN)

Interfejsy:
- manager → worker
- worker → system
- system → HUD

API jest traktowane jako kontrakt systemowy.

---

## 4. Task Engine (zarządzanie pracą)

Task Engine odpowiada za:
- listę zadań,
- aktualne zadanie,
- kolejność prac,
- przypisanie narzędzia do zadania.

Każde zadanie zawiera:
- ID
- tytuł
- lokalizację
- wymagane narzędzie

Task Engine:
- może być sterowany lokalnie,
- może być sterowany zdalnie,
- jest niezależny od UI.

---

## 5. Tool Engine (narzędzia)

Tool Engine odpowiada za:
- logikę narzędzi roboczych,
- prezentację danych w HUD,
- wymuszenie poprawnego użycia narzędzi.

Przykładowe narzędzia:
- DISTANCE_MEASURE
- LEVEL_MEASURE
- PLUMB
- TASKS

Tool Engine:
- działa na danych z sensorów lub mocków,
- nie zna źródła danych (hardware-agnostic).

---

## 6. HUD (Head-Up Display)

HUD w UNICON:
- nie jest AR,
- nie jest immersyjny,
- nie renderuje świata 3D.

HUD:
- prezentuje informacje kontekstowe,
- wymusza skupienie i stabilność,
- ogranicza chaos informacyjny.

HUD jest warstwą prezentacji, nie logiki.

---

## 7. Hardware w V1

Hardware w V1:
- nie jest celem samym w sobie,
- służy wyłącznie walidacji systemu.

Brak hardware:
- nie blokuje rozwoju core,
- nie blokuje dotacji,
- nie blokuje demo.

---

## 8. Zakres V1 (SCOPE LOCK)

Wersja V1 obejmuje:
- działający core systemu,
- HUD software,
- task engine,
- tool engine,
- mockowane sensory.

V1 NIE obejmuje:
- certyfikacji,
- ergonomii kasku,
- finalnego designu hardware,
- skalowania produkcyjnego.

---

## 9. Cel V1

Celem V1 jest:
- udowodnienie działania systemu,
- walidacja workflow,
- przygotowanie do pilotażu,
- podstawa do dotacji i V2.

---

## 10. Przejście do V2

V2 będzie obejmować:
- realne sensory,
- dopracowany HUD hardware,
- pilotaż na budowie,
- przygotowanie do komercjalizacji.

Core systemu pozostaje niezmienny.

---

## 11. Podsumowanie

UNICON jest:
- systemem operacyjnym dla pracy na budowie,
- platformą software-first,
- rozwiązaniem skalowalnym i modularnym.

Ten dokument stanowi punkt odniesienia dla całego projektu.
