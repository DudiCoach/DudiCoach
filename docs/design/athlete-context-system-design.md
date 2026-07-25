---
title: Athlete Context system
status: g2-corrected
created: 2026-07-13
updated: 2026-07-25
lane: C
related_designs:
  - docs/design/US-014-plan-session-feedback-design.md
  - docs/design/US-026-async-plan-generation-design.md
---

# Athlete Context System Design

## 1. Change Brief

### Problem

Athlete data is currently split across the athlete profile, training plans,
injuries, fitness tests, and text-only plan session feedback. Plan generation
builds its own prompt-specific context and does not use structured session
outcomes. There is no reusable, bounded context contract for consultation
briefs or later coach AI questions.

### Decision

Build the system in five small phases. Extend the existing
`public.plan_session_feedback` row for a concrete
`plan_id + week_number + day_number`; do not create a second competing session
table. Add a server-only Athlete Context Builder after the outcome schema and
write path are stable. Each AI use case receives a bounded, versioned
projection rather than raw athlete history.

### Scope

- structured plan session outcomes;
- compatibility with existing text-only feedback rows;
- reusable coach-only Athlete Context Builder;
- bounded context projections for plan generation, consultation briefs, and
  later coach questions;
- explicit RLS, SECURITY DEFINER, grants, privacy, logging, prompt-injection,
  and token-budget rules.

### Out of scope

- schema or application implementation in this design update;
- medical diagnosis or automated injury creation;
- exercise-level outcomes, exercise library, or video;
- persistent AI chat memory, embeddings, or vector search;
- unrestricted export of athlete history;
- Stripe, Vercel, CI/CD, or branch-protection changes.

## 2. Existing Architecture

- `public.athletes` is owned by `coach_id`; authenticated coach access is
  enforced by RLS.
- `public.training_plans` contains immutable four-week `plan_json` documents.
- `public.injuries` and `public.fitness_test_results` are coach-owned through
  the athlete ownership chain.
- `public.plan_session_feedback` contains one row per
  `plan_id + week_number + day_number`, with denormalized `athlete_id` and an
  athlete/plan consistency trigger.
- Public athlete feedback uses active-share-code SECURITY DEFINER RPCs. The
  table has no anonymous direct policies or direct client write policies.
- Async plan generation stores a private prompt snapshot in
  `plan_generation_jobs.prompt_inputs`; the worker receives that snapshot and
  does not independently load athlete history.
- The current `AthleteWithContext` type is specific to plan prompt rendering;
  it is not a reusable context builder. Session outcomes and fitness-test
  trends are not included.

## 3. Session Outcome Data Rules

### 3.1 Additive columns on the existing row

The schema foundation phase adds nullable columns to
`public.plan_session_feedback`:

| Column | Type | Rule |
|---|---|---|
| `session_date` | `date` | Required for a structured outcome; nullable for legacy rows; no migration default. |
| `session_status` | `text` | `completed`, `partial`, or `skipped`. |
| `session_rpe` | `smallint` | 1-10 for `completed`/`partial`; NULL for `skipped`. |
| `wellbeing` | `smallint` | 1-5 for every structured outcome. |
| `pain_score` | `smallint` | 0-10 for every structured outcome. |
| `pain_location` | `text` | Optional controlled body location; NULL when pain is zero. |
| `pain_side` | `text` | Optional controlled laterality; NULL means not provided or not applicable. |

Existing identity, ownership, uniqueness, and timestamp columns remain
unchanged. The existing `feedback_text` column becomes nullable.

Scale semantics are part of the data contract:

- wellbeing: 1 = very poor, 5 = very good;
- pain: 0 = no pain, 10 = maximum perceived pain;
- RPE: 1 = very easy, 10 = maximum effort.

These meanings must be preserved consistently in PR1 `COMMENT ON COLUMN`
statements, UI labels and help text, Athlete Context aggregates, and every AI
projection and prompt interpretation. Numeric ranges without these meanings
are not a complete contract.

The controlled `pain_location` catalog for v1 is:

