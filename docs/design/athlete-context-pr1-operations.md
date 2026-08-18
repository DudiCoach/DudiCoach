# Athlete Context PR1 — Operations (rollout / monitoring / rollback)

Companion to `docs/design/athlete-context-system-design.md` (§10 Verification And G9, §11 Rollback Strategy).
Applies to PR #68 (`codex/athlete-session-outcome-schema`).

## 1. Scope

PR1 ships two migrations and `lib/api/plan-feedback.ts` changes:

| File | Purpose |
| --- | --- |
| `supabase/migrations/20260727120000_athlete_session_outcome_schema.sql` | Pre-checks, add 7 nullable outcome columns, drop legacy check + NOT NULL on `feedback_text`, add 3 NOT VALID constraints, date trigger + helper, context partial index, revoke helper ACL from public, post-checks. Single transaction. |
| `supabase/migrations/20260727120001_athlete_session_outcome_validate.sql` | `VALIDATE CONSTRAINT` x3 with asserts, in a separate transaction to bound the ACCESS EXCLUSIVE window. |
| `lib/api/plan-feedback.ts`, `lib/supabase/database.types.ts` | RPC payload + types already accept the outcome fields. |

The split into two files means the constraints are validated in a second,
short, non-blocking-by-design step; the first migration still holds an
ACCESS EXCLUSIVE lock only for its own duration (small table, additive
columns, no backfill). The first migration takes the table lock as its
first statement, so the legacy-row pre-check cannot observe a snapshot
that a concurrent direct-RPC write could later invalidate.

## 2. Rollout

1. Merge PR #68. Supabase production receives the two migrations in order.
2. Verify production schema state (G9, commands below).
3. Regenerate `lib/supabase/database.types.ts` against the production project
   (`npx supabase gen types typescript --project-id qpsgpfnqlbbrvawjeeaj`) and
   confirm `feedback_text: string | null` plus the seven outcome columns.
   Requires `SUPABASE_ACCESS_TOKEN` (owner-only; until then the committed
   types, generated from the same schema shape, remain the source).
4. Deploy the Vercel app. No app runtime depends on the new columns yet
   (PR2/PR3 consume them), so app and DB can ship in either order.

### Pre-merge gates (evidence already collected)

- `scripts/verify-migrations.sh` — all phases pass on a local stack:
  Phase 1 clean replay of all 19 migrations, security assertions (RLS, ACL,
  trigger, index, RPC surface unchanged), full accept/reject behavior matrix.
  Phase 2a upgrade pre-check rejects a whitespace-only legacy row.
  Phase 2b upgrade replay on a 17-migration DB with legacy rows, then full
  security + behavior matrix + legacy-preservation asserts.
- Same suite green in CI (`supabase-db` job, ~4 min) on every PR/push.
- `npm run lint`, `npm run typecheck`, `npx vitest run` (447 tests),
  `npm run build` — all green on the PR branch.
- Supabase Preview: blocked without `SUPABASE_ACCESS_TOKEN` (documented
  residual; local-stack replay covers the same SQL deterministically).

### Rollout preparation

- Before merging, bound the migration's ACCESS EXCLUSIVE window on the
  production table: run the pre-check count query read-only and time it
  (it is the dominant lock cost; the count query is the SELECT in
  `20260727120000`'s first DO block):
  `explain analyze select count(*) from public.plan_session_feedback psf where psf.feedback_text is null or psf.feedback_text !~ '[^[:space:]]' or length(regexp_replace(psf.feedback_text, '^[[:space:]]+|[[:space:]]+$', '', 'g')) not between 1 and 2000;`
- Plan a maintenance window if that scan takes longer than the allowed write
  pause (expected: seconds at realistic table sizes).

## 3. G9 production verification (post-merge, before closeout)

Run against the production project (owner/`postgres` role):

```sql
-- migration version present
select * from supabase_migrations.schema_migrations
where version in ('20260727120000', '20260727120001');

-- constraints exist and are validated
select conname, contype, convalidated
from pg_constraint
where conrelid = 'public.plan_session_feedback'::regclass
  and conname like 'plan_session_feedback_%';

-- new columns present, nullable, no default
select column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'plan_session_feedback'
  and column_name in ('session_date','session_status','session_rpe',
    'wellbeing','pain_score','pain_location','pain_side');

-- feedback_text nullable again, legacy constraint gone
select is_nullable from information_schema.columns
where table_schema='public' and table_name='plan_session_feedback'
  and column_name='feedback_text';

-- trigger enabled, helper not callable by anon/authenticated
select tgname, tgenabled from pg_trigger
where tgrelid='public.plan_session_feedback'::regclass
  and tgname='plan_session_feedback_session_date_not_future';
select has_function_privilege('anon',
  'public.enforce_plan_session_feedback_session_date_not_future()', 'EXECUTE'),
       has_function_privilege('authenticated',
  'public.enforce_plan_session_feedback_session_date_not_future()', 'EXECUTE');
-- both must be false

-- context index
select indexdef from pg_indexes
where schemaname='public' and tablename='plan_session_feedback'
  and indexname='idx_plan_session_feedback_athlete_session_date';
```

Re-smoke the existing text feedback add/edit/read paths (public RPC
`upsert_plan_session_feedback` text-only and coach display) without logging
feedback content.

During the rollout itself, enable `\timing` for the two migration files to
confirm bounded duration, especially `20260727120001` (the VALIDATE scan).
If validation ever fails, the constraints remain NOT VALID (enforced on new
writes only): fix the offending legacy rows, then re-run the failed
`VALIDATE CONSTRAINT` statement.

## 4. Monitoring

- `plan_session_feedback` row count / write volume trend after rollout
  (Supabase logs; no new error classes expected).
- Watch Supabase logs for `check_violation` / `invalid_parameter_value`
  errors at 20260727120000's constraints or helper — they indicate
  misbehaving clients, not a migration fault.
- **Known public-behavior change (intended, design §3.2):** after this PR,
  direct PostgREST calls to `upsert_plan_session_feedback` with
  whitespace-only (TAB/CR/LF/mixed) text that previously succeeded now fail
  with `check_violation` (23514). The app route maps 23514 and 22023 to a
  400 "Validation failed"; direct API consumers must trim POSIX whitespace.
  PR2 will add the same rule inside the RPC so rejection is uniform.
- The `plan_session_feedback_athlete_consistency` legacy trigger has no
  EXECUTE grant for anon/authenticated (Supabase default). It is a known
  follow-up, not part of PR1; do not attempt to grant it here.

## 5. Rollback

Forward-fix oriented, per design §11:

1. If the Vercel app must be reverted first: revert only the app; the
   additive nullable columns and constraints stay in production. Existing
   text-only flows are unaffected.
2. If outcome data exists (any `session_date`/`session_status`/... NOT NULL),
   never drop columns destructively. Ship a forward correction instead.
3. Destructive rollback (restore `feedback_text NOT NULL`, drop outcome
   columns) is permitted only after a pre-check proves every outcome field,
   including `pain_side`, is NULL and every row has non-NULL valid feedback
   text. If that pre-check fails, retain the schema and ship forward fixes.
4. Removal of the trigger, helper, constraints, or index requires a new
   reviewed migration — never editing migration history.
5. `database.types.ts` reverts only together with a verified database
   rollback; types must never misrepresent the deployed schema.
