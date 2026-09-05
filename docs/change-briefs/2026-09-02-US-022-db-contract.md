# Change Brief — US-022 DB Contract

## Problem statement
US-022 needs a safe DB contract for structured session outcomes before API/UI work:
public share-code writes must support complete outcomes, coach reads must work through
RLS, and public writes need abuse control.

## Evidence
- Outcome columns and constraints already exist in `20260727120000_athlete_session_outcome_schema.sql`.
- RPC v1 is text-only and must remain available for chronological migration replay.
- Existing coach route reads `plan_session_feedback` directly as `authenticated`, while previous SQL gates denied `authenticated SELECT`.

## Root cause hypothesis
PR1 delivered only schema foundations. The safe write/read contract and operational controls were intentionally left for PR2.

## Affected surfaces
- Supabase migrations and SQL replay harness.
- SQL security/behavior gates.
- Public share-code write path and coach RLS read path.

## Lane classification
Lane C: public write RPC, RLS/ACL, health data, rate limiting.

## Scope
- Add RPC v2 for structured outcome write/read.
- Keep RPC v1 signatures unchanged and add shared write limiter to v1.
- Add DB-backed 20 writes / 10 minutes per athlete limiter.
- Grant `authenticated SELECT` on `plan_session_feedback`, guarded by existing coach RLS.
- Add US-022 SQL gates and run them in clean + upgrade replay.

## Out of scope
- Next.js API route, UI, E2E, production deployment, cloud credential rotation.

## Required gates
G2 approval before implementation, G5 SQL replay, G7 security review, G8
runtime/performance review, G6 independent review. G9 remains blocked until Sprint 0
cloud access is complete.

## Expected files to change
- `supabase/migrations/20260902120000_US-022_structured_session_outcome_rpcs.sql`
- `tests/sql/us022-outcome-rpc-gates.sql`
- `tests/sql/outcome-schema-security.sql`
- `scripts/verify-migrations.sh`

## Required tests/checks
- `git diff --check`
- `bash scripts/verify-migrations.sh` in CI or local Docker-enabled environment.

## Security/privacy considerations
- Do not store raw share code or health payload in limiter rows.
- Keep anon table access closed.
- Do not grant v2 EXECUTE to implicit PUBLIC.
- Keep coach access read-only and RLS-scoped.

## Rollback plan
Forward rollback by revoking v2 RPC EXECUTE from `anon`/`authenticated`. Keep columns,
limiter table, v1 RPC and stored outcome rows.

## Definition of done
- Clean and upgrade replay pass.
- SQL proves v1 compatibility, v2 validation, ACL/search_path, RLS owner/cross-owner and rate-limit behavior.
