---
title: Athlete Context system
status: g2-revised
created: 2026-07-13
updated: 2026-07-13
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
| `pain_location` | `text` | Optional controlled value; must be NULL when `pain_score = 0`. |

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

### 3.2 Row validity invariant

A row is valid only when at least one of these branches is true:

1. It contains a complete valid structured outcome.
2. It contains non-empty text after trimming.

This permits:

- structured outcome with text;
- structured outcome without text;
- legacy text-only row.

It rejects an empty row with neither a structured outcome nor usable text.

Conceptual constraint:

```sql
check (
  structured_outcome_is_complete
  or nullif(btrim(feedback_text), '') is not null
)
```

`feedback_text`, when present, must satisfy both:

```sql
nullif(btrim(feedback_text), '') is not null
length(btrim(feedback_text)) between 1 and 2000
```

The explicit whitespace check is required because a length-only check accepts
strings containing only spaces. Application and RPC validation must use the
same trim and length semantics. Control characters remain subject to the
existing sanitization rule: strip C0 control characters except LF and TAB.

### 3.3 Structured outcome completeness

A structured outcome exists when any structured field is supplied. If it
exists, all required rules apply atomically:

- `session_date` is not NULL;
- `session_date <= (now() AT TIME ZONE 'Europe/Warsaw')::date`;
- `session_status` is `completed`, `partial`, or `skipped`;
- `wellbeing` is between 1 and 5;
- `pain_score` is between 0 and 10;
- `completed` and `partial` require `session_rpe` between 1 and 10;
- `skipped` requires `session_rpe IS NULL`;
- `pain_location` is NULL or one value from the controlled body-location
  catalog;
- `pain_score = 0` requires `pain_location IS NULL`.

The exact controlled `pain_location` catalog is a required PR1 deliverable.
Its keys and user-facing meanings must be finalized in the design/migration
review before the migration is approved, then shared by DB constraints, API
validation, UI options, and Athlete Context projections.

The application must not depend on a database default for `session_date`.
The athlete explicitly supplies the local session date; the server and DB
reject future dates using the Europe/Warsaw date boundary above.

### 3.4 Legacy rows

- Existing text-only rows remain valid.
- `session_date` remains NULL for those rows; migration must not infer it from
  `created_at` or `updated_at` and must not add a default.
- Legacy rows are excluded from structured adherence, RPE, wellbeing, and pain
  aggregates.
- A bounded number may be exposed as `legacy_text_only` context entries when
  their text is relevant, but their date provenance must be marked as unknown.
- No backfill may infer status, RPE, wellbeing, pain, or session date from
  free text.

### 3.5 Indexing and compatibility

- Preserve `unique(plan_id, week_number, day_number)`.
- Preserve the athlete/plan consistency trigger and `updated_at` trigger.
- Add an index suitable for bounded context reads, for example
  `(athlete_id, session_date desc) where session_date is not null`.
- Avoid a duplicate index on the existing unique tuple.
- Prefer new outcome RPC names or otherwise prove that replacing an existing
  function does not break its signature, return shape, grants, or rolling
  deployment compatibility.

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

Lane C. Add nullable columns, checks, whitespace pre-check, partial context
index, generated database types, migration safety notes, and SQL/security
tests. No RPC, route, UI, or AI behavior changes. Legacy text-only rows remain
readable and valid. Finalize the exact controlled `pain_location` catalog and
include the scale semantics in `COMMENT ON COLUMN`; PR1 migration approval is
blocked until both are explicit and consistent with this design.

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

Required verification by phase includes:

- migration replay against a clean Supabase preview;
- preservation of legacy rows and one-row-per-session uniqueness;
- boundary tests for every numeric field and Europe/Warsaw future-date rule;
- completed/partial/skipped RPE matrix;
- pain location controlled-value and pain-zero rules;
- whitespace-only and 2000-character text boundaries;
- RLS dual-coach tests and direct anon table denial;
- active/inactive share, wrong-plan, and non-existent-day denial;
- SECDEF, search path, and function ACL checks;
- deterministic 4/6/8-week builder tests and serialized-size assertions;
- prompt-injection fixtures proving text stays in the data boundary;
- confirmation that AI projections contain no share code or entire history;
- provider token/latency measurement without prompt logging;
- consultation and plan-generation runtime smoke with a safe fixture;
- production log review for private-data or secret leakage.

Each implementation PR requires its applicable typecheck, lint, tests, build,
Supabase Preview, independent G6, G7, G8, and G9 evidence before closeout.

## 11. Rollback Strategy

- PR1 rollback should be forward-fix oriented: leave additive nullable columns
  in place if application rollout is reverted; avoid destructive production
  rollback of outcome data.
- PR2 can revoke execute on new outcome RPCs and restore the text-only route/UI
  while retaining stored rows.
- PR3 has no public runtime surface and can be reverted independently.
- PR4 can disable/revert the consultation route and UI without changing
  outcome data.
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
