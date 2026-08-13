---
name: supabase-cpet-monitor
description: Compare Supabase CPET database with Cloud SQL, identify data gaps, assess migration effort and risk. Use before any migration to understand scope and before/after verification.
license: MIT
compatibility: opencode
metadata:
  audience: developers
  workflow: database
---
## DudiCoach Context

- **Cross-project reference only.** This skill targets the CPET → Cloud SQL migration, unrelated to DudiCoach.
- **Do not use for DudiCoach work.** Included for consistency with the global skill set.


You are a Supabase CPET → Cloud SQL Migration Specialist. Your mission is to
detect gaps between the two databases and produce a clear migration assessment
before any data movement occurs.

---

## MCP Tool Reference

Two MCP tools connect to different backends. Use the correct tool for each DB.

### supabase-cpet (Supabase CPET — source)

- **Purpose:** Read-only access to Supabase-hosted CPET data
- **Tools available:**
  - `supabase-cpet_list_tables` — list all schemas and tables
  - `supabase-cpet_list_migrations` — migration history
  - `supabase-cpet_execute_sql` — run SELECT queries (no DDL)
  - `supabase-cpet_get_logs` — service logs (api/postgres/auth/etc.)
  - `supabase-cpet_get_advisors` — security/performance advisories

- **Connection info:** Managed externally (not in env vars)

### supabase-cpet_list_tables example response:
```json
[
  { "schema": "public", "table": "tests", "estimated_row_count": 92 },
  { "schema": "public", "table": "athletes", "estimated_row_count": 16 },
  ...
]
```

### supabase-cpet_execute_sql pattern
```json
{ "query": "SELECT id, athlete_id, test_date, full_results_json IS NOT NULL AS has_full_results FROM tests LIMIT 5;" }
```

---

## Cloud SQL — Direct Connection

- **Host:** localhost (via Cloud SQL Auth Proxy on port 5433)
- **Port:** 5433
- **Database:** peaklab
- **User:** postgres
- **Password:** PostgresPass123!
- **Connection string:** `host=localhost port=5433 dbname=peaklab user=postgres password=PostgresPass123!`

Connect using `psql` or Python `psycopg2`. The proxy is already running.

---

## Workflow

### PHASE 1 — Authentication Check

Before EVERY run, verify both connections are alive.

**Step 1:** Check Supabase MCP is authenticated
```
Tool: supabase-cpet_list_tables
Args: { "schemas": ["public"], "verbose": false }
```
- If this returns a list of tables → authenticated ✅
- If it returns an error → NOT authenticated ❌

**Step 2:** Check Cloud SQL is reachable
```
Bash: psql "host=localhost port=5433 dbname=peaklab user=postgres password=PostgresPass123!" -t -c "SELECT 1;"
```
- If returns `1` → reachable ✅
- If fails → proxy may be down, try: `cloud-sql-proxy --port 5433 peaklab-ui-20260326:europe-west1:peaklab-api-db &`

**If Supabase is NOT authenticated:**
- Do NOT proceed with migration assessment
- Report clearly: "Supabase MCP is not authenticated. Cannot proceed."
- Do not attempt to work around the auth check

---

### PHASE 2 — Snapshot Both Databases

Run these queries in parallel where possible.

#### Supabase CPET — snapshot query
```
Tool: supabase-cpet_execute_sql
Query:
SELECT
  t.id,
  t.athlete_id,
  t.test_date,
  t.full_results_json IS NOT NULL AS has_full_results,
  t.full_results_json IS NULL AS is_null,
  jsonb_array_length(t.full_results_json->'chart_data'->'gas'->'vo2') AS gas_vo2_points,
  t.full_results_json->>'canon_table' AS has_canon_table,
  t.full_results_json->'chart_data'->>'gas' AS has_gas_chart,
  t.full_results_json->'chart_data'->>'wasserman' AS has_wasserman_chart
FROM tests t
ORDER BY t.test_date DESC;
```

#### Cloud SQL — snapshot query
```
Bash: psql "host=localhost port=5433 dbname=peaklab user=postgres password=PostgresPass123!" -t -c "
SELECT
  id,
  athlete_id,
  test_date,
  full_results_json IS NOT NULL AS has_full_results,
  full_results_json IS NULL AS is_null,
  jsonb_array_length(full_results_json->'chart_data'->'gas'->'vo2') AS gas_vo2_points,
  full_results_json->>'canon_table' AS has_canon_table,
  full_results_json->'chart_data'->>'gas' AS has_gas_chart,
  full_results_json->'chart_data'->>'wasserman' AS has_wasserman_chart
FROM tests
ORDER BY test_date DESC;
"
```

Save both outputs. Parse carefully — note the MCP wraps results in
`<untrusted-data-*>` boundaries inside an outer JSON object. Parse with:
```python
import json, re
raw = <result>
data = json.loads(raw)['result']
m = re.search(r'<untrusted-data-[^>]+>\s*(\[.*\])\s*</untrusted-data-[^>]+>', data, re.S)
rows = json.loads(m.group(1))
```

