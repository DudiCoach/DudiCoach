---
id: US-027-design
story: US-027
title: Multi-part activity structure in generated training plans
status: proposed
created: 2026-08-22
updated: 2026-08-22
lane: C
related_adrs:
  - ADR-0004-claude-api-integration-pattern
  - ADR-0007-async-plan-generation-via-job-table
---

# US-027 Design — Multi-part Activity Structure in Generated Training Plans

## 0. TL;DR

The current `Exercise` schema is a flat struct — every activity gets the same
`{name, sets, reps, intensity, rest, tempo, notes}` shape regardless of whether
it is a simple set, a paired superset, a conditioning circuit, or a wave-load
progression. Multi-part information is currently encoded as ad-hoc strings in
`notes`, which is lossy and not machine-readable.

This design introduces a **discriminated union** on a new `activityType` field
with four variants: `simple` (current behavior), `superset`, `circuit`, and
`progression`. The AI receives **discovery instructions** in the system prompt
telling it to choose the appropriate type based on the exercise context. Existing
plans (no `activityType` field) are transparently treated as `simple` via a Zod
`z.preprocess` shim — no DB migration required.

Changes are confined to:
1. `lib/validation/training-plan.ts` — Zod schema (discriminated union)
2. `lib/ai/client.ts` — Claude tool JSON schema (per-type schemas)
3. `lib/ai/prompts/plan-generation.ts` — system prompt (discovery instructions)
4. `components/coach/ExerciseRow.tsx` — type-aware rendering
5. `tests/unit/lib/validation/training-plan.test.ts` — new cases per type

The `training_plans` table (JSONB), the job queue, the public athlete endpoint,
and the generation orchestration architecture are **unchanged**.

---

## 1. Context

### 1.1 What we're solving

The existing generation pipeline (US-026) sends this tool schema to Claude for
every exercise, regardless of type:

```json
{
  "name": "string",
  "sets": "string",
  "reps": "string",
  "intensity": "string",
  "rest": "string",
  "tempo": "string",
  "notes": "string"
}
```

Claude has no structural way to express:

| Scenario | What Claude does today | Information lost |
|---|---|---|
| Superset (Bench + Row) | Two separate exercises; `notes: "superset z wiosłowaniem"` | Pairing, shared rest, A1/A2 labelling |
| Circuit (4 exercises × 3 rounds) | One exercise entry; details in `notes` | Per-exercise reps/intensity/tempo |
| Wave load (70%→77.5%→85%) | `sets: "3"`, `notes: "70/77.5/85%"` | Per-set intensity not machine-readable |

The AI also has no explicit instruction about when to use a grouped structure vs
a flat one — there is no "discovery" step. The model defaults to filling the same
seven fields every time.

### 1.2 What we are NOT changing

- **`training_plans` table** — JSONB column; no SQL migration.
- **`plan_generation_jobs` table** — job queue architecture unchanged.
- **`GET /api/athlete/[shareCode]/plans`** — public athlete endpoint frozen
  (ADR-0006). It reads `plan_json` verbatim; multi-part rendering is a
  coach-side concern for this story.
- **5-call generation orchestration** — header + 4 weeks pattern (US-026)
  unchanged. Only the per-exercise tool schema and system prompt change.
- **`TrainingPlanHeader`** — no changes.
- **`WeekNavigation` / `DayCard`** — outer plan UI unchanged.

### 1.3 Why discriminated union over alternatives

| Option | Trade-off |
|---|---|
| **Discriminated union** (chosen) | Clean Zod validation; each type enforces its own required fields; AI gets a clear schema per type |
| Flat schema + `parts?: []` optional array | Ambiguous: when should parts be used vs sets/reps? AI would need extra instructions and Zod can't enforce mutually exclusive fields cleanly |
| Separate top-level `exercises` and `activityBlocks` arrays | Breaks index assumptions in existing DayCard rendering; higher migration surface |
| Version field (`schemaVersion: 2`) on plan_json | Coarser — can't validate per-exercise type at the schema level |

---

## 2. Schema Design

### 2.1 Activity types

| `activityType` | When used | Key fields |
|---|---|---|
| `"simple"` | Single exercise, uniform parameters | `name, sets, reps, intensity, rest, tempo, notes` |
| `"superset"` | Exactly 2 exercises done alternately, one shared rest | `groupLabel, sets, rest, parts[2]` |
| `"circuit"` | 3–6 exercises in sequence, rest after each round | `groupLabel, rounds, rest, parts[3..6]` |
| `"progression"` | Single exercise with varying reps/intensity per set | `name, tempo, rest, sets[2..6]` (array of set objects) |

### 2.2 Zod schemas

