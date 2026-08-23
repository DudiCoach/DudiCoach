---
id: US-028-design
story: US-028
title: Garmin activity-type taxonomy for athlete sport selector
status: proposed
created: 2026-08-22
updated: 2026-08-22
lane: C
related_adrs:
  - ADR-0004-claude-api-integration-pattern
---

# US-028 Design — Garmin Activity-Type Taxonomy for Athlete Sport Selector

## 0. TL;DR

The current sport selector is a hardcoded list of 11 Polish machine-keys
(`pilka_nozna`, …) that map to nothing external. Garmin Connect exposes a
canonical, hierarchy of ~120 `typeKey`s under ~11 root categories via
`GET /activity-service/activity/activityTypes`. This design:

1. Commits a **build-time snapshot** of that hierarchy to
   `lib/constants/garmin-activity-types.ts` (updated manually via
   `scripts/fetch-garmin-activity-types.ts`).
2. Introduces a **fallback resolver** (`lib/constants/sport-taxonomy.ts`) that
   walks `parentTypeId` to a root category for any typeKey — including future
   unknown ones — returning `"other"` rather than throwing.
3. Adds a **modality map** (`endurance | strength | skill | mixed`) keyed on
   root category, consumed by the AI prompt and US-027 activityType discovery.
4. Adds a **legacy alias map** so existing `sport: "pilka_nozna"` rows keep
   working with zero DB migration.
5. Replaces the `<select>` sport dropdown with an `<optgroup>`-grouped
   selector; adds Polish labels for categories + common sports, with a
   humanized fallback for the long tail.
6. Feeds a readable `sport + modality` string into the AI user prompt instead
   of the raw slug.

**No DB migration.** `sport` stays `text` (nullable) — the design comment in
the migration already says "NOT an enum".

---

## 1. Context

### 1.1 Current state

| Artifact | Current value |
|---|---|
| DB column | `sport text` — no CHECK, no default |
| Zod schema | `z.string().nullable().optional()` — any string accepted |
| Canonical list | `lib/constants/sports.ts`: 11 `as const` slugs, Polish keys |
| UI widget | `<select>` in `AthleteProfileForm.tsx`, populated from `SPORTS` |
| AI prompt | `- Sport: ${athlete.sport ?? "ogolny fitness"}` (raw slug, line 165) |
| Fitness tests | filtered by `Sport` union (the 11 keys) via `isFitnessTestKeyAllowedForSport` |
| Generation gate | `if (!athlete.sport || !athlete.training_days_per_week) { error }` |

### 1.2 Garmin activity-type API

Endpoint (authenticated):
```
GET https://connect.garmin.com/modern/proxy/activity-service/activity/activityTypes
```

Returns a flat array; every entry is a node in a two-level hierarchy:
```json
[
  { "typeId": 1,  "typeKey": "running",       "parentTypeId": 0,  "isHidden": false },
  { "typeId": 17, "typeKey": "trail_running",  "parentTypeId": 1,  "isHidden": false },
  { "typeId": 25, "typeKey": "treadmill_running", "parentTypeId": 1, "isHidden": false },
  ...
]
```

Root categories have `parentTypeId = 0` (or self-referential). Leaf nodes
point to a root via `parentTypeId`. Two-level: root → leaf. Garmin may
occasionally add new leaves without adding new roots. This is the key insight
exploited by the resolver: walking `parentTypeId` always terminates at a known
root.

**Source:** confirmed independently by `python-garminconnect` library
(`garminconnect/__init__.py:self.garmin_connect_activity_types`) and
`tapiriik` sync service (`garminconnect.py:_activityHierarchy`), both of
which fetch and cache this exact endpoint.

### 1.3 What we are NOT changing

- `training_plans` table, job queue, public athlete endpoint — unchanged.
- `plan_json` schema — no impact (sport affects the prompt, not the output schema).
- `athletes` table — no migration, `sport text` stays free-form.
- US-014 feedback structure — unchanged.
- The 3-tier fallback (structured → free-text → repair) in the worker — unchanged.
- `app/api/athletes/[id]/route.ts` PATCH handler — `sport: data.sport` persists as-is.

