# Training Planner AI - Backlog

**Owner**: backlog-manager agent
**Last updated**: 2026-08-18
**Sprint**: Sprint 2 (Hardening + Athlete Data)

## Status Legend

| Status | Meaning |
|---|---|
| `Draft` | Story being written |
| `Ready` | DoR met, ready to pick up |
| `InDev` | Developer implementing |
| `InDevTests` | qa-dev running unit/integration tests |
| `InE2E` | qa-test running Playwright on preview |
| `InDeploy` | devops promoting to prod |
| `InReview` | code-reviewer doing final review |
| `Done` | Shipped |
| `Rework` | Bounced back - needs fix |

## Completed — Sprint 1 (closed 2026-04-16)

| ID | Title | Epic | Priority | Estimate | Status | Notes |
|---|---|---|---|---|---|---|
| US-001 | Logowanie trenera do panelu | EPIC-A | P0 | S | Done | Review Approve 2026-04-10; preview E2E pass 2026-04-16 |
| US-002 | Backend CRUD zawodnika | EPIC-A | P0 | M | Done | Review Approve 2026-04-10; preview E2E pass 2026-04-16 |
| US-003 | Frontend lista + edycja zawodnika z auto-save | EPIC-A | P0 | M | Done | Review Approve 2026-04-15; preview E2E pass 2026-04-16 |
| US-004 | Share code + panel zawodnika + real-time | EPIC-C | P0 | L | Done | Review Approve 2026-04-15; preview E2E pass 2026-04-16 |
| US-005 | Generowanie planu AI przez Claude | EPIC-B | P0 | L | Done | Review Approve 2026-04-15; preview E2E pass 2026-04-16 |

## Current Sprint — Sprint 2 (Hardening + Athlete Data)

| ID | Title | Epic | Priority | Estimate | Status | Notes |
|---|---|---|---|---|---|---|
| US-020 | Unauth API routes — 401 zamiast 500 | EPIC-A | P2 | S | Done | Review Approve 2026-04-20; impl 7c1e390 |
| US-019 | Dashboard hydration - initialData w useAthletes query | EPIC-A | P2 | XS | Done | Review Approve 2026-04-20; impl 52af115 |
| US-011 | Kontuzje zawodnika - lista z severity | EPIC-A | P1 | M | Done | Final credentialed preview/staging E2E: `4/4 passed` (2026-04-24); E2E/runtime closed |
| US-012 | Testy sprawnosciowe - dynamiczne per sport | EPIC-A | P1 | M | Done | Final credentialed preview/staging E2E: `8/8 passed` (2026-04-24); E2E/runtime closed |
| US-025 | Panel zawodnika - wyswietlanie planu treningowego | EPIC-B | P1 | M | Done | PR #30 + smoke #31; production E2E 16/4/0 (16 passed, 4 skipped by design) + G9 2026-08-18 |

## Operational Notes (2026-04-15)

- PR #5 (hotfix) is merged to `main` as `6762f5c`; production `/` and `/login` now return 200.
- PR #6 (draft): US-003/US-004/US-005 bundle is open with working preview and updated E2E specs.

## Operational Notes (2026-04-16)

- Full E2E suite executed locally with auth credentials: `22 passed`, `2 skipped` (US-005 AI opt-in), `0 failed`.
- US-003 auto-save race in E2E was stabilized by waiting for persisted API snapshot before back navigation.
- Full E2E suite executed on PR #6 preview after env/redeploy: `22 passed`, `2 skipped`, `0 failed`.
- US-011: dedicated Playwright spec added (`tests/e2e/US-011.spec.ts`); local run result `0 passed`, `4 skipped`, `0 failed` due missing `E2E_COACH_EMAIL` / `E2E_COACH_PASSWORD`.

## Operational Notes (2026-08-18)

- US-025 closed: production E2E smoke passed (16 passed / 0 failed, desktop + mobile,
  `main@b7e9355`) — evidence `qa/e2e/US-025-report.md`; story status → Done.