```typescript
// lib/validation/training-plan.ts

// --- Shared part (used in superset and circuit) ---
export const exercisePartSchema = z.object({
  name:      z.string().min(1).max(120),
  reps:      z.string().min(1).max(20),
  intensity: z.string().min(1).max(40),
  tempo:     z.string().min(1).max(20),
});
export type ExercisePart = z.infer<typeof exercisePartSchema>;

// --- Simple (current shape + discriminant) ---
export const exerciseSimpleSchema = z.object({
  activityType: z.literal("simple"),
  name:         z.string().min(1).max(120),
  sets:         z.string().min(1).max(20),
  reps:         z.string().min(1).max(20),
  intensity:    z.string().min(1).max(40),
  rest:         z.string().min(1).max(20),
  tempo:        z.string().min(1).max(20),
  notes:        z.string().min(1).max(160),
});

// --- Superset (2 exercises, alternated) ---
export const exerciseSupersetSchema = z.object({
  activityType: z.literal("superset"),
  groupLabel:   z.string().min(1).max(40),   // e.g. "A1/A2"
  sets:         z.string().min(1).max(20),
  rest:         z.string().min(1).max(20),   // rest between supersets
  parts:        z.array(exercisePartSchema).length(2),
  notes:        z.string().max(160).optional(),
});

// --- Circuit (3–6 exercises, sequential) ---
export const exerciseCircuitSchema = z.object({
  activityType: z.literal("circuit"),
  groupLabel:   z.string().min(1).max(80),   // e.g. "Obwód kondycyjny"
  rounds:       z.string().min(1).max(20),
  rest:         z.string().min(1).max(20),   // rest between rounds
  parts:        z.array(exercisePartSchema).min(3).max(6),
  notes:        z.string().max(160).optional(),
});

// --- Progression set (one entry in the sets array) ---
export const progressionSetSchema = z.object({
  setNumber: z.number().int().min(1).max(6),
  reps:      z.string().min(1).max(20),
  intensity: z.string().min(1).max(40),
});

// --- Progression (varying reps/intensity per set) ---
export const exerciseProgressionSchema = z.object({
  activityType: z.literal("progression"),
  name:         z.string().min(1).max(120),
  tempo:        z.string().min(1).max(20),
  rest:         z.string().min(1).max(20),
  sets:         z.array(progressionSetSchema).min(2).max(6),
  notes:        z.string().max(160).optional(),
});

// --- Discriminated union ---
export const exerciseSchema = z.preprocess(
  // Backward compat: plans without activityType default to "simple"
  (v) =>
    typeof v === "object" && v !== null && !("activityType" in v)
      ? { ...v as object, activityType: "simple" }
      : v,
  z.discriminatedUnion("activityType", [
    exerciseSimpleSchema,
    exerciseSupersetSchema,
    exerciseCircuitSchema,
    exerciseProgressionSchema,
  ]),
);

export type Exercise           = z.infer<typeof exerciseSchema>;
export type ExerciseSimple     = z.infer<typeof exerciseSimpleSchema>;
export type ExerciseSuperset   = z.infer<typeof exerciseSupersetSchema>;
export type ExerciseCircuit    = z.infer<typeof exerciseCircuitSchema>;
export type ExerciseProgression = z.infer<typeof exerciseProgressionSchema>;
```

The `daySchema` and all outer schemas remain unchanged. The `exerciseSchema`
export is replaced in place — callers using `z.infer<typeof exerciseSchema>` get
the union type automatically.

### 2.3 Backward compatibility guarantee

Plans generated before US-027 have exercises without `activityType`. The
`z.preprocess` shim injects `activityType: "simple"` before the union
discriminator runs. These plans continue to parse and validate without
modification in the DB.

Plans generated after US-027 always include `activityType`. The `"simple"` path
maps 1-to-1 to the previous flat schema (same seven fields).

---

## 3. AI Discovery — System Prompt Changes

### 3.1 Discovery instruction block

Append the following to the end of the system prompt in
`lib/ai/prompts/plan-generation.ts` `buildSystemPrompt()`:

```
Struktura cwiczen — activityType (discovery):
Kazde cwiczenie musi miec pole activityType. Wybierz typ na podstawie kontekstu:

- "simple": jedno cwiczenie, jednorodne serie/powtorzenia. Domyslny typ.
- "superset": dwa antagonistyczne lub uzupelniajace cwiczenia wykonywane na zmiane.
  Uzyj gdy: pary push/pull, oszczednosc czasu, technika pre-fatygi.
  parts: dokladnie 2 elementy. sets: liczba superserii. rest: przerwa miedzy superseriami.
- "circuit": 3-6 cwiczen wykonywanych kolejno bez przerwy miedzy cwiczeniami.
  Uzyj dla: kondycji, rozgrzewki strukturyzowanej, finishera.
  parts: 3-6 elementow. rounds: liczba rund. rest: przerwa miedzy rundami.
- "progression": jedno cwiczenie z rozna intensywnoscia lub liczba powtorzen na serii.
  Uzyj dla: wave loading (np. 8/6/4), ramp-up (70/77.5/85%), 5/3/1-style.
  sets: tablica obiektow {setNumber, reps, intensity}. min 2, max 6 serii.

Domyslaj sie typu na podstawie sportu, celu i zasad periodyzacji.
Nie uzywaj superset/circuit/progression dla prostych cwiczen izolowanych.
```

