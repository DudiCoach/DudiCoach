---
title: US-022 Structured Session Outcomes — Change Brief
lane: C
date: 2026-08-20
status: Planning (owner decision taken; G2 pending before code)
---

# Change Brief — US-022 Structured Session Outcomes (Athlete Context PR2)

## Problem statement
PR1 (merged `9de3c7e`, 2026-08-18) added nullable structured-outcome columns
(`session_date`, `session_status`, `session_rpe`, `wellbeing`, `pain_score`,
`pain_location`, `pain_side`) with row-validity constraints and the Europe/Warsaw
future-date trigger, but no RPCs, routes, UI, or athlete-facing form. Athletes cannot report
RPE/wellbeing/pain and coaches cannot read structured outcomes. This is the product
value layer of the Athlete Context roadmap.

## Evidence
- `docs/design/athlete-context-system-design.md` §9 PR2 (schema, constraints, validation matrix).
- `docs/design/US-022-structured-session-outcomes.md` (planning, canonicalization).
- Existing RPCs `get_plan_session_feedback_by_share_code` / `upsert_plan_session_feedback` (text-only).
- `components/athlete/PublicDayFeedbackSection.tsx` (text-only UI).

## Root cause hypothesis
PR1 delivered only the schema foundation; the interface and safe RPC layer were scoped
out of that PR and never scheduled until now.

## Affected surfaces
- `public.plan_session_feedback` (new columns already exist) + versioned/additive RPCs.
- Plan-feedback API route contract.
- Athlete feedback form (add structured fields).
- Coach day/plan read/display (badges, pain flags).

## Lane classification
**Lane C** — schema-adjacent RPCs/API/UI on user data, private athlete health data,
public share-code write path, runtime-relevant render paths.

## Scope
- Versioned/safe outcome RPCs (active-share gate, plan/day ownership, SECURITY DEFINER
  + `search_path`, explicit grants).
- Extend feedback route + athlete form with structured fields (RPE/wellbeing/pain per DB
  validation matrix).
- Coach read/display of structured outcomes (badges, pain flags).
- Tests: validation/denial matrix, RPC grants, plain-text rendering, no-log rules.
- Maintain legacy text-only compatibility.

## Out of scope
- PR3 Athlete Context Builder, PR4 consultation brief, PR5 plan-generation AI integration.
- Retention/export/delete features (owner decisions).
- Any AI provider calls.

## Required gates
G1/G2 (planning + design approval **before code**), G3, G4 (UI), G5, G7 (mandatory:
auth/RLS/RPC/user data/health), G8 (runtime form/render), G6 before merge, G9 (post-deploy
smoke: structured add/edit/read + coach display).

## Expected files to change
- `supabase/migrations/*` (RPC/grants/constraints, additive/versioned).
- `lib/api/plan-feedback.ts`.
- `app/api/.../feedback/route.ts`.
- `components/athlete/PublicDayFeedbackSection.tsx`.
- `components/coach/*` (display).
- `tests/sql/*`, `tests/integration/*`, `tests/e2e/*`.

## Required tests/checks
- lint, typecheck, unit, integration, SQL gate tests, credentialed preview E2E.
- Denial matrix (completed/partial/skipped RPE, numeric boundaries, pain location/side rules).
- RPC ACL checks (anon/authenticated EXECUTE, not PUBLIC).
- No-log rules for health data.

## Security/privacy considerations
- Active share-code gate; plan/day ownership; explicit GRANT; safe `search_path`.
- Wellbeing/pain classified as **health data**: explicit notice, minimization, retention,
  deletion/export (owner decisions still open — affect PR4, not PR2 UI copy).
- No health data in logs.
- Share-code write rate-limit + disclosure response (decision affects PR2 denial tests).

## Rollback plan
- Revoke EXECUTE on new RPCs; revert UI to text-only.
- Keep existing outcome rows (columns nullable, additive).
- Rollback = revoke + UI flag; no destructive migration.

## Definition of done
- All ACL/RLS/SECDEF pass on isolated Preview.
- Full validation/denial matrix on RPC/route/UI.
- Responsive/a11y review passed.
- Preview + production G9 (add/edit/read + coach display).
- Logs free of private health payloads.
