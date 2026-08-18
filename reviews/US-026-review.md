---
story: US-026
title: Async AI plan generation via job table & polling
verdict: Approve
reviewer: code-reviewer
reviewed_at: 2026-08-18
lane: C
---

# Review — US-026: Async AI Plan Generation via Job Table & Polling

## Verdict: **Approve**

US-026 can be marked Done. The independent verification (14 ACs) found 6
material gaps; all were fixed in this branch and verified by tests, lint,
typecheck, full vitest (451 tests), `next build`, and the SQL suite. The
remaining AC deviations are documented decisions below.

## AC evidence

| AC | Status | Evidence |
|---|---|---|
| AC-1 | OK (documented deviation) | Returns **201** `{ data: { id, status: "queued" } }` (not 202 `{ jobId, status: "pending" }`). Decision: client reads `.id` (`lib/api/plans.ts:166`); 201 + explicit status is equally correct for resource creation. Recorded in story. |
| AC-2 | OK (documented deviation) | UI shows "W kolejce..." (queued) and "Generuję plan..." (processing) via `GeneratePlanButton`; copy strings in `pl.ts`, statuses mapped `pending→queued`. |
| AC-3 | OK | Worker persists the plan via `complete_plan_generation_job`, list invalidated (`planKeys.byAthlete`), row satisfies `trainingPlanJsonSchema`. Wording "5-7 ćwiczeń" outdated — per-week generation yields 1-4 exercises/day; story corrected. |
| AC-4 | OK (fixed) | Cadence 2s/3s/5s implemented. Polling **now stops at 180 s** (was continuing at 5 s forever; `refetchInterval` returns `false` past `POLL_TIMEOUT_MS`) + "Odśwież" one-shot refetch. Test updated to assert polling stops. |
| AC-5 | OK (documented deviation) | Single `error_code = plan_parse_or_validation_failed` (not `parse_error`/`validation_error`). Decision: keep one code; message sanitized via `mapPlanJobErrorMessage`. Recorded in story. |
| AC-6 | OK (fixed) | Retryable set `{500,502,503,529}` + **`Anthropic.APIConnectionTimeoutError` now retryable** (was failing permanently despite `provider_timeout` classification). New worker test covers the timeout→requeue path. |
| AC-7 | OK (fixed) | Stale-claim TTL **`CLAIM_LOCK_SECONDS = 180`** (was 120, below the 180 s design). Worker test asserts `p_lock_seconds: 180`. |
| AC-8 | OK | `FOR UPDATE SKIP LOCKED` claim race — exactly one worker wins; tested. |
| AC-9 | OK | Crash-before-complete leaves no extra `training_plans` row; stale-claim sweep + reclaim; one plan at the end. |
| AC-10 | OK | RLS isolation coach A/B (404 cross-coach + zero direct rows); anon sees nothing. |
| AC-11 | OK | `app/api/athlete/[shareCode]/plans/route.ts` diff empty; public endpoint never touches `plan_generation_jobs`. |
| AC-12 | OK (fixed) | Both worker 401 paths (GET cron `CRON_SECRET`, POST `PLAN_JOBS_WORKER_SECRET`) now return **empty body** 401 (were leaking `{ error: "Unauthorized" }`). Tests assert `response.text() === ""`. |
| AC-13 | OK (fixed) | **Rate limit added** to `POST /api/coach/plans/jobs` via `checkRateLimit(user.id)` (same in-memory window as sync route): 429 + body "Zbyt wiele prób. Poczekaj chwilę." + `Retry-After`. New route test covers 429. |
| AC-14 | OK (fixed) | **Feature flag implemented**: `NEXT_PUBLIC_PLAN_GENERATION_MODE` (`sync` → legacy US-005 flow via `generatePlan`; `async` → job flow; default `async`). `PlanTabContent` branches at render time; `.env.example` documents it. Rollback = env flip + redeploy, no DB migration. New component test covers sync mode. |

## Per-file verdict

