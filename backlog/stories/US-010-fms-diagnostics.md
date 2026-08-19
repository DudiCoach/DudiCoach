---
id: US-010
title: Diagnostyka FMS - baza miesni + searchable dropdown
role: trener
priority: P1
estimate: XL
status: Done
dependencies: [US-002, US-003]
epic: EPIC-A
design_required: true
created: 2026-08-19
updated: 2026-08-19
sprint: Sprint 3 (Athlete Health Data)
merged_pr: 77
---

# US-010 — Diagnostyka FMS (bieżące znaleziska)

## User Story

**Jako** trener,
**chcę** rejestrować bieżące znaleziska diagnostyki FMS zawodnika (mięsień, strona, stopień, notatka),
**aby** śledzić dysfunkcje i mieć podstawę pod korekcyjne planowanie treningu oraz przyszłą historię snapshotów (US-015).

## Scope

- Aktywacja zakładki "Diagnostyka FMS" w edytorze zawodnika (`/athletes/<id>`).
- CRUD bieżących znalezisk: `athlete + muscle + side` = jeden bieżący rekord (unikalność wymuszona w bazie; konflikt → 409, aktualizacja tylko przez PATCH).
- Wersjonowany katalog 68 mięśni (Polska + Latin, region Góra/Dół/Stopa) jako stała TypeScript.
- Searchable dropdown mięśni (klawiatura), grupowanie znalezisk wg regionów, badge strony i stopnia, edycja inline z auto-save, usuwanie z potwierdzeniem.

## Non-goals (poza zakresem)

- Historia snapshotów i przywracanie — osobna story **US-015**.
- Widoczność FMS w panelu zawodnika (public) — decyzja modelowana w US-015.
- Realtime dla FMS.
- Przekazywanie FMS do kontekstu generowania planu AI — wymaga decyzji consent/health-data (athlete-context-system-design §10); osobna story po PR4.
- Diagnoza medyczna / automatyczne rekomendacje.

## Acceptance Criteria (Gherkin)

### AC-1: Zakładka Diagnostyka FMS aktywna

```gherkin
Zakładając, że jestem na /athletes/<id>
Wtedy zakładka "Diagnostyka FMS" jest aktywna (nie zablokowana)
Kiedy klikam "Diagnostyka FMS"
Wtedy widzę pusty stan "Brak zarejestrowanych znalezisk" oraz formularz dodawania
```

### AC-2: Searchable dropdown mięśni (Polska (Latin))

```gherkin
Kiedy otwieram dropdown mięśni
Wtedy widzę listę 68 mięśni w formacie "Nazwa polska (Latin)" pogrupowaną wg regionów (Góra / Dół / Stopa)
Kiedy wpisuję "naramienny" albo "deltoid"
Wtedy lista filtruje się po nazwie polskiej i łacińskiej
Kiedy wybieram mięsień klawiaturą (strzałki + Enter)
Wtedy pole wypełnia się wybranym mięśniem
```

### AC-3: Dodanie znaleziska

```gherkin
Zakładając, że wybrałem mięsień, stronę (Lewa/Prawa), stopień (słaby / bardzo słaby / dysfunkcja), datę i opcjonalną notatkę
Kiedy klikam "Dodaj znalezisko"
Wtedy znalezisko pojawia się na liście w grupie swojego regionu z badge strony i stopnia
I w bazie istnieje dokładnie jeden rekord dla (athlete, muscle, side)
```

### AC-4: Zduplikowane (athlete, muscle, side) → konflikt

```gherkin
Zakładając, że znalezisko (muscle, side) już istnieje dla zawodnika
Kiedy próbuję dodać drugie znalezisko dla tego samego mięśnia i strony
Wtedy widzę komunikat konfliktu "Znalezisko dla tego mięśnia i strony już istnieje" (HTTP 409)
I rekord nie jest podmieniany bez mojej wiedzy
```

### AC-5: Edycja inline z auto-save

```gherkin
Zakładając, że widzę znalezisko na liście
Kiedy zmieniam stopień, notatkę lub datę
Wtedy zmiana zapisuje się automatycznie (auto-save) i widzę status zapisu
I po odświeżeniu strony zmiana jest widoczna
```

### AC-6: Usuwanie z potwierdzeniem

```gherkin
Zakładając, że widzę znalezisko na liście
Kiedy klikam "Usuń"
Wtedy widzę dialog potwierdzenia
Kiedy potwierdzam
Wtedy znalezisko znika z listy i z bazy
```

### AC-7: Walidacja formularza

```gherkin
Kiedy próbuję dodać znalezisko bez mięśnia lub stopnia
Wtedy przycisk "Dodaj znalezisko" jest nieaktywny
I widzę komunikaty walidacji przy pustych polach
```

### AC-8: Bezpieczeństwo

```gherkin
Zakładając, że zawodnik należy do trenera A
Kiedy trener B lub anonim próbuje odczytać/zapisać znaleziska tego zawodnika (API)
Wtedy żądanie kończy się 401/403 (RLS: brak dostępu)
```

## Dane (podsumowanie, szczegóły w designie)

- Tabela `diagnostic_findings`: `id`, `athlete_id` (FK cascade), `muscle_key`, `side (left|right)`, `severity (weak|very_weak|dysfunction)`, `notes` (≤1000), `observed_at` (date), `created_at`, `updated_at`.
- UNIQUE `(athlete_id, muscle_key, side)`; index `(athlete_id, observed_at desc)`.
- RLS coach-owner tylko (wzorzec `injuries`); brak anon policy; brak public RPC.
- Katalog mięśni: `lib/constants/muscles.ts` (klucze snake_case stabilne, np. `anterior_deltoid`).

## Verification plan

- SQL gates (`tests/sql/us010-fms-gates.sql` wpięte w `verify-migrations.sh`): cross-coach deny, anon deny, unique, cascade, check constraints.
- Integration: routes CRUD + auth + 409 + 404 (mock Supabase).
- Unit: katalog mięśni (68, unikalność kluczy, formaty), Zod, badge/severity mapping, komponent (search, grupowanie, stany UI).
- E2E (env-gated, wzorzec US-011/US-012): pełny flow AC-1..AC-7 desktop + mobile.
- Pełne: lint, typecheck, vitest, build, SQL suite (3 fazy).

## References

- Spec: `docs/spec/original-spec.md` (DiagnosticFinding, Baza mięśni — 68 mięśni, sekcja Panel trenera).
- Wzorce: `US-011` (injuries: migracja + RLS + routes + tab), `US-012` (testy), ADR-0003 (auto-save), ADR-0002 (route handlers + tanstack query).
- Design: `docs/design/US-010-fms-diagnostics-design.md`.
- Powiązane: US-015 (historia snapshotów, zależność), EPIC-A.