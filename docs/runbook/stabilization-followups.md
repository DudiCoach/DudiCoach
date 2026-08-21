# Stabilization follow-ups — operator runbook (2026-08-20)

Consolidated, evidence-backed runbook for the remaining stabilization steps after
PRs #83/#84/#85. Change Brief: `docs/change-briefs/2026-08-20-gitleaks-allowlist-followups.md`.
Incident record: `docs/security/incident-2026-08-19-pr69-credential-exposure.md`.

## Evidence collected (2026-08-20)

| Check | Result |
|---|---|
| GitHub forks | 0 |
| GitHub secret-scanning alerts (API) | 0 |
| `gcloud` CLI on this machine | NOT installed |
| `vercel whoami` | "The specified token is not valid" (logged out) |
| `~/.supabase/access-token` | absent |
| `VERCEL_TOKEN` / `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` env | absent |
| Repo secrets | `FIREBASE_SERVICE_ACCOUNT_DUDICOACH_APP`, `PLAN_JOBS_WORKER_SECRET` (present) |
| Repo variables | none (`E2E_ENABLED` unset → e2e-preview skipped, by design) |
| Full-history secret scan (`workflow_dispatch`, run #32406808451) | FAILED on 2 verified non-secrets → allowlisted in `.gitleaks.toml`; re-run after merge → expect PASS |
| Supabase Preview cloud check | pre-existing failure on main (vector buckets 402); not a required check |

## A. Rotate the leaked `postgres` credential (peaklab) — USER

Blocked here: no `gcloud`, no Cloud SQL access from this machine. Steps (from the
incident doc):

1. Rotate the `postgres` password on the Cloud SQL instance serving `peaklab`
   (Cloud SQL console or `gcloud sql users set-password`); update the local
   Cloud SQL Auth Proxy config and any downstream scripts consuming it.
2. Verify the OLD credential is rejected (connection attempt must fail with an
   authentication error).
3. Review instance auth/connection logs since 2026-08-13 for unknown operators.
4. Check the password is not reused on other instances/services; rotate those too.
5. Mark rotation done + verification result in the incident doc (no secret values).

## B. Runtime truth — production state (OPERATOR)

Blocked here: `vercel` logged out, no Supabase access token.

1. Supabase: `supabase migration list --linked` (or project SQL editor:
   `select version, name from supabase_migrations.schema_migrations order by version;`)
   → confirm version sequence matches local migrations (21 files, newest
   `20260820090000_US-013_load_progressions.sql`).
2. Vercel (Production AND Preview): confirm `NEXT_PUBLIC_PLAN_GENERATION_MODE=async`
   set explicitly; confirm `PLAN_JOBS_WORKER_SECRET` present in Vercel env
   (it exists in repo secrets — Vercel env is a separate store); confirm project
   tier and cron schedule for the plan worker.
3. Rollback flip test (documented in `docs/design/athlete-context-pr1-operations.md`):
   flip `NEXT_PUBLIC_PLAN_GENERATION_MODE` to `sync`, verify one plan generation,
   flip back to `async`.
4. Server-log review of the G9 window: 5xx, `42883`, RPC errors.

## C. G9 runtime evidence for US-014/US-026 on Preview (OPERATOR)

Blocked here: no preview credentials.

1. On a Preview deployment: add/edit/read plan-session feedback (text + structured
   fields when available) as coach; verify athlete view.
2. Full async generation cycle: create plan → job `pending` → worker claims → success
   AND error (`anthropic_5xx`, `parse_error`) → retry semantics → terminal states.
3. Check `20242883`/RPC errors in logs; verify no feedback/private data in logs.

## D. Activate the gated e2e-preview CI job (OPERATOR)

1. Create a THROWAWAY coach account (preview-only; never production credentials —
   Playwright traces contain request bodies incl. login data and the repo is public).
2. Confirm the Preview deployment does NOT share the production Supabase project.
3. Set repo secrets: `E2E_COACH_EMAIL`, `E2E_COACH_PASSWORD`, `PLAYWRIGHT_BASE_URL`
   (a PREVIEW deployment URL — the CI guard rejects production domains).
4. Set repo variable: `E2E_ENABLED=true`.
5. Expected: `e2e-preview` job runs US-010/011/012/013 against the preview and passes.

## E. Full-history secret scan (operator/user, 2 min)

Actions → CI → Run workflow (trigger: `workflow_dispatch`, ref: `main`).
Expected: PASS (2 verified findings allowlisted). If it ever fails: download the
`gitleaks-results.sarif.zip` artifact, triage each finding, do not allowlist
without evidence.

## Open owner decisions (block the next epic, not this runbook)

From `docs/design/athlete-context-system-design.md` §12 (they block PR4 production,
decisions 1-4; 5-7 documented): athlete notice/consent for AI processing; health-data
classification; retention/deletion/export periods; ephemeral vs stored consultation
briefs; share-code write abuse thresholds; share-code disclosure incident response;
whether athlete name/exact dates may be sent to the AI provider (recommendation:
omit names, send only dates needed for trend ordering).