---

## 2. Garmin Taxonomy — Categories and Key Leaves

The snapshot to be committed covers these root categories and representative
leaf typeKeys. (Exact `typeId` values come from the authenticated API call;
placeholders shown where not independently verifiable.)

### 2.1 Root categories (~11)

| typeKey | Modality | Representative leaves |
|---|---|---|
| `running` | endurance | `treadmill_running`, `trail_running`, `track_running`, `indoor_running`, `street_running`, `ultra_run`, `obstacle_run`, `virtual_run` |
| `cycling` | endurance | `road_biking`, `mountain_biking`, `gravel_cycling`, `cyclocross`, `indoor_cycling`, `track_cycling`, `downhill_biking`, `e_bike_fitness`, `e_bike_mountain`, `virtual_ride`, `handcycling`, `bmx`, `recumbent_cycling` |
| `swimming` | endurance | `lap_swimming`, `open_water_swimming` |
| `walking` | endurance | `casual_walking`, `speed_walking` |
| `hiking` | endurance | `mountaineering`, `rock_climbing` |
| `fitness_equipment` | strength | `strength_training`, `hiit`, `elliptical`, `stair_climbing`, `indoor_rowing`, `indoor_cycling`, `pilates`, `yoga`, `cardio`, `mobility`, `bouldering`, `indoor_climbing`, `breathwork`, `meditation` |
| `winter_sports` | mixed | `resort_skiing_snowboarding`, `backcountry_skiing_snowboarding`, `cross_country_skiing`, `skate_skiing`, `snowshoeing`, `snowmobiling`, `skating` |
| `water_sports` | mixed | `kayaking`, `rowing`, `stand_up_paddleboarding`, `sailing`, `surfing`, `windsurfing`, `kiteboarding`, `paddling`, `wakeboarding`, `snorkeling`, `whitewater_rafting_kayaking`, `boating`, `fishing`, `diving` |
| `multi_sport` | mixed | `triathlon`, `duathlon`, `swimrun`, `transition` |
| `team_sports` | mixed | `soccer`, `basketball`, `volleyball`, `baseball`, `softball`, `american_football`, `rugby`, `cricket`, `field_hockey`, `ice_hockey`, `lacrosse`, `volleyball_beach` |
| `other` | mixed | `tennis`, `pickleball`, `padel`, `badminton`, `squash`, `racquetball`, `table_tennis`, `golf`, `disc_golf`, `boxing`, `mixed_martial_arts`, `wrestling`, `gymnastics`, `dance`, `cheerleading`, `inline_skating`, `horseback_riding`, `archery`, `hunting`, `motorcycling`, `atv`, `e_sport`, `tactical`, `jumpmaster`, `floor_climbing`, `driving_general` |

> **Note:** `pilates` and `yoga` are leaves under `fitness_equipment` in
> Garmin's hierarchy. Their modality overrides (see §3.3) promote them to
> `skill` individually.

### 2.2 Snapshot data structure

```typescript
// lib/constants/garmin-activity-types.ts (auto-managed by scripts/fetch-garmin-activity-types.ts)
// Last fetched: 2026-08-22. Refresh with: npx tsx scripts/fetch-garmin-activity-types.ts

export interface GarminActivityType {
  readonly typeId: number;
  readonly typeKey: string;
  readonly parentTypeId: number;
  readonly isHidden: boolean;
}

export const GARMIN_ACTIVITY_TYPES: readonly GarminActivityType[] = [
  { typeId: 0,   typeKey: "all",                       parentTypeId: 0,  isHidden: false },
  { typeId: 1,   typeKey: "running",                   parentTypeId: 0,  isHidden: false },
  { typeId: 17,  typeKey: "treadmill_running",          parentTypeId: 1,  isHidden: false },
  { typeId: 25,  typeKey: "trail_running",              parentTypeId: 1,  isHidden: false },
  { typeId: 3,   typeKey: "cycling",                   parentTypeId: 0,  isHidden: false },
  { typeId: 6,   typeKey: "mountain_biking",            parentTypeId: 3,  isHidden: false },
  { typeId: 11,  typeKey: "road_biking",                parentTypeId: 3,  isHidden: false },
  // ... full list fetched by the refresh script
] as const;

/** Convenience set for O(1) lookups */
export const GARMIN_TYPE_KEY_SET = new Set(GARMIN_ACTIVITY_TYPES.map(t => t.typeKey));
```

