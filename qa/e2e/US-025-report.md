---
story: US-025
agent: qa-test
stage: e2e
verdict: pass-production
date: 2026-08-18
---

# E2E Report — US-025 (G9 closeout: active-with-plan)

## Summary

Production runtime verification of the public plan endpoint and the athlete
panel plan viewer, run against the deployed app (`main@b7e9355`, production
Vercel deployment, production Supabase project `qpsgpfnqlbbrvawjeeaj`).

Result: **16 passed, 4 skipped by design, 0 failed** on Chromium
(Desktop Chrome) and Mobile Chrome (Pixel 7). All fixtures cleaned up and
verified unreachable after the run.

## Execution

```bash
npx playwright test tests/e2e/US-025.spec.ts --reporter=line
```

- `PLAYWRIGHT_BASE_URL` = production deployment URL
- 20 tests scheduled: 5 API-contract cases (desktop project only), 12 UI cases
  (desktop + mobile), 1 always-runnable malformed-code case per project
- 4 skipped = API-contract cases intentionally skipped on the mobile project
  (API shape is device-independent)

## Fixtures

Synthetic, ephemeral athletes created for this run only (service-role seed,
deleted immediately after):

| Fixture | State | Purpose |
|---|---|---|
| A | active, two plans (older + newest) | latest-plan behavior, exact public shape, UI rendering |
| B | active, zero plans | empty state (`{ data: null }`) |
| C | inactive, owns a plan | security gate hides existing plan data |
| D | retired code (rotated away from A) | well-formed code that no longer resolves |

All codes were bearer credentials for the fixtures only; they were not
committed anywhere, were not written to the report, and all four returned
404 after cleanup.

## Covered assertions

- API: exact five-field public shape (`id, plan_name, phase, plan_json,
  created_at`), newest plan selected (`id` matched the seeded newest plan,
  older plan absent), exact nested `plan_json` shape (weeks 1-4, days,
  exercises), no `athlete_id`/`coach_id`/`share_code` anywhere in the
  payload, codes never echoed, `{ data: null }` for empty, 404 + `Not found`
  for inactive and retired codes, 404 for malformed code.
- UI (desktop + mobile): plan header (name, phase badge, weekly overview,
  generated date), four week tabs, initial week 1, week switching swaps
  content, empty state (`Brak planu treningowego.`), 404 pages for inactive
  and retired codes, navigation HTTP statuses verified.

## Latency (endpoint)

30 anonymous probes against `GET /api/athlete/<fixture>/plans`:

```
n=30 errors=0 p50=485ms p99=732ms max=732ms
```

## Cleanup verification

- All fixture athletes and plans deleted (service role), row absence
  confirmed via direct query.
- Post-cleanup: all fixture and retired codes return HTTP 404.

## Residual limitations

- No Vercel/Supabase log access from this environment — server-side error
  log checks (`[GET /api/athlete/[shareCode]/plans] ... RPC error`,
  `[AthletePanelPage] plan RPC error`, 5xx, `42883`) were not observable.
  Manual verification steps: review Vercel function logs for the run window
  and Supabase logs for `42883`/5xx on the public RPCs.
- Lowercase code normalization was intentionally not re-tested end-to-end
  (covered by mocked integration tests in
  `tests/integration/athlete/plans-route.test.ts`).
- `trace`/`screenshot`/`video` capture is disabled for this spec so bearer
  codes cannot leak into artifacts.
