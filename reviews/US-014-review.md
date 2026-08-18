---
story: US-014
title: Athlete text feedback per plan session/day
verdict: Approve
reviewer: code-reviewer
reviewed_at: 2026-08-18
lane: C
---

# Review — US-014: Athlete Text Feedback per Plan Session/Day

## Verdict: **Approve**

US-014 can be marked Done. All 10 MVP acceptance criteria and the lane-C
security requirements are delivered. The two residuals from the independent
verification (story AC-5 wording; missing automated SQL/RPC gates) are
addressed: AC-5 wording is corrected in the story, and the RPC gate tests
were added in this branch (`tests/sql/us014-feedback-rpc-gates.sql`, wired
into `scripts/verify-migrations.sh` — all three phases PASS).

## Summary

- Public write/read flow is fully RPC-gated by active `share_code`
  (`upsert_plan_session_feedback`, `get_plan_session_feedback_by_share_code`):
  `SECURITY DEFINER` + `set search_path = public`, explicit `revoke ... from
  public/anon/authenticated` followed by narrow `grant execute` to
  `anon`/`authenticated`.
- Sanitized "not found / not authorized" behavior: inactive code,
  cross-athlete plan, or unknown plan return **zero rows** (no row leak, no
  row-enumeration oracle); invalid week/day and missing plan days raise
  22023 with fixed messages.
- Feedback validation at both layers: RPC-side normalize (strip control
  chars except TAB/LF, trim) + empty/length gates, DB check constraint
  `plan_session_feedback_feedback_text_valid` (NULL or trimmed 1..2000), zod
  min/max in the route.
- `athlete_id` consistency enforced by trigger
  (`enforce_plan_session_feedback_athlete_consistency`, raises when
  `plan_id` missing or owned by another athlete).
- Share-code normalization (`upper(p_code)`) verified in both RPCs.
- PR #68 (athlete session outcome schema) replaced the legacy feedback
  column semantics; story AC-5 wording updated to reflect the current
  constraint.

## Per-file verdict

| File | Status | Notes |
|---|---|---|
| `supabase/migrations/20260522120000_US-014_plan_session_feedback.sql` | Approve | Table + trigger + both RPCs; grant matrix to anon/authenticated only; `security definer`; `set search_path = public`. |
| `supabase/migrations/20260527123000_fix_us014_upsert_plan_session_feedback_ambiguity.sql` | Approve | Fixes `ON CONFLICT` ambiguity (plan_id, week, day) on upsert. |
| `app/api/athlete/[shareCode]/plan-feedback/route.ts` | Approve | Server-side zod (min 1, max 2000), share-code regex gate, sanitized 404/400 behavior. |
| `app/api/coach/athletes/[id]/plan-feedback/route.ts` | Approve | Coach read path via RLS-gated select; 400 vs 404 documented note. |
| `lib/api/plan-feedback.ts` | Approve | `feedback_text` typed `string \| null`; no UI-facing raw text leakage. |
| `components/athlete/PublicDayFeedbackSection.tsx` | Approve | Plain-text rendering, React escaping, `whitespace-pre-wrap`, no `dangerouslySetInnerHTML`. |
| `components/coach/PlanViewer.tsx` (week/day feedback) | Approve | Coach visibility of athlete feedback per day. |
| `tests/integration/athlete/plan-feedback-route.test.ts` | Approve | Valid upsert, inactive code, non-existent day, cross-athlete, length/sanitization. |
| `tests/integration/coach/plan-feedback-route.test.ts` | Approve | Coach read + 404 cross-coach behavior. |
| `tests/unit/components/athlete/PlanPublicSection.test.tsx` | Approve | Escaped `<script>` rendering, line breaks, submit/edit states. |
| `tests/sql/us014-feedback-rpc-gates.sql` | Approve | **Added in this branch**: inactive code (upsert+get zero rows), week/day not in plan (22023), invalid week/day, empty/overlong feedback, cross-athlete upsert/get zero rows, normalization, idempotent upsert, read roundtrip. Wired into `scripts/verify-migrations.sh` Phase 1 + 2b — ALL PASS. |

## Blocking issues

None.

## Non-blocking observations

1. **Story AC-5 wording drift** — story described a `length(feedback_text)
   between 1 and 2000` check; the actual (post-PR-#68) constraint is
   `plan_session_feedback_feedback_text_valid` (NULL or trimmed 1..2000).
   Story wording corrected in this branch.
2. **GET 400 vs 404** — coach read route returns 400 for a malformed
   day/week rather than 404; documented in the route, accepted.
3. **Security note** — `feedback_text` is never logged; share codes appear
   only in RPC parameters (psql/edge logs may capture them at the proxy
   layer; out of scope, matching US-025 practice).

## Security checklist (verified)

- [x] Public write only via SECURITY DEFINER RPC gated by active `share_code`
- [x] `set search_path = public` on both RPCs
- [x] `revoke all` from `public`/`anon`/`authenticated`, then narrow
      `grant execute` to `anon` + `authenticated`
- [x] No direct anon table write (no INSERT/UPDATE grants on
      `plan_session_feedback`)
- [x] Cross-athlete isolation: sanitized zero rows (no enumeration oracle)
- [x] `athlete_id` consistency trigger enforced at DB level
- [x] Share-code normalization `upper(p_code)` in both RPCs
- [x] Feedback text sanitized server-side (control chars stripped, trimmed)
- [x] UI renders plain text with React escaping (script-injection test green)
- [x] No secrets, cookies, or tokens in logs
