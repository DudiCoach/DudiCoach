---
id: US-013
title: Progresje obciazen - tracker z wykresem
role: trener
priority: P1
estimate: L
status: Done
dependencies: [US-002, US-003]
epic: EPIC-A
design_required: true
created: 2026-08-19
updated: 2026-08-20
sprint: Sprint 3 (Athlete Health Data)
---

# US-013 — Progresje obciążeń (tracker z wykresem)

## User Story

**Jako** trener,
**chcę** śledzić progresje obciążeń zawodnika per ćwiczenie (data, kg, powtórzenia, serie, notatka) z wykresem słupkowym i historią,
**aby** widzieć trendy zmian obciążenia w czasie i planować kolejne tygodnie treningowe.

## Scope

- Aktywacja zakładki "Progresje" w edytorze zawodnika (`/athletes/<id>`).
- Wpisy progresji: `exercise_name + date` = jeden wpis dziennie (unikalność wymuszona w bazie; konflikt → 409, aktualizacja przez PATCH).
- Grupowanie wg ćwiczeń: karta ćwiczenia z badge zmiany (ostatni vs poprzedni kg), wykresem słupkowym (SVG, bez nowej zależności) i historią wpisów.
- Formularz dodawania wpisu (nazwa ćwiczenia z podpowiedziami z istniejących, data, kg, powtórzenia, serie, notatka), edycja inline z auto-save, usuwanie z potwierdzeniem.

## Non-goals (poza zakresem)

- Wpisy od zawodnika (`source: 'athlete'`) — EPIC-C (panel zawodnika, real-time); kolumna `source` istnieje w schemacie, ale w tej story serwer przyjmuje tylko `coach`.
- Liczba śledzonych progresji na karcie dashboardu — US-019.
- Realtime dla progresji.
- Łączenie wpisów z ćwiczeniami planów (ćwiczenia w planach to wolny tekst JSONB; progresje są niezależne od planów).
- Przekazywanie progresji do kontekstu AI — wymaga decyzji consent/health-data (osobna story).
- Export PDF / podsumowania cyklu (US-016/US-018).

## Acceptance Criteria (Gherkin)

### AC-1: Zakładka Progresje aktywna

```gherkin
Zakładając, że jestem na /athletes/<id>
Wtedy zakładka "Progresje" jest aktywna (nie zablokowana)
Kiedy klikam "Progresje"
Wtedy widzę pusty stan "Brak śledzonych progresji" oraz formularz dodawania wpisu
```

### AC-2: Dodanie wpisu progresji

```gherkin
Zakładając, że wypełniłem nazwę ćwiczenia, datę i obciążenie (kg), opcjonalnie powtórzenia, serie i notatkę
Kiedy klikam "Dodaj wpis"
Wtedy wpis pojawia się w karcie ćwiczenia na wykresie i w historii
I w bazie istnieje dokładnie jeden rekord dla (athlete, exercise_name, date)
```

### AC-3: Wykres słupkowy + historia

```gherkin
Zakładając, że ćwiczenie ma co najmniej jeden wpis
Wtedy karta ćwiczenia pokazuje wykres słupkowy obciążenia wg dat oraz listę historii wpisów (data, kg, powtórzenia, serie, notatka)
Kiedy ćwiczenie ma jeden wpis
Wtedy wykres pokazuje pojedynczy słup (bez porównania)
```

### AC-4: Badge zmiany obciążenia

```gherkin
Zakładając, że ćwiczenie ma co najmniej dwa wpisy
Wtedy badge zmiany pokazuje różnicę kg między ostatnim a poprzednim wpisem (▲ wzrost / ▼ spadek / — bez zmian)
```

### AC-5: Zduplikowany (athlete, exercise_name, date) → konflikt

```gherkin
Zakładając, że wpis (ćwiczenie, data) już istnieje dla zawodnika
Kiedy próbuję dodać drugi wpis dla tego samego ćwiczenia i dnia
Wtedy widzę komunikat konfliktu "Wpis progresji dla tego ćwiczenia i dnia już istnieje" (HTTP 409)
I rekord nie jest podmieniany bez mojej wiedzy
```

### AC-6: Edycja inline z auto-save

```gherkin
Zakładając, że widzę wpis w historii
Kiedy zmieniam kg, powtórzenia, serie, datę lub notatkę
Wtedy zmiana zapisuje się automatycznie (auto-save) i widzę status zapisu
I po odświeżeniu strony zmiana jest widoczna
```

### AC-7: Usuwanie z potwierdzeniem

```gherkin
Zakładając, że widzę wpis w historii
Kiedy klikam "Usuń" przy wpisie
Wtedy widzę dialog potwierdzenia
Kiedy potwierdzam
Wtedy wpis znika z wykresu, historii i bazy
```

### AC-8: Walidacja formularza

```gherkin
Kiedy próbuję dodać wpis bez nazwy ćwiczenia lub z pustym/zerowym obciążeniem
Wtedy przycisk "Dodaj wpis" jest nieaktywny
I widzę komunikaty walidacji przy pustych polach
```

### AC-9: Bezpieczeństwo

```gherkin
Zakładając, że zawodnik należy do trenera A
Kiedy trener B lub anonim próbuje odczytać/zapisać progresje tego zawodnika (API)
Wtedy żądanie kończy się 401 (niezalogowany) lub 404 (cudzy zawodnik/wpis; RLS: brak dostępu)
```

## Dane (podsumowanie, szczegóły w designie)

- Tabela `load_progressions`: `id`, `athlete_id` (FK cascade), `exercise_name` (≤100), `entry_date`, `weight_kg` (numeric, 0.1–9999.9), `reps`, `sets`, `note` (≤1000), `source ('coach'|'athlete')`, `created_at`, `updated_at`.
- Unikalność dzienna: funkcyjny index `(athlete_id, lower(btrim(exercise_name)), entry_date)` — odporny na wielkość liter oraz wiodące/końcowe whitespace.
- RLS coach-owner tylko (wzorzec `injuries`/`diagnostic_findings`); brak anon policy; brak public RPC; `source` wymuszane server-side na `'coach'`.
- Wykres: własny SVG (bez nowej zależności npm).

## Verification plan

- SQL gates (`tests/sql/us013-load-progressions-gates.sql` wpięte w `verify-migrations.sh`): cross-coach deny, anon deny, unikalność dzienna (w tym case-insensitive), check constraints (weight_kg > 0, source), cascade, moddatetime.
- Integration: routes CRUD + auth + 409 + 404 (mock Supabase).
- Unit: walidacja Zod, badge zmiany, komponent (formularz, karta, wykres SVG, stany UI).
- E2E (env-gated, wzorzec US-010): pełny flow AC-1..AC-8 desktop + mobile.
- Pełne: lint, typecheck, vitest, build, SQL suite (3 fazy).

## References

- Spec: `docs/spec/original-spec.md` (ProgressionEntry, AthleteProgressions, sekcja Progresje, priorytet #6).
- Wzorce: `US-010` (diagnostics: migracja + RLS + routes + tab + SQL gates), `US-011` (injuries), ADR-0002 (route handlers + tanstack query), ADR-0003 (auto-save).
- Design: `docs/design/US-013-load-progressions-design.md`.
- Powiązane: US-015 (snapshoty FMS), EPIC-A.