The full committed file will have all ~120 nodes; the snippet above shows shape only.

---

## 3. Sport Taxonomy Module

### 3.1 File: `lib/constants/sport-taxonomy.ts`

### 3.2 Fallback resolver

```typescript
import { GARMIN_ACTIVITY_TYPES } from "./garmin-activity-types";

const _typeByKey = new Map(GARMIN_ACTIVITY_TYPES.map(t => [t.typeKey, t]));
const _typeById  = new Map(GARMIN_ACTIVITY_TYPES.map(t => [t.typeId, t]));

/**
 * Resolve any typeKey to its root category.
 * Walks parentTypeId until it reaches a root (parentTypeId === 0).
 * Unknown/future typeKeys → "other". Never throws.
 */
export function resolveSportCategory(typeKey: string): string {
  let current = _typeByKey.get(typeKey);
  if (!current) return "other"; // unknown future key — graceful fallback

  const MAX_DEPTH = 5; // guard against malformed loops
  for (let i = 0; i < MAX_DEPTH; i++) {
    if (current.parentTypeId === 0 || current.parentTypeId === current.typeId) {
      return current.typeKey; // is itself a root
    }
    const parent = _typeById.get(current.parentTypeId);
    if (!parent) return current.typeKey; // orphaned node — return self
    current = parent;
  }
  return "other";
}
```

### 3.3 Modality map

```typescript
export type SportModality = "endurance" | "strength" | "skill" | "mixed";

/** Root category → default modality */
const CATEGORY_MODALITY: Record<string, SportModality> = {
  running:          "endurance",
  cycling:          "endurance",
  swimming:         "endurance",
  walking:          "endurance",
  hiking:           "endurance",
  fitness_equipment:"strength",
  winter_sports:    "mixed",
  water_sports:     "mixed",
  multi_sport:      "mixed",
  team_sports:      "mixed",
  other:            "mixed",
};

/** Per-leaf overrides (override the parent category default) */
const LEAF_MODALITY_OVERRIDES: Record<string, SportModality> = {
  yoga:             "skill",
  pilates:          "skill",
  meditation:       "skill",
  breathwork:       "skill",
  bouldering:       "skill",
  indoor_climbing:  "skill",
  rock_climbing:    "skill",
  gymnastics:       "skill",
  dance:            "skill",
  tennis:           "mixed",
  padel:            "mixed",
  golf:             "skill",
  archery:          "skill",
};

export function resolveSportModality(typeKey: string): SportModality {
  if (typeKey in LEAF_MODALITY_OVERRIDES) return LEAF_MODALITY_OVERRIDES[typeKey];
  const category = resolveSportCategory(typeKey);
  return CATEGORY_MODALITY[category] ?? "mixed";
}
```

### 3.4 Legacy alias map

Maps the 11 existing Polish keys to Garmin typeKeys. Stored athlete values
are NOT migrated — the alias map is applied at read time only.

```typescript
export const LEGACY_SPORT_ALIASES: Record<string, string> = {
  pilka_nozna:  "soccer",
  koszykowka:   "basketball",
  siatkowka:    "volleyball",
  tenis:        "tennis",
  plywanie:     "lap_swimming",
  lekkoatletyka:"track_running",
  fitness:      "fitness_equipment",
  crossfit:     "hiit",
  boks:         "boxing",
  mma:          "mixed_martial_arts",
  inne:         "other",
};

/**
 * Normalize any stored sport value to a canonical Garmin typeKey.
 * Handles legacy Polish keys, known Garmin typeKeys, and unknown values.
 */
export function normalizeSportKey(sport: string | null | undefined): string | null {
  if (!sport) return null;
  if (sport in LEGACY_SPORT_ALIASES) return LEGACY_SPORT_ALIASES[sport];
  return sport; // pass-through (unknown → handled by resolver)
}
```

### 3.5 Display label helper