| Key | User-facing meaning |
|---|---|
| `head` | Head |
| `neck` | Neck |
| `shoulder` | Shoulder |
| `chest_ribs` | Chest or ribs |
| `abdomen` | Abdomen |
| `upper_back` | Upper back |
| `lower_back` | Lower back |
| `pelvis_sacrum` | Pelvis or sacrum |
| `arm` | Arm |
| `elbow` | Elbow |
| `wrist_hand` | Wrist or hand |
| `hip_groin` | Hip or groin |
| `buttock` | Buttock |
| `thigh` | Thigh |
| `knee` | Knee |
| `lower_leg` | Lower leg or calf |
| `ankle_achilles` | Ankle or Achilles tendon |
| `foot` | Foot |
| `other` | Other controlled location |

The controlled `pain_side` catalog for v1 is:

| Key | Meaning |
|---|---|
| `left` | Left side |
| `right` | Right side |
| `bilateral` | Both sides |
| `central` | Midline or central location; never an unspecified side |

`pain_side IS NULL` means that laterality was not provided or is not
applicable. Laterality must never be inferred from `feedback_text`. Catalog
keys are stable machine-readable values and must not later be repurposed.

### 3.2 Independent row validity constraints

Validation is split into three independent constraints. A single expression of
"complete outcome OR non-empty text" is insufficient because it would allow a
partial structured outcome to be hidden by valid text.

First, the structured fields must either all be NULL or form one complete valid
outcome:

```sql
check (
  structured_outcome_fields_are_all_null
  or structured_outcome_is_complete
)
```

Second, optional feedback text must be valid after a full whitespace trim:

```sql
check (
  feedback_text is null
  or (
    feedback_text ~ '[^[:space:]]'
    and length(
      regexp_replace(
        feedback_text,
        '^[[:space:]]+|[[:space:]]+$',
        '',
        'g'
      )
    ) between 1 and 2000
  )
)
```

Third, the row must contain either a complete outcome or usable text:

```sql
check (
  structured_outcome_is_complete
  or (
    feedback_text is not null
    and feedback_text ~ '[^[:space:]]'
  )
)
```

This permits a structured outcome with or without text and preserves legacy
text-only rows. It rejects empty rows and rejects partial structured outcomes
even when valid text is present. Migration pre-checks, later RPC validation,
and application validation must use the same POSIX `[[:space:]]` semantics.
Control characters remain subject to the existing sanitization rule: strip C0
control characters except LF and TAB.

### 3.3 Structured outcome completeness and date enforcement

A structured outcome exists when any structured field, including `pain_side`,
is supplied. If it exists, all required rules apply atomically:

- `session_date` is not NULL;
- `session_status` is `completed`, `partial`, or `skipped`;
- `wellbeing` is between 1 and 5;
- `pain_score` is between 0 and 10;
- `completed` and `partial` require `session_rpe` between 1 and 10;
- `skipped` requires `session_rpe IS NULL`;
- `pain_location` is NULL or one value from the controlled location catalog;
- `pain_side` is NULL or one value from the controlled side catalog;
- `pain_score = 0` requires both `pain_location IS NULL` and
  `pain_side IS NULL`;
- non-NULL `pain_side` requires non-NULL `pain_location`;
- `pain_location` and `pain_side` remain optional when `pain_score > 0`.

The future-date rule must not use a time-dependent `CHECK` constraint.
PR1 adds a `BEFORE INSERT OR UPDATE OF session_date` trigger that rejects:

```sql
new.session_date > (now() AT TIME ZONE 'Europe/Warsaw')::date
```

The trigger validates writes but does not derive or modify the supplied date.
It does not require `SECURITY DEFINER`; its function must use an explicit safe
`search_path`. The application must not depend on a database default for
`session_date`. The athlete supplies the local session date explicitly.

### 3.4 Legacy rows

- Existing text-only rows remain valid.
- `session_date` and every structured field, including `pain_side`, remain NULL
  for those rows; the migration must not infer values from `created_at`,
  `updated_at`, or free text and must not add a date default.
- Legacy rows are excluded from structured adherence, RPE, wellbeing, pain,
  location, and laterality aggregates.
- A bounded number may be exposed as `legacy_text_only` context entries when
  their text is relevant, but their date provenance must be marked as unknown.
- No status, RPE, wellbeing, pain, location, laterality, or session date may be
  inferred from `feedback_text`.

### 3.5 Indexing and compatibility

- Preserve `unique(plan_id, week_number, day_number)`.
- Preserve the athlete/plan consistency trigger and `updated_at` trigger.
- Add `(athlete_id, session_date desc) where session_date is not null` for
  bounded context reads; avoid a duplicate index on the existing unique tuple.
- PR1 may add only the future-date validation trigger and its non-SECDEF helper
  function; it does not replace or change an RPC.
