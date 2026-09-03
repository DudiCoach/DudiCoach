# Change Brief — US-022 API Contract

## Problem statement

US-022 needs a versioned API contract for structured session outcomes before the
athlete and coach UI can be enabled. The existing public feedback endpoint only
supports legacy text feedback and must remain compatible.

## Evidence

- PR A adds `upsert_plan_session_feedback_v2` and
  `get_plan_session_feedback_by_share_code_v2` as the DB contract.
- Existing routes and helpers call only the legacy text-only RPCs.
- Wellbeing and pain are treated as health data, so public endpoint output,
  logs, cache headers, and validation errors need explicit privacy handling.

## Root cause hypothesis

The schema foundation and DB contract are additive, but the Next.js API layer
still exposes only the legacy feedback contract. Without a v2 route contract,
PR C UI would either bypass the DB contract or overload v1 behavior.

## Affected surfaces

- Public athlete feedback route.
- Authenticated coach feedback route.
- Client feedback API helper and types.
- Supabase generated RPC types.
- Unit and integration tests for validation, route dispatch, DTO shape, and
  error mapping.

## Lane classification

Lane C: public share-code endpoint, private athlete health data, Supabase RPC
runtime behavior, and coach-visible user data.

## Scope

- Preserve legacy v1 text-only GET/POST behavior.
- Add `contractVersion: 2` request/query support for structured outcomes.
- Dispatch v2 writes/reads to the additive v2 RPCs from PR A.
- Validate complete structured outcomes server-side before RPC calls.
- Return allowlisted public DTOs without `athlete_id`.
- Map DB `PT429` rate-limit errors to HTTP `429` with `Retry-After`.
- Use `Cache-Control: no-store` for public feedback responses.
- Avoid logging share codes, plan IDs, feedback text, health payloads, or raw DB
  messages from the public feedback route.
- Extend coach feedback read selection with structured outcome columns.

## Out of scope

- DB migrations or RPC definition changes.
- Athlete structured outcome form UI.
- Coach structured outcome visual display beyond data availability.
- E2E tests and production G9.
- Sprint 0 operator remediation.

## Required gates

- G1 planning: this Change Brief.
- G3 implementation: API contract and tests.
- G5 QA/Test: targeted and full local verification, CI after push.
- G7 security/privacy: mandatory for health data and public endpoint behavior.
- G8 runtime/performance: mandatory for route/runtime behavior.
- G6 independent code review before merge.
- G9 release smoke remains blocked until PR A/B/C are deployed and Sprint 0 is
  closed.

## Expected files to change

- `app/api/athlete/[shareCode]/plans/[planId]/feedback/route.ts`
- `app/api/athletes/[id]/plans/[planId]/feedback/route.ts`
- `lib/api/plan-feedback.ts`
- `lib/supabase/database.types.ts`
- `lib/validation/plan-session-feedback.ts`
- Focused unit and integration tests under `tests/**`.

## Required tests/checks

- `git diff --check`
- `npm run lint`
- `npm run typecheck`
- Targeted Vitest for feedback validation, API helper, public route, coach route,
  and impacted component fixtures.
- `npm test`
- `npm run build`
- CI `supabase-db` after push, because PR B is stacked on PR A and depends on the
  v2 RPC migration replay.

## Security/privacy considerations

- Active share code is a bearer credential; all public route responses must be
  non-cacheable.
- Health payloads must not appear in logs or error responses.
- Public DTOs must not expose `athlete_id`.
- Coach route uses authenticated Supabase client and existing RLS; no service role
  bypass is introduced.
- Validation failures should remain generic on the public endpoint.

## Rollback plan

Revert PR B route/helper/test changes and keep the legacy v1 endpoint behavior.
If PR A has already deployed, v2 RPC execution can remain unused or be revoked in
a forward-fix migration/operation while retaining stored rows.

## Definition of done

- v1 text-only feedback remains compatible.
- v2 structured feedback is accepted only with a complete valid outcome.
- Impossible and future dates fail before RPC dispatch.
- `PT429` maps to `429` with `Retry-After`.
- Public responses are allowlisted, non-cacheable, and free of sensitive error
  details.
- Required local checks and independent G5/G6/G7/G8 reviews pass; CI must pass
  after publication.
