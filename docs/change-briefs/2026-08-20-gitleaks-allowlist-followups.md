# Change Brief: gitleaks allowlist + stabilization follow-ups docs (2026-08-20)

**Lane:** C (secret-scanning control change — G7 mandatory)
**Status:** for review

## Problem

1. Full-history secret scan (`workflow_dispatch` → `secret-scan` job) fails on two
   non-secret findings, producing a red job and a SARIF artifact for every manual scan.
   Alarm noise hides future real findings.
2. Operator-blocked stabilization steps (peaklab rotation, runtime truth, G9
   US-014/US-026, E2E preview activation) have no single consolidated runbook with
   today's evidence.
3. Athlete Context PR2 (structured session outcomes) has no repo-side planning artifact
   to unblock the next-epic decision.

## Evidence

- Run #32406808451 (2026-08-20, workflow_dispatch on main): `secret-scan` failed,
  "leaks found: 2", 136 commits scanned. Findings:
  1. `tests/integration/internal/plan-jobs-worker-route.test.ts:36`
     (gitleaks-reported line; the value sits in CLAIMED_JOB at line 59; commit
     6c929a77042d6282c4d7a1785f2b28ca2413e04f) — synthetic test fixture
     `claim_token: "9f7e4b80-4f79-470c-8371-89f0ed75e91f"` next to
     `job-uuid-001`/`athlete-uuid-001`/`coach-uuid-001`. `claim_token` is an opaque
     string in `app/api/internal/plans/jobs/run/route.ts`; value is a UUID-shaped
     dummy. NOT a credential.
  2. `docs/design/US-026-async-plan-generation-design.md:882`
     (commit 8f813303a047bc3753fb6a3315cd5adc65d3246f) — sequence-diagram placeholder
     `Worker->>DB: rpc('fail_plan_job', jobId, token, 'anthropic_5xx', ...)`. The word
     `token` is a variable name in a diagram; no value present. NOT a credential.
- The `peaklab` credential (PR #69) was NOT among findings — consistent with the
  audit: PR #69 commits are not in reachable history; rotation + GitHub Support purge
  remain the remediation (incident doc).
- Today's evidence: forks = 0; GitHub secret-scanning alerts = 0; `gcloud` not
  installed; `vercel whoami` → "specified token is not valid" (logged out); no
  `~/.supabase/access-token`; env vars `VERCEL_TOKEN`/`SUPABASE_ACCESS_TOKEN`/
  `SUPABASE_DB_PASSWORD` absent; repo secrets present: `FIREBASE_SERVICE_ACCOUNT_DUDICOACH_APP`,
  `PLAN_JOBS_WORKER_SECRET`; repo variables: none (so `E2E_ENABLED` unset, e2e-preview
  skipped as designed).

## Root cause hypothesis

gitleaks `generic-api-key` rule fires on (a) UUID-shaped values in test fixtures and
(b) the word `token` inside diagram text with entropy > threshold. Both are
static-analysis false positives, verified by inspection of the exact lines.

## Affected surfaces

- `.github/workflows/ci.yml` — no change; the allowlist config is auto-discovered by
  gitleaks-action@v3.
- NEW `.gitleaks.toml` — global exact-value allowlist for the two verified values (NOT
  path-scoped, so the rest of both files stays fully scanned).
- NEW `docs/runbook/stabilization-followups.md` — operator runbook (steps 1-4) with
  evidence table.
- NEW `docs/design/US-022-structured-session-outcomes.md` — PR2 planning + ID
  canonicalization + open owner decisions.

## Scope / out of scope

- IN: allowlist config, runbook doc, US-022 planning doc.
- OUT: peaklab rotation itself (user, no gcloud/token here), runtime truth changes
  (operator), G9 execution (operator), E2E activation (operator), any product code.

## Required gates

G1 (this brief), G3, G5 (CI: secret-scan PR-scoped PASS + dispatch scan PASS on main
after merge), G6 (independent code review), G7 (security review — mandatory: secret
scanning control change).

## Tests / checks

- PR push: `secret-scan` job (PR-scope) must PASS with the allowlist config.
- After merge: `workflow_dispatch` on main → full-history scan must PASS.
- lint/typecheck/test/build unaffected (docs + config only).

## Security / privacy

- Allowlist is regex-scoped to two verified non-secrets; risk of a future real secret
  in those exact lines is minimal and documented.
- No secrets are logged or written; the runbook contains no credential values.

## Rollback

- Revert `.gitleaks.toml` (remove file) → default gitleaks behavior restored.
- Docs are additive; no rollback impact.

## Definition of done

- `.gitleaks.toml` present with evidence-backed allowlist; PR secret-scan PASS;
  dispatch scan PASS on main; runbook + planning docs committed; G6/G7 approved; merged.