```typescript
import { pl } from "@/lib/i18n/pl";

/**
 * Human-readable Polish label for any typeKey.
 * Falls back to title-cased slug for unknown keys.
 */
export function getSportLabel(typeKey: string): string {
  // Check curated Polish labels (categories + ~30 common sports)
  const label = (pl.coach.athlete.sport as Record<string, string>)[typeKey];
  if (label) return label;
  // Humanize long-tail typeKeys: "trail_running" → "Trail Running"
  return typeKey.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Full display string for AI prompt: "Bieganie po szlakach (wytrzymałość)"
 */
export function getSportPromptDisplay(sport: string | null | undefined): string {
  const key = normalizeSportKey(sport);
  if (!key) return "ogolny fitness";
  const label = getSportLabel(key);
  const modality = resolveSportModality(key);
  const modalityPl: Record<SportModality, string> = {
    endurance: "wytrzymałość",
    strength:  "siła",
    skill:     "technika",
    mixed:     "mieszana",
  };
  return `${label} (${modalityPl[modality]})`;
}
```

---

## 4. i18n — `lib/i18n/pl.ts` Changes

### 4.1 Category labels (~11 new keys)

```typescript
sportCategory: {
  running:          "Bieganie",
  cycling:          "Kolarstwo",
  swimming:         "Pływanie",
  walking:          "Chodzenie / marsz",
  hiking:           "Turystyka / wspinaczka",
  fitness_equipment:"Siłownia / trening",
  winter_sports:    "Sporty zimowe",
  water_sports:     "Sporty wodne",
  multi_sport:      "Multisport",
  team_sports:      "Sporty zespołowe",
  other:            "Inne",
},
```

### 4.2 Common sport labels (~30 additional keys, appended to existing `sport` block)

```typescript
sport: {
  // --- existing 11 ---
  pilka_nozna: "Piłka nożna", koszykowka: "Koszykówka", /* ... */
  // --- Garmin leaves (high-frequency) ---
  running:              "Bieganie",
  treadmill_running:    "Bieżnia",
  trail_running:        "Bieganie po szlakach",
  track_running:        "Lekkoatletyka (bieżnia)",
  road_biking:          "Kolarstwo szosowe",
  mountain_biking:      "Kolarstwo górskie",
  gravel_cycling:       "Gravel",
  indoor_cycling:       "Rower stacjonarny",
  lap_swimming:         "Pływanie (basen)",
  open_water_swimming:  "Pływanie otwarte",
  strength_training:    "Trening siłowy",
  hiit:                 "HIIT",
  yoga:                 "Yoga",
  pilates:              "Pilates",
  soccer:               "Piłka nożna",
  basketball:           "Koszykówka",
  volleyball:           "Siatkówka",
  tennis:               "Tenis",
  triathlon:            "Triathlon",
  hiking:               "Turystyka piesza",
  cross_country_skiing: "Narty biegowe",
  resort_skiing_snowboarding: "Narty / snowboard",
  rowing:               "Wioślarstwo",
  boxing:               "Boks",
  mixed_martial_arts:   "MMA",
  golf:                 "Golf",
  // Long tail falls back to humanized slug
},
```

Unlisted typeKeys (e.g. `disc_golf`, `padel`, `archery`, …) are rendered
by `getSportLabel()` → `"Disc Golf"`, `"Padel"`, `"Archery"` — acceptable
UX for rare sports without a full translation effort.

---

## 5. UI — `AthleteProfileForm.tsx` Sport Selector

### 5.1 Grouped selector structure