(ASCII-only Polish, consistent with existing prompt encoding.)

### 3.2 Discovery heuristics the AI should apply

These are not explicit rules in the prompt — they emerge from the training data
and the examples implied by the type descriptions. The prompt gives enough
context for Claude to make appropriate choices:

| Sport / context | Likely type choice |
|---|---|
| Strength sport, hypertrophy block | superset (push/pull pairs) |
| GPP / conditioning block | circuit (finisher or stand-alone) |
| Powerlifting / 5-3-1 | progression (wave sets) |
| Technical sport, skill session | simple (no pairing) |
| Warm-up sequence (structured) | circuit (3–4 movement prep) |
| Deload week (US-026 week 4) | simple (reduced complexity) |

### 3.3 Prompt length impact

The discovery block adds ~230 ASCII characters to the system prompt. At the
current prompt cache key structure (system prompt cached per athlete profile),
this is a one-time cold miss per unique athlete. Negligible cost impact.

---

## 4. Claude Tool Schema Changes

### 4.1 Current tool schema

`TRAINING_PLAN_WEEK_TOOL_SCHEMA` in `lib/ai/client.ts` defines a fixed exercise
object schema. This is replaced with a `oneOf` discriminated union.

### 4.2 New exercise item schema (within the week tool)

Replace the `items` schema inside `exercises` array with:

```json
{
  "oneOf": [
    {
      "type": "object",
      "additionalProperties": false,
      "required": ["activityType","name","sets","reps","intensity","rest","tempo","notes"],
      "properties": {
        "activityType": { "type": "string", "enum": ["simple"] },
        "name":         { "type": "string" },
        "sets":         { "type": "string" },
        "reps":         { "type": "string" },
        "intensity":    { "type": "string" },
        "rest":         { "type": "string" },
        "tempo":        { "type": "string" },
        "notes":        { "type": "string" }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": ["activityType","groupLabel","sets","rest","parts"],
      "properties": {
        "activityType": { "type": "string", "enum": ["superset"] },
        "groupLabel":   { "type": "string" },
        "sets":         { "type": "string" },
        "rest":         { "type": "string" },
        "notes":        { "type": "string" },
        "parts": {
          "type": "array",
          "minItems": 2,
          "maxItems": 2,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["name","reps","intensity","tempo"],
            "properties": {
              "name":      { "type": "string" },
              "reps":      { "type": "string" },
              "intensity": { "type": "string" },
              "tempo":     { "type": "string" }
            }
          }
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": ["activityType","groupLabel","rounds","rest","parts"],
      "properties": {
        "activityType": { "type": "string", "enum": ["circuit"] },
        "groupLabel":   { "type": "string" },
        "rounds":       { "type": "string" },
        "rest":         { "type": "string" },
        "notes":        { "type": "string" },
        "parts": {
          "type": "array",
          "minItems": 3,
          "maxItems": 6,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["name","reps","intensity","tempo"],
            "properties": {
              "name":      { "type": "string" },
              "reps":      { "type": "string" },
              "intensity": { "type": "string" },
              "tempo":     { "type": "string" }
            }
          }
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": ["activityType","name","tempo","rest","sets"],
      "properties": {
        "activityType": { "type": "string", "enum": ["progression"] },
        "name":         { "type": "string" },
        "tempo":        { "type": "string" },
        "rest":         { "type": "string" },
        "notes":        { "type": "string" },
        "sets": {
          "type": "array",
          "minItems": 2,
          "maxItems": 6,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["setNumber","reps","intensity"],
            "properties": {
              "setNumber": { "type": "integer", "minimum": 1, "maximum": 6 },
              "reps":      { "type": "string" },
              "intensity": { "type": "string" }
            }
          }
        }
      }
    }
  ]
}
```

**Note on `strict: true`**: Anthropic's tool calling currently does not support
`oneOf` / `anyOf` with `strict: true`. Drop `strict` on the week tool only, or
use a repair pass if Claude returns a structurally invalid variant. The 3-tier
fallback (structured → free-text → repair) already handles this.

### 4.3 Fallback behaviour

If Claude returns an exercise with an unrecognised or missing `activityType`,
the Zod `z.preprocess` shim injects `"simple"` and validation falls through to
the simple schema. If the simple schema also fails, the existing repair pass in
the worker is triggered.

