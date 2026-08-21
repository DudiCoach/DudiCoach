#!/usr/bin/env bash
# Sprint 0 operator remediation — prepared by agent, run by owner/operator WITH credentials.
# This script only inspects by default. Set MUTATE=1 to run state-changing commands.
# Do NOT paste secrets here; supply them via your shell environment or tool login.
# Required before mutation steps:
#   gcloud auth login (and set project), supabase login, vercel login
#   export SUPABASE_PROJECT_REF=<your-project-ref>   # for S0-3
#   <INSTANCE> placeholder below must be replaced with your Cloud SQL instance id
set -euo pipefail

: "${MUTATE:=0}"

echo "== Prereqs =="
for t in gcloud supabase vercel gh; do
  command -v "$t" >/dev/null 2>&1 && echo "  $t: ok" || echo "  $t: MISSING (install + login required)"
done

echo
echo "== S0-1 peaklab rotation (Google Cloud SQL) =="
if [ "$MUTATE" = "1" ]; then
  # Replace <INSTANCE> and supply a STRONG new password via prompt or secret manager.
  # gcloud sql users set-password peaklab --instance=<INSTANCE> --password="$(cat)"
  echo "  [MUTATE] run: gcloud sql users set-password peaklab --instance=<INSTANCE> --password=***"
  echo "  Then: confirm old password rejected, review Cloud SQL logs since 2026-08-13, verify no reuse."
else
  echo "  [dry-run] gcloud sql users list --instance=<INSTANCE>"
fi

echo
echo "== S0-3 Supabase reconciliation =="
if [ "$MUTATE" = "1" ]; then
  supabase link --project-ref "$SUPABASE_PROJECT_REF"
  supabase db pull || true
  echo "  Inspect direct DML grants for anon/authenticated on plan_session_feedback and remove them (RPC-only access)."
  echo "  Verify all 21 migration versions match local supabase/migrations."
else
  echo "  [dry-run] supabase link --project-ref \$SUPABASE_PROJECT_REF"
  echo "  [dry-run] supabase db remote commit --dry-run"
  echo "  [dry-run] inspect: SELECT * FROM information_schema.role_table_grants WHERE table_name='plan_session_feedback';"
fi

echo
echo "== S0-5 Vercel runtime truth =="
if [ "$MUTATE" = "1" ]; then
  vercel env ls
  echo "  Verify NEXT_PUBLIC_PLAN_GENERATION_MODE (Production+Preview), CRON_SECRET, PLAN_JOBS_WORKER_SECRET, tier, cron, Preview/Production isolation."
else
  echo "  [dry-run] vercel login && vercel env ls"
fi

echo
echo "== S0-2 GitHub purge PR #69 =="
echo "  No API available. File ticket at https://support.github.com/contact requesting history purge of PR #69 commits (credential exposure). Owner action required."

echo
echo "== S0-6 E2E Preview activation =="
echo "  Set GitHub repo variable E2E_ENABLED=true + secrets E2E_COACH_EMAIL / E2E_COACH_PASSWORD / PLAYWRIGHT_BASE_URL (throwaway coach account, preview-only). Then CI e2e-preview runs."

echo
echo "Done (inspection only unless MUTATE=1)."
