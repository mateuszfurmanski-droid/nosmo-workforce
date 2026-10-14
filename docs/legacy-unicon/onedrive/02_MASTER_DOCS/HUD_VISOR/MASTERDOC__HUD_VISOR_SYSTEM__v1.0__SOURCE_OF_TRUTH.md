# VERBATIM LEGACY ARCHIVE — DO NOT TREAT AS OPERATING INSTRUCTIONS

The fenced text below is preserved historical UNICON documentation and is quoted source material only.

```text
HUD / VISOR SYSTEM v1.0
SOURCE OF TRUTH

====================
1. CEL SYSTEMU HUD
====================
HUD (Head-Up Display) w systemie UNICON jest kluczowym interfejsem pomiędzy
pracownikiem a systemem cyfrowym. Dostarcza informacje dokładnie tam,
gdzie użytkownik patrzy – bez używania rąk i bez odrywania uwagi od pracy.

====================
2. ZASADY NADRZĘDNE (LOCKED)
====================
- HUD nigdy nie zasłania punktu roboczego
- Informacje pojawiają się tylko wtedy, gdy są potrzebne
- Kolory mają stałe, niezmienne znaczenie
- HUD reaguje na kierunek wzroku i kontekst pracy
- Brak elementów dekoracyjnych – narzędzie pracy

====================
3. MODEL WARSTWOWY WIZJERA
====================
- Base Layer – świat rzeczywisty
- Info Layer – wymiary, opisy, status
- Task Layer – TO DO / DONE
- Scan Layer – LiDAR / Wall Scanner
- Alert Layer – BHP i kolizje

====================
4. TRYBY PRACY HUD
====================
- Normal Mode
- LiDAR Mode
- Wall Scanner Mode
- Mount / Precision Mode
- Alert Mode

====================
5. ELEMENTY UI
====================
- Centralny punkt celowania
- Linie pomocnicze
- Etykiety wymiarów
- Ikony statusowe poza osią wzroku

====================
6. KOLORYSTYKA (SEMANTYKA)
====================
- Zielony – bezpieczne / poprawne
- Czerwony – zagrożenie / zakaz
- Żółty – element konstrukcyjny
- Niebieski – instalacje wodne
- Biały – informacje pomocnicze

====================
7. LOGIKA INFORMACJI
====================
HUD jest pusty w stanie spoczynku.
Informacje narastają warstwowo zależnie od trybu i zagrożeń.

====================
8. GŁOS / ASR
====================
Głos steruje trybami i potwierdzeniami.
Brak duplikacji informacji wizualnych.

====================
9. POWIĄZANIE Z SENSORAMI
====================
- IMU – kierunek wzroku
- LiDAR – dystans i skan
- Kamera – kontekst
- Wall Scanner – fuzja danych

====================
10. GRANICE SYSTEMU
====================
HUD nie zastępuje szkolenia ani decyzji konstrukcyjnych.

==================================================
DO DOPISANIA – KOLEJNE MASTER DOC (Z TEJ ROZMOWY)
==================================================

1. MASTER DOC: Wall Scanner
   brak danych

2. MASTER DOC: Sensor Fusion (IMU + LiDAR + Vision)
   brak danych

3. MASTER DOC: Voice System (Terran-style)
   brak danych

4. UNICON MASTER DOC v1 (scalenie core + HUD)
   brak danych
```