```typescript
// In lib/constants/sport-taxonomy.ts (exported)
export const SPORT_SELECTOR_GROUPS: Array<{
  category: string;
  labelKey: string;
  typeKeys: readonly string[];
}> = [
  { category: "running",   labelKey: "running",   typeKeys: ["running", "trail_running", "treadmill_running", "track_running", "indoor_running", "ultra_run", "obstacle_run", "virtual_run"] },
  { category: "cycling",   labelKey: "cycling",   typeKeys: ["cycling", "road_biking", "mountain_biking", "gravel_cycling", "indoor_cycling", "e_bike_fitness", "e_bike_mountain"] },
  { category: "swimming",  labelKey: "swimming",  typeKeys: ["swimming", "lap_swimming", "open_water_swimming"] },
  { category: "fitness_equipment", labelKey: "fitness_equipment", typeKeys: ["strength_training", "hiit", "cardio", "yoga", "pilates", "mobility", "elliptical", "indoor_rowing", "bouldering", "indoor_climbing"] },
  { category: "team_sports", labelKey: "team_sports", typeKeys: ["soccer", "basketball", "volleyball", "baseball", "american_football", "rugby", "ice_hockey", "field_hockey"] },
  { category: "walking",   labelKey: "walking",   typeKeys: ["walking", "casual_walking", "speed_walking"] },
  { category: "hiking",    labelKey: "hiking",    typeKeys: ["hiking", "mountaineering", "rock_climbing"] },
  { category: "winter_sports", labelKey: "winter_sports", typeKeys: ["resort_skiing_snowboarding", "cross_country_skiing", "skating", "skate_skiing", "snowshoeing"] },
  { category: "water_sports", labelKey: "water_sports", typeKeys: ["rowing", "kayaking", "sailing", "surfing", "stand_up_paddleboarding", "windsurfing"] },
  { category: "multi_sport", labelKey: "multi_sport", typeKeys: ["triathlon", "duathlon", "swimrun"] },
  { category: "other",     labelKey: "other",     typeKeys: ["tennis", "padel", "pickleball", "golf", "disc_golf", "boxing", "mixed_martial_arts", "gymnastics", "dance", "inline_skating", "other"] },
];
```

### 5.2 Selector component (pseudocode)

```tsx
import { SPORT_SELECTOR_GROUPS, normalizeSportKey, getSportLabel } from "@/lib/constants/sport-taxonomy";
import { pl } from "@/lib/i18n/pl";

// In AthleteProfileForm, replace the current SPORTS.map() with:
<select
  id="sport"
  {...register("sport", { setValueAs: (v) => v === "" ? undefined : v })}
>
  <option value="">—</option>
  {SPORT_SELECTOR_GROUPS.map(group => (
    <optgroup key={group.category} label={pl.coach.athlete.sportCategory[group.labelKey]}>
      {group.typeKeys.map(key => (
        <option key={key} value={key}>{getSportLabel(key)}</option>
      ))}
    </optgroup>
  ))}
</select>
```

### 5.3 Backward compatibility in the form

When the form initializes with a legacy key (e.g. `"pilka_nozna"`):
```typescript
// In useForm defaultValues:
sport: normalizeSportKey(athlete.sport) ?? undefined
```

`normalizeSportKey("pilka_nozna")` → `"soccer"` → the form shows the
correct selection. On save, `"soccer"` (Garmin typeKey) is persisted.
**The migration from old key to Garmin key happens on first save** —
no server-side migration needed.

The `AthleteCard.tsx` and `AthleteProfileView.tsx` display helpers should
also use `normalizeSportKey` → `getSportLabel` so cards render correctly
for both old and new values.

---

## 6. AI Prompt Changes — `lib/ai/prompts/plan-generation.ts`

### 6.1 Current (line 165)

```typescript
- Sport: ${athlete.sport ?? "ogolny fitness"}
```

### 6.2 New

```typescript
import { getSportPromptDisplay } from "@/lib/constants/sport-taxonomy";

// In buildUserPrompt():
- Sport: ${getSportPromptDisplay(athlete.sport)}
```

### 6.3 Example output in prompt

| Stored value | Prompt line |
|---|---|
| `"trail_running"` | `- Sport: Bieganie po szlakach (wytrzymałość)` |
| `"strength_training"` | `- Sport: Trening siłowy (siła)` |
| `"soccer"` (or `"pilka_nozna"`) | `- Sport: Piłka nożna (mieszana)` |
| `"triathlon"` | `- Sport: Triathlon (mieszana)` |
| `"parkour"` (unknown) | `- Sport: Parkour (mieszana)` |
| `null` | `- Sport: ogolny fitness` |

The modality label in the prompt enables future per-modality system prompt
branching (US-029+) without structural changes — the information is already
in context.

