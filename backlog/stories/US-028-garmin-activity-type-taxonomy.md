---
id: US-028
title: Garmin activity-type taxonomy for athlete sport selector
role: trener
priority: P1
estimate: M
status: Draft
lane: C
dependencies: [US-002, US-012, US-027]
epic: EPIC-B
design_required: true
design_doc: docs/design/US-028-garmin-activity-type-taxonomy-design.md
adr_refs: []
created: 2026-08-22
updated: 2026-08-22
sprint: TBD
---

# US-028 — Garmin Activity-Type Taxonomy for Athlete Sport Selector

## User Story

**Jako** trener,
**chcę** móc wybrać sport zawodnika z pełnej listy dyscyplin Garmin Connect
(biegi, kolarstwo, pływanie, sporty zespołowe, siłownia, winter sports i inne),
**aby** AI generował plan dostosowany do modalności treningu (wytrzymałość /
siła / technika) i żeby poprawnie działało filtrowanie testów fitness — nawet
jeśli Garmin doda nowe dyscypliny w przyszłości.

## Background / Problem Statement

Obecna lista sportów w `lib/constants/sports.ts` zawiera **11 kluczy po polsku**
(`pilka_nozna`, `koszykowka`, …) zdefiniowanych ręcznie. Powoduje to kilka
problemów:

| Problem | Skutek |
|---|---|
| Brak wielu sportów (triathlon, kolarstwo szosowe, pływanie otwarte, rugby, …) | Trener zostawia sport pusty lub wpisuje "inne" — AI dostaje `"ogolny fitness"` jako kontekst |
| Klucze po polsku nie pasują do żadnej zewnętrznej taksonomii | Mapping do Garmin Connect, Strava, FIT SDK niemożliwy |
| Prompt AI dostaje surowy slug np. `"pilka_nozna"` | Claude widzi maszynowy klucz zamiast nazwy sportu i modalności |
| `Sport` union typ (11 elementów) blokuje US-027 activityType discovery | Heurystyki endurance/strength/skill niemożliwe bez kategorii |
| Dodanie nowego sportu wymaga PR + wdrożenia | Lista nie rośnie automatycznie z Garmin API |

**Garmin Connect** prowadzi kanoniczną, hierarchiczną listę ~120 typeKeyów
pod ~11 kategorii nadrzędnych (`running`, `cycling`, `fitness_equipment`, …).
Jej struktura jest udokumentowana i stabilna — nowe sporty są dodawane
jako liście pod istniejące kategorie, więc resolver oparty na `parentTypeId`
obsługuje je automatycznie.

## Acceptance Criteria (Gherkin)

### AC-1: Istniejące dane zawodników (stare klucze) działają bez zmian

```gherkin
Zakładając, że w bazie istnieje zawodnik z sport: "pilka_nozna"
Kiedy trener otwiera kartę zawodnika
Wtedy sport wyświetla się jako "Piłka nożna" (label z mapy aliasów)
  I generowanie planu AI działa i w prompcie pojawia się sport + modalność
  I filtrowanie testów fitness działa jak przed US-028
  I nie ma żadnego błędu ani wyjątku
```

### AC-2: Nowe/nieznane typeKey Garmin rozwiązują się gracefully

```gherkin
Zakładając, że Garmin doda nową dyscyplinę "parkour" (nieznana w snapshocie)
  I zawodnik ma sport: "parkour"
Kiedy aplikacja próbuje rozwiązać sport
Wtedy resolver zwraca kategorię nadrzędną (jeśli znana) lub "other"
  I nie wyrzuca wyjątku
  I plan AI generuje się z fallback etykietą "parkour" i modalnością "mixed"
  I test fitness filtering używa kategorii "other" (nie blokuje generacji)
```

### AC-3: Selektor sportu pokazuje pogrupowaną listę Garmin

```gherkin
Zakładając, że trener edytuje profil zawodnika
Kiedy otworzy pole "Sport"
Wtedy widzi dropdown podzielony na grupy (np. "Bieganie", "Kolarstwo", "Siłownia / trening")
  I w każdej grupie są dyscypliny z taksonomii Garmin z polskimi nazwami
  I stare dyscypliny (pilka_nozna, koszykowka, …) są widoczne w odpowiednich grupach
  I wybór dowolnej dyscypliny zapisuje typeKey jako wartość sport w bazie
```

### AC-4: Sport w prompcie AI zawiera czytelną nazwę i modalność

```gherkin
Zakładając, że zawodnik ma sport: "trail_running"
Kiedy generowany jest plan AI
Wtedy prompt zawiera "- Sport: Bieganie po szlakach (wytrzymałość)"
  I nie zawiera surowego sluga "trail_running"
```

### AC-5: Modalność sportu poprawnie klasyfikuje dyscypliny

```gherkin
Zakładając, że istnieją typeKeys z różnych kategorii
Kiedy wywołany jest resolveSportModality()
Wtedy:
  | typeKey            | oczekiwana modalność |
  | trail_running      | endurance            |
  | road_biking        | endurance            |
  | strength_training  | strength             |
  | yoga               | skill                |
  | soccer             | mixed                |
  | triathlon          | mixed                |
  | pilka_nozna (alias)| mixed                |
```

### AC-6: Filtrowanie testów fitness działa przez kategorię, nie stały Union

```gherkin
Zakładając, że test "Beep Test" jest przypisany do kategorii "endurance"
  I zawodnik ma sport: "trail_running" (kategoria: running → endurance)
Kiedy trener otwiera zakładkę Testy fitness
Wtedy Beep Test jest widoczny na liście dostępnych testów
  I zachowanie jest identyczne jak dla sport: "lekkoatletyka" przed US-028
```

### AC-7: Istniejące dane Garmin w DB zachowują poprawną wartość sport

```gherkin
Zakładając, że zawodnik ma sport: "lekkoatletyka" (stary klucz)
Kiedy trener otworzy formularz edycji profilu
Wtedy dropdown pokazuje wybraną pozycję odpowiadającą "lekkoatletyka"
  (lub jej alias Garmin "track_running")
  I zapis formularza bez zmian nie nadpisuje wartości
```

### AC-8: Skrypt odświeżania snapshoту istnieje i jest udokumentowany

```gherkin
Zakładając, że Garmin dodał nowe dyscypliny od ostatniego snapshotu
Kiedy developer uruchomi `npx tsx scripts/fetch-garmin-activity-types.ts`
  z ustawionymi zmiennymi GARMIN_EMAIL i GARMIN_PASSWORD
Wtedy plik lib/constants/garmin-activity-types.ts zostaje zaktualizowany
  I nowe typeKeys pojawiają się w snapshocie
  I resolver automatycznie je obsługuje przy następnym buildzie
```

## Out of Scope

- Automatyczne uruchamianie skryptu refresh w CI (wymaga Garmin OAuth).
- Pełne tłumaczenie wszystkich ~120 typeKeyów na język polski
  (długi ogon — humanizowany fallback wystarczy).
- Synchronizacja aktywności z Garmin Connect (US-029+, oddzielna historia).
- Zmiana kolumny `sport` w bazie danych — pozostaje `text`, brak migracji.
- Zmiana US-014 feedback na poziomie ćwiczenia (US-027 follow-up).
- Zmiany w async job queue ani public athlete endpoint.
