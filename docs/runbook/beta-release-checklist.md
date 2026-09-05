# Beta Release Checklist

Created: 2026-09-05
Target: 12 October 2026 (conditional go/no-go)

## Done (verified)

- [x] Worker trigger: `.github/workflows/plan-worker.yml` — cron `*/5` POST to production
- [x] Supabase Preview fix: `[storage.vector] enabled = false`
- [x] CI: 6/6 required checks pass (lint, typecheck, test, build, secret-scan, supabase-db)
- [x] flush() integration in navigation components (forwardRef + handleTabChange)
- [x] US-012 test drift fix (selectors: `#fitness-test-key`, `#fitness-test-value`, `#fitness-test-date`)
- [x] Clipboard fallback: `lib/utils/clipboard.ts` + 4 unit tests
- [x] Destructive action audit: all 5 paths confirmed guarded
- [x] Accessibility: axe-core login page passes (0 critical/serious)
- [x] 620 tests pass, lint/typecheck/build green

## Pending — manual (requires dashboard access)

### E2E Secrets (GitHub repo)

Set in **Settings → Secrets and variables → Actions**:

```
E2E_COACH_EMAIL=<throwaway preview coach email>
E2E_COACH_PASSWORD=<throwaway preview coach password>
PLAYWRIGHT_BASE_URL=<preview deployment URL>
```

Set repo **variable**:
```
E2E_ENABLED=true
```

Then re-run CI to activate the `e2e-preview` job.

### Vercel Env (Production + Preview)

Verify in Vercel Dashboard → Project → Settings → Environment Variables:

- [ ] `NEXT_PUBLIC_PLAN_GENERATION_MODE=async` — set explicitly (not default)
- [ ] `PLAN_JOBS_WORKER_SECRET` — present (same value as GitHub repo secret)
- [ ] `ANTHROPIC_API_KEY` — present
- [ ] `NEXT_PUBLIC_SUPABASE_URL` — present
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — present
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — present (server-only)
- [ ] `CRON_SECRET` — present (for legacy Vercel cron, if re-enabled later)

### G9 Runtime Smoke (Preview deployment)

After Preview deploy succeeds:

- [ ] Create plan → job `pending` → worker claims → `success`
- [ ] Create plan → worker error → retry → `success` or terminal `failed`
- [ ] Feedback submit (text + structured) as coach → athlete view
- [ ] No `5xx` or `20242883` in logs
- [ ] No private data in worker logs

### Full-history Secret Scan

- [ ] Actions → CI → Run workflow (trigger: `workflow_dispatch`, ref: `main`)
- [ ] Expected: PASS (2 verified findings allowlisted in `.gitleaks.toml`)
- [ ] If fails: download `gitleaks-results.sarif.zip`, triage each finding

### Privacy Decisions (block beta)

- [ ] Health data classification: wellbeing/pain = health data?
- [ ] AI consent: athlete consent for AI processing
- [ ] Retention/deletion/export periods
- [ ] Names in AI: omit names, send only dates for trend ordering
- [ ] Share-code abuse thresholds
- [ ] Incident response for share-code disclosure

### Operator Tasks

- [ ] Rotate `postgres` credential (peaklab) — requires `gcloud` access
- [ ] Production migration sync check — requires Supabase access
- [ ] Server-log review of G9 window — requires Vercel access

## Merge Order (stacked PRs)

1. **PR #89** (`feat/us-022-structured-outcomes`) — SQL migration + RPC v2
2. **PR #90** (`feat/us-022-api-feedback`) — API routes v2
3. **PR #91** (`feat/us-022-outcome-ui`) — UI components

All three have CI green. Admin merge required (branch protection).

## Beta Go/No-Go Criteria

All of the following must be true for beta:

1. All 3 stacked PRs merged to `main`
2. Vercel Production env verified
3. G9 runtime smoke passed on Preview
4. Privacy decisions documented
5. At least 1 credentialed E2E run passing on Preview
6. No critical/serious accessibility violations on key screens
7. Owner sign-off on beta scope (coach → plan → share → outcome → feedback)