---

## 7. Fitness Tests Compatibility — `lib/constants/fitness-tests.ts`

### 7.1 Current type

```typescript
sports: readonly Sport[] | "all"  // Sport = "pilka_nozna" | "koszykowka" | ...
```

### 7.2 New type

```typescript
sports: readonly string[] | "all"  // accepts any typeKey or category string
```

The filtering logic in `getFitnessTestsForSport()` (line 156) currently does
an array `.includes(sport)`. Replace with a category-aware check:

```typescript
export function isFitnessTestKeyAllowedForSport(
  testKey: FitnessTestKey,
  sport: string | null | undefined,
): boolean {
  const test = FITNESS_TESTS.find(t => t.key === testKey);
  if (!test) return false;
  if (test.sports === "all") return true;

  const normalizedSport = normalizeSportKey(sport);
  if (!normalizedSport) return false;

  const sportCategory = resolveSportCategory(normalizedSport);

  return test.sports.some(s => {
    // Direct match on typeKey
    if (s === normalizedSport) return true;
    // Category match: test lists "running", sport is "trail_running"
    if (s === sportCategory) return true;
    // Modality match for broad tests (optional extension)
    return false;
  });
}
```

Existing test definitions that list `["pilka_nozna", "koszykowka"]` should be
migrated to `["soccer", "basketball"]` or to `["team_sports"]` (category) as
part of this story. The old Polish keys continue resolving via
`normalizeSportKey` during the transition.

---

## 8. Refresh Script — `scripts/fetch-garmin-activity-types.ts`

```typescript
#!/usr/bin/env npx tsx
/**
 * Refresh the Garmin activity-type snapshot.
 *
 * Usage:
 *   GARMIN_EMAIL=... GARMIN_PASSWORD=... npx tsx scripts/fetch-garmin-activity-types.ts
 *
 * Requires: npm install garminconnect (dev dep; already in package.json if GC features exist)
 * Or uses direct HTTP with stored tokens.
 *
 * Output: overwrites lib/constants/garmin-activity-types.ts
 */

import { writeFileSync } from "fs";
import { join } from "path";

const email = process.env.GARMIN_EMAIL;
const password = process.env.GARMIN_PASSWORD;
if (!email || !password) {
  console.error("Set GARMIN_EMAIL and GARMIN_PASSWORD env vars");
  process.exit(1);
}

// Uses python-garminconnect-compatible auth or garth library
// Fetch: https://connect.garmin.com/modern/proxy/activity-service/activity/activityTypes
// ... auth implementation ...

const types: GarminActivityType[] = await fetchActivityTypes(email, password);

const content = `// AUTO-GENERATED by scripts/fetch-garmin-activity-types.ts
// Last fetched: ${new Date().toISOString().slice(0, 10)}
// Do not edit manually. Run: npx tsx scripts/fetch-garmin-activity-types.ts

export interface GarminActivityType {
  readonly typeId: number;
  readonly typeKey: string;
  readonly parentTypeId: number;
  readonly isHidden: boolean;
}

export const GARMIN_ACTIVITY_TYPES: readonly GarminActivityType[] = ${JSON.stringify(types, null, 2)} as const;

export const GARMIN_TYPE_KEY_SET = new Set(GARMIN_ACTIVITY_TYPES.map(t => t.typeKey));
`;

writeFileSync(join(process.cwd(), "lib/constants/garmin-activity-types.ts"), content);
console.log(`Written ${types.length} activity types.`);
```

The script is **not wired into `package.json` scripts** — it is run manually
by a developer with Garmin credentials when Garmin publishes new activity
types (typically when a new device launches). A comment at the top of the
snapshot file documents the refresh command.

---

## 9. Open Questions

