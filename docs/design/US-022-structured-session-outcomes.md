# US-022 — Structured Session Outcomes (Athlete Context PR2) — Planning

**Status:** Owner decision taken 2026-08-20 (next increment; wellbeing/pain = health data); G2 approval still required before implementation
**Lane:** C (schema-adjacent RPCs/API/UI on user data, private athlete data)
**Source of truth:** `docs/design/athlete-context-system-design.md` §9 PR2

## 1. Problem

PR1 (schema foundation, merged `9de3c7e` 2026-08-18) added nullable structured
outcome columns (`session_date`, `session_status`, `session_rpe`, `wellbeing`,
`pain_score`, `pain_location`, `pain_side`) with row-validity constraints, the
Europe/Warsaw future-date trigger, and the partial context index — but no RPCs, routes,
UI, or athlete-facing form yet.
Athletes cannot report RPE/wellbeing/pain, and coaches cannot read structured
outcomes. This is the product value layer of the Athlete Context roadmap.

## 2. Canonicalization (ID conflict resolution)

- Backlog line US-022 ("Raportowanie RPE i bolu przez zawodnika", EPIC-C) and the
  design PR2 (structured session outcomes: outcome RPCs, feedback route contract,
  athlete form, coach read/display) describe THE SAME scope: the athlete-facing
  feedback form is the RPE/pain reporting surface.
- Decision (2026-08-20): **canonical US-022 = Athlete Context PR2** (structured session
  outcomes). The backlog v1.2+ table disambiguates the AI-recommended progressions line
  to **US-023** ("Adaptacyjne generowanie planu z Athlete Context"), so no collision
  with the canonical US-022. EPIC-B was corrected to US-023 in the 2026-08-20 backlog
  reconcile; canonicalization is now complete. Archive the EPIC-C one-liner as an alias
  of US-022; do not implement it as a separate story.

## 3. Scope (from design §9 PR2)

- Version or safely add public outcome RPCs (active-share gate, plan/day ownership,
  SECURITY DEFINER verification, search path, explicit grants).
- Update the existing plan-feedback route contract and the athlete form to accept
  structured fields (RPE/wellbeing/pain with the DB validation matrix).
- Extend coach read/display of structured outcomes (badges, pain flags).
- Tests: validation/denial matrix (completed/partial/skipped RPE, numeric boundaries,
  pain location/side rules), RPC grants, plain-text rendering, no-log rules.
- Dev dependencies: `lib/api/plan-feedback.ts` type-only adjustment if still pending.

## 4. Out of scope

- PR3 Athlete Context Builder, PR4 consultation brief, PR5 plan-generation
  integration (separate stories).
- Data retention/export features (owner decisions below).
- Any AI provider calls.

## 5. Required gates

G1/G2 (this planning + design approval before code), G3, G4 (UI), G5, G7 (mandatory:
auth/RLS/RPC/user data), G8 (runtime: form/render paths), G6 before merge, G9
(post-deployment smoke incl. structured feedback add/edit/read + coach display).

## 6. Owner decisions required before implementation (from design §12)

Decisions 1-4 block PR4 production, not PR2 — but decision on athlete-facing data
collection UX (notice text inside the form, health-data labeling) is needed for the
UI copy. Full list in `docs/runbook/stabilization-followups.md` §"Open owner decisions".

1. Athlete notice/consent for processing wellbeing/pain/injuries/feedback (PR4).
2. Health-data classification and controls.
3. Retention/deletion/export periods.
4. Consultation briefs: ephemeral vs stored.
5. Share-code write abuse thresholds + disclosure incident response (PR2 touches the
   active-share gate — rate-limit decision affects PR2's denial tests).
6. Whether athlete name/exact dates may be sent to the AI provider (recommendation:
   omit names; dates only for trend ordering).

## 7. Evidence of readiness

- Schema + constraints + trigger + index live in prod (PR1 merged).
- Replay harness verified in CI (PR #84, `verify-migrations.sh` ALL PASS).
- SQL security/behavior suites exist for the outcome schema and pass 3 phases.
- Next implementation PR would touch: RPCs (new or versioned), `app/api/.../feedback`
  route, athlete form + coach UI, tests, types regeneration.

## 8. Rollback

- Revoke EXECUTE on new outcome RPCs + restore text-only route/UI while retaining
  stored rows (design §11 PR2 note).

## 9. Definition of done

G2-approved design delta, implementation with full test matrix, G6/G7/G8/G9 evidence
in CI, story status updates, no regression on text-only legacy rows.