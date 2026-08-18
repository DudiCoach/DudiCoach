---
id: US-025
title: Athlete Public Panel - Training Plan Display
role: zawodnik
priority: P1
estimate: M
status: Done
dependencies: [US-004, US-005, US-011]
epic: EPIC-B
design_required: true
created: 2026-04-24
updated: 2026-08-18
sprint: Sprint 3
---

# US-025 — Athlete Public Panel: Training Plan Display

## User Story

**Jako** zawodnik,
**chcę** widzieć swój aktualny plan treningowy na panelu publicznym,
**aby** mieć dostęp do tygodniowego harmonogramu ćwiczeń bez logowania.

## Acceptance Criteria (Gherkin)

### AC-1: Plan treningowy widoczny na panelu zawodnika

```gherkin
Zakładając, że posiadam aktywny kod share i wygenerowany plan treningowy
Kiedy otwieram panel /{shareCode}
Wtedy widzę sekcję z planem treningowym (nazwa, faza, tygodniowy przegląd)
```

### AC-2: Brak planu — pusty stan

```gherkin
Zakładając, że posiadam aktywny kod share ale nie mam jeszcze planu
Kiedy otwieram panel /{shareCode}
Wtedy widzę komunikat "Brak planu treningowego."
```

### AC-3: Nieaktywny / nieprawidłowy kod

```gherkin
Zakładając, że share_active = false lub kod nie istnieje
Kiedy wchodzę pod /{shareCode}
Wtedy otrzymuję stronę 404
```

## Definition of Done

- [x] Migration applied and reviewed
- [x] RLS / SECURITY DEFINER audited
- [x] Integration tests pass (plans-route.test.ts — 11/11)
- [x] TypeScript strict — no errors
- [x] ESLint clean — no warnings
- [x] Frontend component implemented
- [x] E2E test
- [x] Code review approved
- [x] Deployed

## Implementation Log

### Backend — 2026-04-24

Files created:
- `supabase/migrations/20260424120000_US-025_public_plan_rpc.sql` — SECURITY DEFINER RPC `get_latest_plan_by_share_code(char)`, grants to `anon` + `authenticated`
- `lib/types/plan-public.ts` — `PublicTrainingPlan` interface (sanitized, no `athlete_id`)
- `app/api/athlete/[shareCode]/plans/route.ts` — `GET /api/athlete/[shareCode]/plans`, public endpoint
- `tests/integration/athlete/plans-route.test.ts` — 11 integration tests, all passing

Files modified:
- `lib/supabase/database.types.ts` — added `get_latest_plan_by_share_code` to `Functions` map (manual update; regenerate with `supabase gen types` once migration is applied to local Supabase)
- `app/(athlete)/[shareCode]/page.tsx` — fixed `unknown` cast for `planData?.[0]` to `PublicTrainingPlan` (type narrowing from `Json` → `TrainingPlanJson`)

Checks:
- `npx tsc --noEmit` — PASS (0 errors)
- `npx eslint ... --max-warnings 0` — PASS (0 warnings)
- `npx vitest run tests/integration/athlete/plans-route.test.ts` — PASS (11/11)

Frontend files already present (authored by a prior agent pass):
- `components/athlete/PlanPublicSection.tsx` — read-only plan viewer
- `components/athlete/AthletePanel.tsx` — accepts `initialPlan` prop, renders `PlanPublicSection`
- `app/(athlete)/[shareCode]/page.tsx` — fetches three parallel RPCs

### G9 closeout — 2026-08-18

- Added `tests/e2e/US-025.spec.ts` — production smoke (fixture-gated, no codes committed):
  exact public shape, latest-plan selection, empty state, inactive/retired/malformed 404s,
  UI rendering + week navigation on desktop and mobile.
- Production run against `main@b7e9355`: 16 passed / 4 skipped by design / 0 failed.
- Endpoint latency (30 probes): p50 485ms, p99 732ms, 0 errors.
- Fixture cleanup verified; all fixture codes return 404 after the run.
- Evidence: `qa/e2e/US-025-report.md`, `reviews/US-025-review.md` (§ G9 closeout).
- Checks: lint PASS, `tsc --noEmit` PASS, vitest 447/447 PASS, `next build` PASS.
