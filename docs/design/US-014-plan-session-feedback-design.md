---
id: US-014-design
story: US-014
title: Athlete text feedback per plan session/day
status: proposed
created: 2026-05-21
updated: 2026-05-21
lane: C
related_adrs:
  - docs/adr/0005-anonymous-athlete-access-via-share-code.md
  - docs/adr/0007-async-plan-generation-via-job-table.md
---

# US-014 Design - Athlete text feedback per plan session/day

## 0. Status pracy / summary

- Design scope is a minimal MVP for text feedback attached to one plan day/session.
- Weekly UI already exists and remains in place.
- MVP adds a new feedback write/read path without changing AI generation or plan schema.
- Claude G2 verdict constraints (M1-M9) are incorporated in this document.

---

## 1. Problem statement

Current athlete panel exposes plan content read-only. There is no safe way for athlete-side public share users to send structured feedback tied to a concrete session/day and visible to coach.

This blocks feedback loop use cases and makes follow-up plan adjustments manual/off-platform.

---

## 2. Scope and out-of-scope

### In scope (MVP)

- Text feedback for a specific generated plan day:
  - attachment unit: `plan_id + week_number + day_number`
- Athlete can create/update own feedback through public share flow.
- Coach can read that feedback in coach plan UI context.
- Lane C backend safety model (RLS + SECURITY DEFINER RPC + explicit grants).
- Minimal UI additions only in PR2 (no weekly layout rebuild).

### Out of scope

- Audio/video feedback.
- Exercise-level feedback and per-exercise completion tracking.
- Exercise library modeling.
- AI worker/prompt changes.
- Async job queue behavior changes.
- Plan schema redesign.
- Stripe/Vercel/CI/branch protection changes.

---

## 3. Current architecture evidence

### 3.1 Weekly UI already exists

- Coach: `components/coach/PlanViewer.tsx` -> `WeekNavigation` + `WeekView` + `DayCard` + `ExerciseRow`
- Athlete public: `components/athlete/PlanPublicSection.tsx` reuses same weekly rendering components.
- No weekly-tabs rebuild is needed.

### 3.2 `plan_json` shape

Source: `lib/validation/training-plan.ts`

- `weeks[]` length 4
- `week.weekNumber` is stable (1..4)
- `day.dayNumber` is stable (1..7)
- `day.exercises[]` has no stable `exercise_id` today

### 3.3 Data and RPC boundary

- Plans stored in `public.training_plans` (US-005 migration), immutable row model.
- Public read uses SECURITY DEFINER RPC by share code:
  - `get_athlete_by_share_code`
  - `get_active_injuries_by_share_code`
  - `get_latest_plan_by_share_code`