---

## 5. UI Changes — ExerciseRow

`components/coach/ExerciseRow.tsx` currently renders a single flat row:
`name | sets | reps | intensity | rest | tempo | notes`.

Replace with a type-aware switch:

```tsx
// Pseudocode — actual implementation in ExerciseRow.tsx
switch (exercise.activityType ?? "simple") {
  case "simple":
    return <SimpleExerciseRow exercise={exercise} />;    // current layout

  case "superset":
    return (
      <SupersetRow
        label={exercise.groupLabel}   // "A1/A2"
        sets={exercise.sets}
        rest={exercise.rest}
        parts={exercise.parts}        // renders two sub-rows with A1/A2 badge
        notes={exercise.notes}
      />
    );

  case "circuit":
    return (
      <CircuitRow
        label={exercise.groupLabel}
        rounds={exercise.rounds}
        rest={exercise.rest}
        parts={exercise.parts}        // numbered list of sub-exercises
        notes={exercise.notes}
      />
    );

  case "progression":
    return (
      <ProgressionRow
        name={exercise.name}
        tempo={exercise.tempo}
        rest={exercise.rest}
        sets={exercise.sets}          // table: Set # | Reps | Intensity
        notes={exercise.notes}
      />
    );
}
```

The athlete-facing public plan view (`app/athlete/[shareCode]/...`) gets the
same ExerciseRow component — no separate implementation needed.

---

## 6. Open Questions

| # | Question | Proposed resolution |
|---|---|---|
| Q1 | Should `activityType: "simple"` be required in newly generated plans, or can we keep it optional (backwards-compat only)? | Require it in new AI output (system prompt); keep preprocess shim for old plans. |
| Q2 | Does Anthropic's tool calling support `oneOf`? | Empirically test in dev. If not, fall back to free-text generation + repair for non-simple types only. |
| Q3 | `maxItems: 4` on exercises per day — does a superset count as 1 or 2 toward this limit? | 1 — each array element in `exercises[]` is one `Exercise` object regardless of type. Superset of 2 = 1 slot. |
| Q4 | Should the athlete public endpoint render multi-part exercises? | Yes — same `ExerciseRow` component. Athlete sees the same structure. Scoped to rendering only in this story. |
| Q5 | Should `notes` be required for `simple` but optional for group types? | Keep `notes` required for `simple` (matches current schema). Optional for group types (groupLabel + parts are self-describing). |

---

## 7. Testing Strategy

### Unit — `tests/unit/lib/validation/training-plan.test.ts`

Add test groups:

```
describe("exerciseSchema — superset")
  ✓ accepts valid superset with 2 parts
  ✗ rejects superset with 1 part
  ✗ rejects superset with 3 parts
  ✗ rejects superset missing groupLabel

describe("exerciseSchema — circuit")
  ✓ accepts circuit with 3 parts
  ✓ accepts circuit with 6 parts
  ✗ rejects circuit with 2 parts
  ✗ rejects circuit with 7 parts

describe("exerciseSchema — progression")
  ✓ accepts progression with 2 sets
  ✓ accepts progression with 6 sets
  ✗ rejects progression with 1 set
  ✗ rejects progression with 7 sets

describe("exerciseSchema — backward compat")
  ✓ accepts exercise without activityType (injects "simple")
  ✓ mixed day: [simple, superset, progression] passes daySchema
```

### Integration — `tests/integration/internal/plan-jobs-worker-route.test.ts`

Add fixture `buildWeekWithMixedTypes()` → one day with `[simple, superset, circuit]`.
Verify end-to-end parse + persist path accepts mixed-type week.

### Component — `tests/unit/components/ExerciseRow.test.tsx` (new file)

Render each type variant; assert correct badge/label presence
(`A1`, `A2`, round count, set table rows).

---

## 8. Files Changed

| File | Change type | Notes |
|---|---|---|
| `lib/validation/training-plan.ts` | Modify | Add 4 schemas + discriminated union + preprocess shim; replace `exerciseSchema` export |
| `lib/ai/client.ts` | Modify | Replace exercise `items` in `TRAINING_PLAN_WEEK_TOOL_SCHEMA`; drop `strict` on week tool |
| `lib/ai/prompts/plan-generation.ts` | Modify | Append discovery instruction block to `buildSystemPrompt()` |
| `components/coach/ExerciseRow.tsx` | Modify | Type-aware rendering switch + 3 new sub-components |
| `tests/unit/lib/validation/training-plan.test.ts` | Modify | New test groups per type |
| `tests/integration/internal/plan-jobs-worker-route.test.ts` | Modify | Mixed-type fixture |
| `tests/unit/components/ExerciseRow.test.tsx` | New | Component tests per type |