| # | Question | Proposed resolution |
|---|---|---|
| Q1 | Should `normalizeSportKey` write the canonical Garmin key back to DB on read (lazy migration) or only on explicit save? | Only on explicit save (when the form is submitted). No silent writes. |
| Q2 | Garmin `fitness_equipment` has very different children (strength training vs yoga vs meditation). Should modality be per-leaf everywhere? | Yes — via `LEAF_MODALITY_OVERRIDES`. Covered in §3.3. |
| Q3 | Should the selector include `isHidden: true` Garmin types? | No. Filter `isHidden === false` in the snapshot; the refresh script should emit only visible types. |
| Q4 | How to handle `null` sport in the generation gate at `jobs/route.ts:84`? | Unchanged — gate still requires sport to be non-null. Empty string and unknown keys still pass (resolver handles them in prompt). |
| Q5 | Should `boks` map to `boxing` — does Garmin have a `boxing` typeKey? | Verify in snapshot. If absent, `normalizeSportKey("boks")` → `"boxing"` → resolver returns `"other"` via fallback. Acceptable. |

---

## 10. Files Changed

| File | Change type | Notes |
|---|---|---|
| `lib/constants/garmin-activity-types.ts` | **NEW** | Build-time snapshot (~120 entries); managed by refresh script |
| `lib/constants/sport-taxonomy.ts` | **NEW** | Resolver, modality map, alias map, label helpers, selector groups |
| `scripts/fetch-garmin-activity-types.ts` | **NEW** | Manual refresh script — not in CI |
| `lib/constants/sports.ts` | Modify | Re-export `SPORTS` as alias of legacy keys; keep `Sport` type for backward compat with US-012 tests |
| `lib/constants/fitness-tests.ts` | Modify | Change `sports` field to `string[]`; use category-aware `isFitnessTestKeyAllowedForSport` |
| `lib/i18n/pl.ts` | Modify | Add `sportCategory.*` block; extend `sport.*` with ~30 Garmin key labels |
| `lib/ai/prompts/plan-generation.ts` | Modify | Replace raw slug with `getSportPromptDisplay(athlete.sport)` at line 165 |
| `components/coach/AthleteProfileForm.tsx` | Modify | Grouped `<optgroup>` selector; `normalizeSportKey` on defaultValues |
| `components/coach/AthleteCard.tsx` | Modify | `normalizeSportKey` + `getSportLabel` for display |
| `components/athlete/AthleteProfileView.tsx` | Modify | Same display pattern |
| `lib/validation/athlete.ts` | Modify | Soft validation: warn if unknown key (no hard reject for forward-compat) |
| `tests/unit/lib/constants/sport-taxonomy.test.ts` | **NEW** | Resolver (known keys, unknown key → "other"), modality, aliases |
| `tests/unit/lib/constants/fitness-tests.test.ts` | Modify | Update sport keys to Garmin typeKeys; add category-match cases |
| `tests/unit/components/coach/AthleteCard.test.tsx` | Modify | Assert label for legacy keys + Garmin keys |
| — | **No DB migration** | |

---

## 11. Testing Strategy

### Unit — `tests/unit/lib/constants/sport-taxonomy.test.ts` (new)

```
describe("resolveSportCategory")
  ✓ trail_running → "running"
  ✓ strength_training → "fitness_equipment"
  ✓ soccer → "team_sports" (or "other" — verify in snapshot)
  ✓ unknown_future_sport → "other"
  ✓ root category resolves to itself (running → "running")
  ✓ does not throw for any input

describe("resolveSportModality")
  ✓ trail_running → "endurance"
  ✓ strength_training → "strength"
  ✓ yoga → "skill" (leaf override, not parent "strength")
  ✓ soccer → "mixed"
  ✓ unknown → "mixed"

describe("normalizeSportKey")
  ✓ "pilka_nozna" → "soccer"
  ✓ "inne" → "other"
  ✓ "trail_running" → "trail_running" (pass-through)
  ✓ null → null
  ✓ undefined → null

describe("getSportPromptDisplay")
  ✓ "trail_running" → "Bieganie po szlakach (wytrzymałość)"
  ✓ null → "ogolny fitness"
  ✓ "unknown_xyz" → "Unknown Xyz (mieszana)"
```

### Unit — `tests/unit/lib/ai/plan-generation-prompt.test.ts`

Add: verify prompt string includes readable sport + modality, not raw slug.

### Integration — existing `athletes/route.test.ts`

Add: PATCH with Garmin typeKey saves correctly; PATCH with legacy key saves correctly.