| File | Status | Notes |
|---|---|---|
| `supabase/migrations/20260428130000_US-026_plan_generation_jobs.sql` | Approve | Enum + table + indexes + RLS (SELECT/INSERT) + RPCs; `SECURITY DEFINER` + `set search_path = public`; `coach_id` consistency covered by RLS `WITH CHECK`; `max_attempts` default 3 (design said 2 — recorded decision). |
| `supabase/migrations/20260507120000_RPC_privilege_hardening.sql` | Approve | EXECUTE restricted to `service_role`. |
| `supabase/migrations/20260518120000_fix_complete_plan_generation_job_status_ambiguity.sql` | Approve | Deterministic single-row update in `complete_plan_generation_job`. |
| `app/api/coach/plans/jobs/route.ts` | Approve | Auth + **rate limit** + schema validation + INSERT + 201; 409 duplicate; sanitized 500s. |
| `app/api/coach/plans/jobs/[jobId]/route.ts` | Approve | RLS-gated SELECT; 404 cross-coach; sanitized status row. |
| `app/api/internal/plans/jobs/run/route.ts` | Approve | **TTL 180 s**; timeout retryable; **empty-body 401**; `maxDuration = 180`; `secureEquals` timing-safe compare; metadata logs omit prompt inputs. |
| `lib/api/plan-jobs.ts` | Approve | Types, select list, `mapPlanJobErrorMessage`, prompt-input schema. |
| `lib/api/plans.ts` | Approve | `startPlanGenerationJob`, `fetchPlanGenerationJobStatus`, `generatePlan` (sync fallback), typed errors (`RateLimitError`, `DuplicateActiveJobError`, ...). |
| `components/coach/PlanTabContent.tsx` | Approve | Job state machine; cadence polling; stop-at-180 s; sync-mode branch behind flag; `onSettled` invalidation. |
| `components/coach/PlanGenerateSection.tsx` / `GeneratePlanButton.tsx` | Approve | State-driven copy "W kolejce..."/"Generuję plan..."; disabled while busy. |
| `lib/i18n/pl.ts` | Approve | All job/queue/poll keys present and consumed. |
| `vercel.json` | Approve | Cron `* * * * *` on `/api/internal/plans/jobs/run`. |
| `tests/integration/coach/plan-jobs-routes.test.ts` | Approve | 11 tests incl. new 429 rate-limit case. |
| `tests/integration/internal/plan-jobs-worker-route.test.ts` | Approve | 12 tests incl. empty-body 401s, `p_lock_seconds: 180`, timeout-retryable requeue. |
| `tests/unit/components/coach/PlanTabContent.test.tsx` | Approve | 9 tests incl. polling-stop-at-180 s and sync-mode flag. |
| `.env.example` | Approve | `NEXT_PUBLIC_PLAN_GENERATION_MODE=async` documented. |

## Blocking issues

None (all verification findings remediated in this branch).

## Non-blocking observations / recorded deviations

1. **AC-1**: 201 + `{ data: { id, status: "queued" } }` instead of 202 +
   `{ jobId, status: "pending" }` — client-compatible, recorded in story.
2. **AC-5**: single `plan_parse_or_validation_failed` error code; no split
   into `parse_error`/`validation_error`.
3. **max_attempts = 3** (column default and insert) vs design's 2 — more
   tolerance, acceptable; RPC `p_max_attempts` respected.
4. **DoD**: `lib/ai/error-classification.ts` not extracted — classification
   lives in the worker route (`classifyErrorClass`); acceptable at current
   scale, extraction is a refactor follow-up.
5. **No `tests/e2e/US-026*.spec.ts`** — integration coverage is thorough;
   E2E with real AI calls requires opt-in env and is deferred (G9 item).
6. **Sync route gating**: the flag is frontend-driven only; the sync route
   remains callable regardless of mode (documented; keeps rollback path
   simple). Story DoD line "POST /api/athletes/[id]/plans za feature
   flagiem" interpreted as frontend gating.

## Security checklist (verified)

- [x] RPCs `SECURITY DEFINER`, `set search_path = public`, EXECUTE only to `service_role`
- [x] RLS: coach A cannot see coach B jobs; anon sees no rows
- [x] Worker authenticated by shared secrets (`CRON_SECRET`, `PLAN_JOBS_WORKER_SECRET`), timing-safe compare, empty-body 401
- [x] No `prompt_inputs` / share codes / raw Claude responses in worker logs
- [x] Rate limit on job creation (429 + Retry-After)
- [x] `max_tokens` capped via `resolvePlanMaxTokens`; model config server-side
- [x] No service-role key in client code; admin client server-side only
- [x] SQL suite (migrations + security/behavior/gates) — 3 phases ALL PASS