- Regenerate `lib/supabase/database.types.ts` from the migrated schema.
- Because nullable `feedback_text` becomes `string | null`, PR1 may include the
  minimum type-only compatibility adjustment, preferably in
  `lib/api/plan-feedback.ts`, required to preserve the current API/UI contract.
  This exception must not change runtime behavior, route payloads, RPC
  signatures, validation, rendering, or current feedback semantics.

## 4. RPC, RLS, And Authorization

### 4.1 Direct table access

- RLS remains enabled on `plan_session_feedback`.
- Authenticated coach SELECT remains limited to athletes where
  `athletes.coach_id = auth.uid()`.
- There is no anonymous direct table policy.
- There is no direct INSERT, UPDATE, or DELETE policy for `anon` or
  `authenticated` clients.
- Coach-side Athlete Context reads use an authenticated Supabase client and
  RLS. They do not use service role to bypass ownership.

### 4.2 Public outcome RPC

The public athlete write/read path remains RPC-only. Each outcome RPC must:

- be `SECURITY DEFINER`;
- set `search_path = public` explicitly;
- normalize with `upper(p_code)`;
- require an active share code;
- verify that the plan belongs to the athlete selected by that share code;
- verify that the requested week/day exists in that plan's `plan_json`;
- enforce the same text and structured-outcome validation as the DB;
- derive or verify `athlete_id` server-side;
- return a sanitized row only for the requested plan/day.

Grants must be explicit:

- revoke from implicit `PUBLIC`;
- grant execute only to `anon` and `authenticated` where the public route needs
  it;
- no direct client table write grant;
- independently verify the function ACL after migration replay and production
  apply.

### 4.3 Share-code risk

An active share code is a bearer credential, not user authentication. Anyone
who possesses it can read the public plan and submit outcomes for that plan.
Therefore:

- never expose or log the code;
- invalid code, inactive code, wrong plan, and non-owned plan must produce the
  same sanitized not-found behavior;
- preserve the existing reset/deactivation mechanism;
- monitor write frequency and add durable rate limiting if abuse signals
  appear;
- do not expose Athlete Context, consultation briefs, or coach questions
  through a share-code endpoint.

The unique plan/week/day key limits duplicate rows but is not a complete abuse
control because an attacker with a valid code could repeatedly overwrite a
row.

## 5. Athlete Context Builder

### 5.1 Boundary

The builder is a server-only TypeScript module. It accepts an authenticated
Supabase client, `athleteId`, purpose, `asOf`, and a bounded window. The first
athlete query runs under RLS and returns not found for non-owned athletes.

```ts
buildAthleteContext({
  supabase,
  athleteId,
  purpose,
  asOf,
  windowWeeks: 6,
})
```

It returns structured data, not a prompt. Prompt renderers consume explicit
projections of this result.

### 5.2 Versioned contract

Initial contract identifiers:

- context schema: `athlete-context.v1`;
- plan prompt: `plan-generation.v2`;
- consultation prompt: `consultation-brief.v1`;
- future coach-question prompt: `coach-question.v1`.

The context includes `generatedAt`, `asOf`, effective window, record counts,
and truncation flags. Version changes are explicit whenever field meaning,
selection, aggregation, or prompt behavior changes.

### 5.3 Bounded source data

Default window is 6 weeks; allowed range is 4-8 weeks with a hard maximum of
8. The builder may aggregate at most 56 structured session rows and expose at
most 12 detailed sessions.

It may include:

- relevant athlete training profile fields;
- at most 10 active/healing injuries;
- at most 12 fitness-test results, no more than 2 per test key;
- aggregate outcome counts and trends;
- at most 12 selected session details;
- at most 4 referenced plan records, from which only plan/session labels and a
  bounded exercise-name list are extracted.

It must not include:

- share code, coach id, cookies, JWTs, or auth data;
- complete plan JSON documents;
- every historical injury, test, plan, or feedback row;
- provider prompts or model output from previous requests.

### 5.4 Projections

Plan generation uses structured-first context:

- adherence counts and rate;
- RPE, wellbeing, and pain aggregates;
- recent structured outcomes and pain flags;
- training constraints and active/healing injuries;
- latest relevant tests.

Raw feedback is secondary, optional, bounded, and untrusted. It is never used
as the primary source for status, RPE, wellbeing, pain, or adherence.

