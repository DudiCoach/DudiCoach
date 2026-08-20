#!/usr/bin/env bash
# Migration replay + SQL/security verification for the athlete session
# outcome schema (PR1, Lane C).
#
# Phases:
#   1. Clean replay: all migrations applied to a fresh local Supabase DB,
#      then schema/ACL/RLS security assertions + full behavior matrix.
#   2a. Upgrade pre-check: a 17-migration DB seeded with a legacy row that is
#       valid under the legacy rule but fails the new POSIX trim rule MUST
#       reject the migration.
#   2b. Upgrade replay: a 17-migration DB with valid legacy data upgraded by
#       the two new migration files, then security + behavior + upgrade
#       assertions.
#
# Usage: bash scripts/verify-migrations.sh
# Requires: Docker engine running, supabase CLI resolvable via npx.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

SUPABASE="npx --yes supabase@2.114.0"

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker engine is not running" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q '^supabase_db_'; then
  echo "Starting local Supabase stack..."
  $SUPABASE start
fi

PROJECT_ID="$(sed -n 's/^project_id = "\(.*\)"/\1/p' supabase/config.toml)"
CONTAINER="supabase_db_${PROJECT_ID}"

run_sql() {
  docker exec -i "${CONTAINER}" psql -U postgres -d postgres -X -q \
    -v ON_ERROR_STOP=1 < "$1" >/dev/null
}

MIG_DIR="supabase/migrations"
OUTCOME_A="${MIG_DIR}/20260727120000_athlete_session_outcome_schema.sql"
OUTCOME_B="${MIG_DIR}/20260727120001_athlete_session_outcome_validate.sql"
TMP="$(mktemp -d)"
trap 'if [ -f "${TMP}/outcome_a.sql" ]; then mv "${TMP}/outcome_a.sql" "${OUTCOME_A}"; fi; if [ -f "${TMP}/outcome_b.sql" ]; then mv "${TMP}/outcome_b.sql" "${OUTCOME_B}"; fi; rm -rf "${TMP}"' EXIT

echo "== Phase 1: clean replay (all migrations on a fresh DB) =="
$SUPABASE db reset >/dev/null
run_sql tests/sql/fixtures/session-outcome-seed.sql
run_sql tests/sql/fixtures/session-outcome-seed-legacy-valid.sql
run_sql tests/sql/outcome-schema-security.sql
run_sql tests/sql/outcome-schema-behavior.sql
run_sql tests/sql/us014-feedback-rpc-gates.sql
run_sql tests/sql/fixtures/us010-diagnostics-seed.sql
run_sql tests/sql/us010-fms-gates.sql
run_sql tests/sql/fixtures/us013-load-progressions-seed.sql
run_sql tests/sql/us013-load-progressions-gates.sql
echo "   clean replay: PASS"

echo "== Phase 2a: upgrade pre-check rejects invalid legacy rows =="
mv "${OUTCOME_A}" "${TMP}/outcome_a.sql"
mv "${OUTCOME_B}" "${TMP}/outcome_b.sql"
$SUPABASE db reset >/dev/null
run_sql tests/sql/fixtures/session-outcome-seed.sql
run_sql tests/sql/fixtures/session-outcome-seed-legacy-invalid.sql
set +e
docker exec -i "${CONTAINER}" psql -U postgres -d postgres -X -q \
  -v ON_ERROR_STOP=1 < "${TMP}/outcome_a.sql" >/dev/null 2>"${TMP}/err.log"
status=$?
set -e
if [ "${status}" -eq 0 ] || ! grep -q 'invalid row' "${TMP}/err.log"; then
  echo "   FAIL: pre-check did not reject whitespace-only legacy feedback" >&2
  cat "${TMP}/err.log" >&2
  exit 1
fi
echo "   upgrade pre-check rejection: PASS"

echo "== Phase 2b: upgrade replay on a 17-migration DB with legacy data =="
$SUPABASE db reset >/dev/null
run_sql tests/sql/fixtures/session-outcome-seed.sql
run_sql tests/sql/fixtures/session-outcome-seed-legacy-valid.sql
docker exec -i "${CONTAINER}" psql -U postgres -d postgres -X -q \
  -v ON_ERROR_STOP=1 < "${TMP}/outcome_a.sql" >/dev/null
docker exec -i "${CONTAINER}" psql -U postgres -d postgres -X -q \
  -v ON_ERROR_STOP=1 < "${TMP}/outcome_b.sql" >/dev/null
run_sql tests/sql/outcome-schema-security.sql
run_sql tests/sql/outcome-schema-behavior.sql
run_sql tests/sql/outcome-upgrade-replay.sql
run_sql tests/sql/us014-feedback-rpc-gates.sql
run_sql tests/sql/fixtures/us010-diagnostics-seed.sql
run_sql tests/sql/us010-fms-gates.sql
run_sql tests/sql/fixtures/us013-load-progressions-seed.sql
run_sql tests/sql/us013-load-progressions-gates.sql
mv "${TMP}/outcome_a.sql" "${OUTCOME_A}"
mv "${TMP}/outcome_b.sql" "${OUTCOME_B}"
echo "   upgrade replay: PASS"

echo "MIGRATION VERIFICATION: ALL PASS"