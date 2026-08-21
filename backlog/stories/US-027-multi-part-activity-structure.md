---
id: US-027
title: Multi-part activity structure in generated training plans
role: trener
priority: P1
estimate: L
status: Draft
lane: C
dependencies: [US-026]
epic: EPIC-B
design_required: true
design_doc: docs/design/US-027-multi-part-activity-structure-design.md
adr_refs: []
created: 2026-08-22
updated: 2026-08-22
sprint: TBD
---

# US-027 — Multi-part Activity Structure in Generated Training Plans

## User Story

**Jako** trener,
**chcę** żeby plan AI generował różne struktury ćwiczeń (supersety, obwody, progresję obciążeń)
zamiast kodować wszystko w płaskich stringach,
**aby** plan był precyzyjny i zgodny z rzeczywistą strukturą treningu —
i mógł być poprawnie wyświetlany, eksportowany i analizowany w przyszłości.

## Background / Problem Statement

Obecny schemat `Exercise` jest płaski i jednolity dla każdego rodzaju ćwiczenia:

```
{ name, sets, reps, intensity, rest, tempo, notes }
// wszystkie pola: plain string, brak sub-struktury
```

Model AI otrzymuje identyczny schemat niezależnie od typu ćwiczenia i generuje
te same płaskie pola. Nie ma żadnego mechanizmu "odkrycia" (discovery) —
AI nie wybiera struktury na podstawie kontekstu.

W praktyce treningowej ćwiczenia mają różne struktury:

| Typ | Przykład | Obecna obsługa | Problem |
|---|---|---|---|
| **Simple** | Squat 4×8 @80% | Pełna obsługa | Brak |
| **Superset** | Bench Press + Bent-over Row (na zmianę) | Dwa oddzielne wiersze + opis w `notes` | Utrata informacji o powiązaniu; brak wspólnego odpoczynku |
| **Circuit** | Push-up → Squat → Plank × 3 rundy | Jeden wpis z opisem w `notes` | Kolejność i parametry każdego ćwiczenia gubione |
| **Progression** | Set 1: 8×60%, Set 2: 6×72.5%, Set 3: 4×85% | `sets: "3"` + `notes: "60/72.5/85%"` | Dane per-seria nie są maszynowo-czytelne |

Efekty:
- UI pokazuje uproszczony, często mylący widok (np. superset jako dwa osobne
  ćwiczenia bez powiązania wizualnego).
- Przyszłe funkcje (eksport PDF, analiza objętości treningowej, feedback
  na poziomie ćwiczenia) nie mogą działać na tych danych.
- AI generuje niespójne opisy w `notes` zamiast struktury.

## Acceptance Criteria (Gherkin)

### AC-1: Istniejące plany renderują się bez zmian

```gherkin
Zakładając, że w bazie istnieje plan wygenerowany przed US-027
  I ćwiczenia w plan_json nie mają pola activityType
Kiedy trener lub zawodnik otwiera ten plan
Wtedy każde ćwiczenie renderuje się w widoku "simple" (obecny ExerciseRow)
  I nie pojawia się żaden błąd walidacji ani renderowania
```

### AC-2: AI generuje superset dla powiązanych antagonistycznych ćwiczeń

```gherkin
Zakładając, że trener generuje plan z ćwiczeniami siłowymi
  I AI decyduje o połączeniu dwóch antagonistycznych ćwiczeń w superset
Kiedy plan jest gotowy i zapisany
Wtedy co najmniej jedno ćwiczenie ma activityType: "superset"
  I to ćwiczenie zawiera dokładnie 2 elementy w tablicy parts
  I każdy element ma pola: name, reps, intensity, tempo
  I ćwiczenie ma pola: groupLabel, sets, rest
  I ExerciseRow wyświetla obie części z oznaczeniem "A1" / "A2"
  I wyświetlony jest wspólny odpoczynek między superseriami
```

### AC-3: AI generuje circuit dla 3+ ćwiczeń w sekwencji

```gherkin
Zakładając, że trener generuje plan z blokiem kondycyjnym lub obwodem
Kiedy plan jest gotowy i zapisany
Wtedy odpowiedni blok ma activityType: "circuit"
  I zawiera 3–6 elementów w tablicy parts
  I ćwiczenie ma pola: groupLabel, rounds, rest
  I ExerciseRow wyświetla ćwiczenia w numerowanej kolejności
  I wyświetlona jest liczba rund i odpoczynek między rundami
```

### AC-4: AI generuje progression dla ćwiczeń z różnymi parametrami per seria

```gherkin
Zakładając, że AI decyduje o wave loading lub ramp-up dla danego ćwiczenia
Kiedy plan jest gotowy i zapisany
Wtedy to ćwiczenie ma activityType: "progression"
  I zawiera 2–6 serii w tablicy sets (każda: setNumber, reps, intensity)
  I ćwiczenie ma pola: name, tempo, rest
  I ExerciseRow wyświetla serie jako tabelę: Nr / Powt. / Intensywność
```

### AC-5: Walidacja Zod odrzuca niespójną strukturę multi-part

```gherkin
Zakładając, że plan_json zawiera ćwiczenie { activityType: "superset", parts: [jeden element] }
Kiedy worker próbuje zapisać plan przez trainingPlanJsonSchema.safeParse()
Wtedy result.success === false
  I plan nie jest persystowany w training_plans
  I job otrzymuje status: "failed" z przyczyną zawierającą "parts"
```

### AC-6: Plan z mieszanymi typami ćwiczeń przechodzi walidację

```gherkin
Zakładając, że plan_json zawiera dzień z: 1× simple, 1× superset, 1× progression
Kiedy trainingPlanJsonSchema.safeParse(plan) jest wywołane
Wtedy result.success === true
```

### AC-7: Pokrycie testów jednostkowych dla każdego activityType

```gherkin
Zakładając, że testy jednostkowe w tests/unit/lib/validation/ są uruchomione
Kiedy npm run test jest wywołane
Wtedy testy pokrywają parse/reject dla każdego activityType: simple, superset, circuit, progression
  I coverage threshold (70%) jest utrzymany
```

## Out of Scope

- Edycja multi-part ćwiczeń przez trenera w UI (US-017 — manual editing).
- Per-exercise feedback przez zawodnika (US-014 follow-up).
- Nowy typ `ampm` (rozdzielenie dnia na AM/PM sesje) — osobna historia.
- Eksport PDF z uwzględnieniem multi-part struktury.
- Exercise library / stable exercise_id (prereq dla eksportu i historii).
- Zmiany w `plan_generation_jobs` tabeli ani w polling flow (US-026).
- Zmiany w public athlete endpoint (`GET /api/athlete/[shareCode]/plans`).