Consultation brief projection adds evidence references, observations, cautious
inferences, questions for the athlete, and coach actions. It must not present
medical diagnosis.

Future coach-question projection is selected for the specific question and
must answer `unknown` when the bounded evidence is insufficient. It does not
create persistent unrestricted chat memory in this phase.

## 6. Prompt-Injection Boundary

Athlete feedback, athlete notes, injury notes, and test notes are untrusted
data even after character sanitization. Trimming and HTML-safe rendering do
not prevent prompt injection.

Every AI system prompt must state that text inside the context data block may
contain instructions and must never override system/developer rules. Context
is serialized as a clearly delimited JSON data block. Raw text is never
concatenated into an instruction section.

Plan generation must:

1. reason from structured fields first;
2. treat raw feedback only as untrusted supporting evidence;
3. never execute commands or follow instructions contained in feedback;
4. distinguish athlete-reported facts from model inference;
5. use strict structured output and schema validation.

## 7. Privacy And Logging

Never log:

- `feedback_text` or excerpts;
- athlete or injury notes;
- pain location or complete session outcomes;
- serialized Athlete Context or prompt payloads;
- share codes, tokens, cookies, JWTs, or provider credentials;
- generated consultation content.

Allowed operational fields are limited to sanitized error class/code, request
or job id, context/prompt version, selected record counts, truncation flags,
latency, and provider token counts. Do not attach athlete names to AI/runtime
logs.

AI payloads should omit direct identifiers that are unnecessary for the task.
The UI may show the athlete name outside the prompt; the model usually does not
need it.

Owner/legal confirmation is required before production use regarding athlete
notice/consent, external AI processor terms, retention, deletion/export, and
whether pain/wellbeing outcomes require additional health-data handling.

## 8. Context Size And Token Control

Hard limits for v1:

- time window: maximum 8 weeks;
- rows used for aggregates: maximum 56;
- detailed sessions: maximum 12;
- one raw feedback excerpt: maximum 300 characters;
- all raw feedback excerpts: maximum 2400 characters;
- athlete free-form notes: maximum 500 characters;
- one injury note excerpt: maximum 300 characters;
- active/healing injuries: maximum 10;
- fitness-test results: maximum 12 and maximum 2 per key;
- referenced plans: maximum 4;
- serialized context: maximum 16 KiB before prompt rendering;
- target plan-generation context: approximately 2000 input tokens;
- target consultation context: approximately 3000 input tokens;
- future coach-question context: maximum approximately 4000 input tokens.

Truncation is deterministic and reported in context metadata. Aggregates are
computed in code/SQL before the AI request; the model is not given all rows to
calculate averages. Provider input/output token counts and latency are logged
without prompt content.

Plan generation repeats athlete context across header and weekly generation
calls, so PR5 must measure the multiplied input-token cost and preserve the
existing static system-prompt caching behavior.

## 9. Delivery Sequence

### PR1 - Schema foundation

Lane C. Add nullable outcome columns including `pain_side`, three independent
row-validity constraints, POSIX-whitespace migration pre-checks, the
Europe/Warsaw future-date trigger, the partial context index, complete column
comments, generated database types, migration safety notes, and SQL/security
tests. PR1 may also make only the minimum type-only compatibility change needed
because `feedback_text` becomes `string | null`, preferably in
`lib/api/plan-feedback.ts`.

PR1 does not change RPCs, routes, payloads, UI behavior, rendering, or AI
behavior. Legacy text-only rows remain readable and valid. Migration approval
requires the exact location and side catalogs, scale semantics, trigger, and
constraints to match this design.

### PR2 - Outcome RPC/API/UI

Lane C. Add or safely version the public outcome RPCs, update the existing
feedback route contract and athlete form, extend coach read/display, and add
validation and denial tests. Verify SECDEF, search path, grants, active-share
gate, plan/day ownership, plain-text rendering, and no-log rules.

### PR3 - Athlete Context Builder

Lane C. Add the server-only builder, versioned types, deterministic selection,
aggregations, projections, and unit/integration tests. No public endpoint and
no AI call in this phase.

### PR4 - Consultation brief

Lane C because private athlete data is sent to an external AI provider. Add a
coach-authenticated API and UI, strict structured response, bounded context,
cost/rate controls, safe error handling, and non-diagnostic copy. V1 output is
generated on demand and is not persisted unless a later retention decision is
approved.

### PR5 - Plan generation integration