- RPC privilege hardening baseline exists (PR #49): no implicit PUBLIC execute for these functions.

---

## 4. Product decision

MVP feedback attachment unit is **session/day level** (`plan_id + week_number + day_number`).

Rationale:

- More actionable than whole-plan or whole-week text.
- Smaller and safer than exercise-level in v1 because exercises currently lack stable identifiers.
- Preserves forward path to exercise-level entities later.

---

## 5. Database model

## 5.1 New table

`public.plan_session_feedback`

Proposed columns:

- `id uuid primary key default gen_random_uuid()`
- `plan_id uuid not null references public.training_plans(id) on delete cascade`
- `athlete_id uuid not null references public.athletes(id) on delete cascade`  **(M1)**
- `week_number smallint not null check (week_number between 1 and 4)`
- `day_number smallint not null check (day_number between 1 and 7)`
- `feedback_text text not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints/indexes:

- `unique(plan_id, week_number, day_number)` (one row per session/day)
- `check (length(feedback_text) between 1 and 2000)`  **(M2)**
- index on `(athlete_id, created_at desc)` for coach-side fetch patterns
- index on `(plan_id, week_number, day_number)` for fast point read

Trigger:

- `updated_at` via `extensions.moddatetime(updated_at)` pattern (same style as existing tables).

## 5.2 Denormalized `athlete_id` consistency (M1)

Add trigger or BEFORE INSERT/UPDATE check that enforces:

`NEW.athlete_id = (select athlete_id from public.training_plans where id = NEW.plan_id)`

If mismatch, raise exception and block write.

Purpose:

- Safer and faster policy predicates.
- Prevents cross-athlete corruption if caller passes inconsistent IDs.

---

## 6. RLS model

RLS enabled on `plan_session_feedback`.

Policies:

- Coach SELECT own:
  - allow `authenticated` select where
  - `athlete_id in (select id from public.athletes where coach_id = auth.uid())`
- No anon direct table access policy.
- No client direct insert/update/delete for anon or authenticated through table API.

Write path for athlete public share remains RPC-only via SECURITY DEFINER function.

---

## 7. RPC model (exact signatures and grants)

## 7.1 Upsert write RPC

```sql
create or replace function public.upsert_plan_session_feedback(
  p_code char(6),
  p_plan_id uuid,
  p_week_number smallint,
  p_day_number smallint,
  p_feedback_text text
)
returns table (
  id uuid,
  plan_id uuid,
  athlete_id uuid,
  week_number smallint,
  day_number smallint,
  feedback_text text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
```

Required logic:

- Normalize code with `upper(p_code)`  **(M8)**.
- Verify active share mapping (`share_code`, `share_active=true`).
- Verify `p_plan_id` belongs to that athlete.
- Verify `(p_week_number, p_day_number)` exists in `training_plans.plan_json` for this plan  **(M9)**.
- Sanitize feedback text (section 9).
- Upsert by unique key `(plan_id, week_number, day_number)`.
- Preserve `athlete_id` consistency via trigger/check (section 5.2).

## 7.2 Public read RPC by share code

```sql
create or replace function public.get_plan_session_feedback_by_share_code(
  p_code char(6),
  p_plan_id uuid,
  p_week_number smallint,
  p_day_number smallint
)
returns table (
  id uuid,
  plan_id uuid,
  athlete_id uuid,
  week_number smallint,
  day_number smallint,
  feedback_text text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
```

Required logic:

- `upper(p_code)` normalization  **(M8)**.
- Enforce active share mapping.
- Return only row for that mapped athlete and provided plan/day tuple.

## 7.3 Grants (M6 + PR #49 discipline)

For both RPCs:

- `revoke all ... from public`
- explicit `revoke execute ... from public`
- grant execute only where needed:
  - `upsert_plan_session_feedback`: `anon`, `authenticated`
  - `get_plan_session_feedback_by_share_code`: `anon`, `authenticated`

No implicit PUBLIC execute.
No service role exposure to client paths.

---

## 8. API route model

Backend PR1 route plan (minimal):

- `POST /api/athlete/[shareCode]/plans/[planId]/feedback`
  - body: `{ weekNumber, dayNumber, feedbackText }`
  - calls `upsert_plan_session_feedback`

- `GET /api/athlete/[shareCode]/plans/[planId]/feedback?weekNumber=&dayNumber=`
  - calls `get_plan_session_feedback_by_share_code`

- `GET /api/athletes/[id]/plans/[planId]/feedback?weekNumber=&dayNumber=`
  - coach-auth path, either table read (RLS) or dedicated coach-safe query abstraction.

No direct client write to table endpoint.

---

## 9. Validation and sanitisation

## 9.1 Length and shape (M2)

- DB constraint: `length(feedback_text) between 1 and 2000`
- Matching zod validation in route layer:
  - `feedbackText: z.string().min(1).max(2000)`

## 9.2 Sanitisation rules (M3)

Server-side before RPC write:

1. `trim()`
2. reject all-whitespace input
3. optionally strip control chars `\x00-\x1F` except `\n` and `\t`
4. persist sanitized plain text only

## 9.3 Existence validation (M9)

Before upsert, verify that requested `week_number/day_number` exists in the target plan JSON.
Reject non-existent plan days with deterministic validation error.

---

## 10. Plain-text rendering policy (PR2 UI) (M4)

- Render feedback as plain text only.
- Do not use `dangerouslySetInnerHTML`.
- Use React default escaping behavior.
- Preserve line breaks with `whitespace-pre-wrap`.
- Add UI test asserting `"<script>alert(1)</script>"` is displayed as escaped text, not executed HTML.

---

## 11. Abuse controls / rate limit posture

MVP posture (M7):

- Accept current Supabase/app baseline.
- Unique tuple constraint limits write amplification for same day.
- Monitor abuse signals in logs/metrics.
- Add app-layer rate limiting in follow-up if abuse appears.

---

## 12. Logging and privacy rules (M5)

Must not log:

- `feedback_text`
- athlete private payloads
- prompt payloads
- share codes
- tokens/cookies/JWTs

Allowed logging:

- sanitized error code/class
- request/row identifiers (UUIDs) when needed
- counters/statuses only

---

## 13. Security/privacy considerations

- Public write capability is security-sensitive; G7 mandatory.
- SECURITY DEFINER functions must pin `search_path = public`.
- Least privilege grants (no PUBLIC execute).
- Share-code trust boundary must be explicit and tested.
- Cross-athlete writes must be impossible by plan ownership + athlete consistency check.

---

## 14. Test plan

PR1 backend tests:

- Integration tests for new athlete feedback routes:
  - valid code/day upsert success
  - invalid/inactive code rejected
  - day not in plan JSON rejected (M9)
  - all-whitespace rejected (M3)
  - >2000 chars rejected (M2)
  - cross-athlete plan misuse rejected
- SQL/RPC tests:
  - grants matrix for both RPCs (no PUBLIC)
  - SECURITY DEFINER + search_path assertions
  - athlete_id consistency trigger enforcement (M1)

PR2 UI tests:

- plain-text safe rendering (`<script>` escaped)
- line-break rendering with `whitespace-pre-wrap`
- athlete can submit/edit day feedback
- coach can view same day feedback

---

## 15. Runtime smoke plan (G9)

After deployment:

1. Public athlete valid share code writes day feedback -> success.
2. Same day feedback update overwrites prior row (same tuple).
3. Coach sees updated text for that plan day.
4. Invalid share code write denied.
5. Non-existent day write denied.
6. Verify no sensitive text leaked in logs.

---

## 16. Future exercise video compatibility

MVP design intentionally does not block future model:

- Keep feedback table keyed to session/day now.
- Future extension may add:
  - `exercise_library`
  - stable `exercise_id` references
  - optional per-exercise feedback table
  - video metadata columns referencing object-storage/CDN URLs (not binary in DB)

Do not store video blobs in Postgres.

---

## 17. PR split

PR1 (Lane C backend):

- migration(s), RLS, RPCs, route handlers, backend tests, G7 + G8 + G9 checklist.

PR2 (UI):

- athlete input and coach read display in existing weekly UI + UI tests.

---

## 18. Acceptance criteria

1. Athlete can submit/edit text feedback for one plan day (`plan_id+week+day`).
2. Coach can view that feedback for same day.
3. Validation/sanitization rules enforced server-side and DB-side (M2/M3/M9).
4. No HTML injection rendering path in UI (M4).
5. SECURITY DEFINER/search_path/grants satisfy least privilege (M6).
6. No public share/RPC privilege regression vs PR #49 baseline.
7. Future exercise video path remains unblocked.

---

## 19. Risks

- Public write path abuse/spam if volume increases.
- Incorrect plan-day existence validation can reject valid submissions.
- SECURITY DEFINER misuse risk if grants/search_path drift.
- Future exercise-level migration requires careful backfill/compat strategy.

---

## 20. Rollback plan

If PR1 introduces risk:

1. Revoke execute on new feedback RPCs for `anon/authenticated`.
2. Disable feedback routes at app layer.
3. Keep table for audit if needed, or drop in controlled rollback migration.
4. Restore prior read-only athlete plan behavior.

---

## 21. Required gates

- G1 Planning: this design
- G2 Architecture: approved with M1-M9 incorporated
- G3 Implementation: PR1 then PR2
- G5 QA: integration + unit pass
- G6 Independent review: required before merge
- G7 Security review: mandatory
- G8 Runtime/performance review: mandatory (public endpoint write path)
- G9 Runtime smoke: mandatory before closeout