- US-014 (session feedback) and US-026 (async plan generation) are implemented and merged
  (US-014: PRs #58/#60/#61/#62; US-026: PRs #39-#48). **Closed 2026-08-18**: independent
  verification performed, fixes shipped in `chore/us-014-us-026-reconcile`, review artifacts
  written (`reviews/US-014-review.md`, `reviews/US-026-review.md`), stories → Done, and
  US-014 RPC gate tests added (`tests/sql/us014-feedback-rpc-gates.sql`, 3 SQL phases ALL PASS).

## Operational Notes (2026-08-19)

- **Security incident (P0)**: PR #69 closed without merge — committed a database credential
  (Postgres, `peaklab` instance) in `.opencode/skills/supabase-cpet-monitor/SKILL.md`.
  Full-ref scan: credential present only in the 2 PR #69 commits. Incident record:
  `docs/security/incident-2026-08-19-pr69-credential-exposure.md`. Rotation of the
  credential is a pending user action; GitHub sensitive-data removal requested.
- Repository hygiene: stale branches removed (local + remote); only `main` remains;
  worktree on `main`; stash dropped (its US-011/US-012 E2E stabilizations were already
  present on `main` in newer form).
- OpenCode enablement moved to a minimal replacement PR (config only), separate from
  skills; no reuse of PR #69 commits.

## Backlog - v1.1 (post-MVP)

| ID | Title | Epic | Priority | Estimate | Status |
|---|---|---|---|---|---|
| US-010 | Diagnostyka FMS - baza miesni + searchable dropdown | EPIC-A | P1 | XL | Ready | story `backlog/stories/US-010-fms-diagnostics.md` + design `docs/design/US-010-fms-diagnostics-design.md` (2026-08-19, G2 accepted) |
| ~~US-011~~ | ~~Kontuzje zawodnika~~ | — | — | — | → Sprint 2 |
| ~~US-012~~ | ~~Testy sprawnościowe~~ | — | — | — | → Sprint 2 |
| US-013 | Progresje obciazen - tracker z wykresem | EPIC-A | P1 | L | Ready | story `backlog/stories/US-013-load-progressions.md` + design `docs/design/US-013-load-progressions-design.md` (2026-08-19, G2 accepted) |
| US-014 | Checkbox done + notatki zawodnika per cwiczenie | EPIC-C | P1 | M | Done | PRs #58/#60/#61/#62; reviews/US-014-review.md; RPC gate SQL tests wired (2026-08-18) |
| US-026 | Async AI plan generation via job table & polling | EPIC-B | P0 | L | Done | PRs #39-#48; reviews/US-026-review.md; fixes in chore/us-014-us-026-reconcile (2026-08-18) |
| US-015 | Historia snapshotow diagnostyki FMS | EPIC-A | P1 | M | Draft |
| US-016 | Export planu do PDF | EPIC-B | P1 | S | Draft |
| US-017 | Wiele planow per zawodnik z historia | EPIC-B | P1 | M | Draft |
| US-018 | Podsumowanie cyklu (wyniki + notatki trenera) | EPIC-B | P1 | S | Draft |
| ~~US-019~~ | ~~Dashboard hydration~~ | — | — | — | → Sprint 2 |
| ~~US-020~~ | ~~Unauth API routes~~ | — | — | — | → Sprint 2 |

## Backlog - v1.2+ (nice-to-have)

| ID | Title | Epic | Priority |
|---|---|---|---|
| US-021 | Galeria wideo cwiczen | EPIC-B | P2 |
| US-022 | Raportowanie RPE i bolu przez zawodnika | EPIC-C | P2 |
| US-023 | Progresje AI-rekomendowane na bazie feedbacku | EPIC-B | P2 |
| US-024 | Template'y planow (duplikacja) | EPIC-B | P2 |

## Epics

- **EPIC-A**: Zarzadzanie zawodnikami - `epics/EPIC-A-athlete-mgmt.md`
- **EPIC-B**: Generowanie planow AI - `epics/EPIC-B-plan-generation.md`
- **EPIC-C**: Udostepnianie i real-time sync - `epics/EPIC-C-realtime-sync.md`

## Workflow Reminder

Every story must traverse all 6 SDLC stages:
1. Backlog -> 2. Production -> 3. Dev tests -> 4. Test-env tests -> 5. Deploy -> 6. Review -> **Done**

Any story bounced back gets `status: Rework`.