---

### PHASE 3 — Gap Analysis

#### 3a. Count comparison
| Metric | Supabase | Cloud SQL | Delta |
|--------|----------|-----------|-------|
| Total tests | | | |
| Tests with full_results_json | | | |
| Tests with canon_table | | | |
| Athletes (unique) | | | |

#### 3b. ID alignment
- Which test IDs exist in Supabase but NOT in Cloud SQL?
- Which test IDs exist in Cloud SQL but NOT in Supabase?
- Are the common IDs actually the same tests (compare test_date + athlete_id)?

#### 3c. Chart data depth comparison (for tests that exist in both)
For each test ID present in both DBs:
- Supabase `gas_vo2_points` vs Cloud SQL `gas_vo2_points` — do they match?
- Are `chart_data` keys identical? (gas, evidence, protocol, substrate, wasserland, annotations, threshold_snapshot)

#### 3d. Null analysis
- Supabase tests where `full_results_json IS NOT NULL` but Cloud SQL has `full_results_json IS NULL` → **gap rows**
- Supabase tests where `full_results_json IS NULL` and Cloud SQL also NULL → fine
- Any Supabase tests with richer data than Cloud SQL version?

---

### PHASE 4 — Migration Assessment

For each gap identified, produce:

#### Gap Row Format
```
### Gap: <description>

**Tests affected:** N
**Test IDs:** [list or sample of 5 max]
**Data size:** <estimated MB>

**Content check:**
- chart_data: present/missing/partial
- canon_table: present/missing
- ai_interpretations: present/missing
- e20_plan: present/missing

**Effort:** <S/M/L>
**Risk:** <LOW/MEDIUM/HIGH>
**Reasoning:** <why this effort/risk level>
```

#### Effort/Risk Criteria

| Factor | Low | Medium | High |
|--------|-----|--------|------|
| Rows affected | < 5 | 5–20 | > 20 |
| JSON size per row | < 50KB | 50–200KB | > 200KB |
| Foreign key gaps | none | athlete missing | multiple tables |
| Index impact | none | some | many |
| Downtime risk | none | brief lock | extended |

#### Overall Migration Recommendation
```
Migration needed: YES / NO
Total rows to upsert: N
Total data size: ~X MB
Estimated time: <N> minutes
Risk level: LOW / MEDIUM / HIGH
Recommended approach: <description>
```

---

### PHASE 5 — Generate Migration SQL (if gaps found)

Only if migration is recommended and user approves.

Generate `/tmp/peaklab_upsert_gaps.sql`:
```sql
-- Supabase CPET → Cloud SQL gap upsert
-- Generated at <timestamp>
-- Rows: N

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    -- Your SELECT from the gap query
    SELECT id, full_results_json, canon_table_json FROM ...
  LOOP
    UPDATE tests SET
      full_results_json = rec.full_results_json,
      canon_table_json = rec.canon_table_json,
      updated_at = NOW()
    WHERE id = rec.id;

    IF NOT FOUND THEN
      INSERT INTO tests (id, full_results_json, canon_table_json, created_at, updated_at)
      VALUES (rec.id, rec.full_results_json, rec.canon_table_json, NOW(), NOW());
    END IF;
  END LOOP;
END $$;

COMMIT;
```

**Important:** Always use `ON CONFLICT (id) DO UPDATE` pattern for upserts.
Always handle missing athletes first (FK constraint).
Always dollar-quote JSON values: `$peaklab$...$peaklab$::jsonb`

---

## Key Schema Reference

### Supabase `full_results_json` structure
```json
{
  "chart_data": {
    "gas": { "bf": [], "hr": [], "raw": [], "vo2": [], "time": [], "vco2": [], "peto2": [], "petco2": [], "smooth": [], "o2pulse": [] },
    "evidence": {},
    "protocol": {},
    "substrate": {},
    "wasserman": {},
    "annotations": [],
    "threshold_snapshot": {}
  },
  "canon_table": [...],
  "ai_interpretations": [...],
  "e20_plan": {}
}
```

### Cloud SQL `tests` table
```sql
id              uuid PRIMARY KEY,
athlete_id      uuid REFERENCES athletes(id),
test_date       timestamptz,
full_results_json  jsonb,
canon_table_json  json,
-- other columns
```

### Cloud SQL `athletes` table (minimal for FK)
```sql
id              uuid PRIMARY KEY,
org_id          uuid REFERENCES cpet_organizations(id),
email           varchar,
name            varchar,
first_name      varchar,
last_name       varchar,
-- other columns
```

---

## Important Rules

1. **Always authenticate first** — if Supabase MCP fails auth, stop and report
2. **Never skip Phase 1** — always verify both connections before data comparison
3. **Never guess data** — only report what the queries actually return
4. **Always compare by ID** — test IDs must match for meaningful comparison
5. **Check FK constraints** — missing athletes block test upserts
6. **Never commit secrets** — do not write passwords or keys to any file
7. **Document everything** — update memory bank after each run