Lane C and runtime-sensitive. Replace the prompt-specific context assembly in
active plan-generation entry points with the builder projection. Preserve the
job snapshot model, add context/prompt versions to private job metadata, and
keep the worker lifecycle unchanged. Update both active async and reachable
legacy generation paths or explicitly retire the legacy path to avoid prompt
drift.

Future coach AI questions are a separate story after PR5.

## 10. Verification And G9

Required PR1 migration pre-checks and verification include:

- count legacy rows that would fail the new POSIX `[[:space:]]` trim rule,
  reporting only counts and never feedback content;
- confirm the current table, unique constraint, RLS, ownership policy,
  consistency trigger, `updated_at` trigger, RPC definitions, and function ACLs
  before the migration;
- replay the full migration history against a clean Supabase Preview;
- confirm all new columns are nullable and `session_date` has no default;
- preserve every valid legacy text-only row and one-row-per-session uniqueness;
- accept complete structured outcomes with and without feedback text;
- reject partial structured outcomes, including partial outcomes accompanied by
  otherwise valid text;
- test whitespace-only values containing spaces, TAB, LF, CR, and mixed POSIX
  whitespace, plus the trimmed 1 and 2000 character boundaries;
- test the completed/partial/skipped RPE matrix and every numeric boundary;
- verify that the date trigger accepts the current Europe/Warsaw date and
  rejects the next date, including a UTC/Europe-Warsaw boundary case;
- test every `pain_location` and `pain_side` key, invalid keys, and NULL;
- reject location or side when pain is zero;
- reject side without location;
- accept optional location and side when pain is greater than zero;
- prove no laterality is inferred or backfilled from legacy text;
- confirm the context index predicate and column ordering;
- confirm all CHECK constraints are validated and the date trigger is enabled;
- regenerate Supabase types from the Preview schema and run typecheck with only
  an approved type-only compatibility adjustment if required;
- verify existing RPC signatures, return shapes, SECURITY DEFINER attributes,
  safe search paths, grants, public route behavior, and coach RLS remain
  unchanged;
- run applicable lint, full tests, build, independent G6, mandatory G7/G8, and
  post-deployment G9 evidence.

Supabase Preview is a blocking PR1 gate. It must show successful migration
replay, no unexpected schema drift, the expected constraints/index/trigger,
and no RLS or ACL regression. G9 must confirm the migration version and schema
objects in production and re-smoke the existing text feedback add/edit/read and
coach display paths without logging feedback or private data.

## 11. Rollback Strategy

- PR1 rollback is forward-fix oriented. Additive nullable columns should remain
  in place if application rollout is reverted; avoid destructive production
  rollback of outcome data.
- The date trigger, helper function, new constraints, and context index may be
  removed only by a new reviewed migration, never by editing migration history.
- A destructive rollback that restores `feedback_text NOT NULL` or drops outcome
  columns is permitted only after a pre-check proves every outcome field,
  including `pain_side`, is NULL and every row has non-NULL valid feedback text.
- If any structured or structured-only row exists, retain the columns and ship a
  forward correction instead of dropping data.
- The generated types and any PR1 type-only compatibility adjustment may be
  reverted only together with the verified database rollback; they must never
  misrepresent the deployed schema.
- PR2 can revoke execute on new outcome RPCs and restore the text-only route/UI
  while retaining stored rows.
- PR3 has no public runtime surface and can be reverted independently.
- PR4 can disable/revert the consultation route and UI without changing outcome
  data.
- PR5 can restore the previous plan prompt builder; existing plans and job
  snapshots remain valid.

## 12. Unresolved Owner And Legal Decisions

Before PR4 production release, the owner must decide and document:

1. Athlete notice and consent for processing wellbeing, pain, injuries, and
   feedback through the external AI provider.
2. Whether these fields are treated as health data requiring additional
   contractual, privacy-policy, or access controls.
3. Retention and deletion/export periods for outcomes, AI job prompt snapshots,
   and consultation briefs.
4. Whether consultation briefs remain ephemeral or may be stored later.
5. Durable rate-limit and abuse threshold for active share-code writes.
6. Incident-response expectations if a share code is disclosed.
7. Whether athlete name and exact dates may be sent to the AI provider; the
   technical recommendation is to omit names and use only dates needed for
   trend ordering.

These decisions do not block PR1 schema design review, but unresolved items
1-4 block production enablement of PR4.
