# E2E Handbook (US-001 to US-005)

## Scope

Current Playwright suite covers:
- `smoke.spec.ts` -> US-001 + US-002
- `US-003.spec.ts` -> coach athlete CRUD frontend
- `US-004.spec.ts` -> share code panel + realtime
- `US-005.spec.ts` -> AI plan generation
- `US-011.spec.ts` -> injuries tab CRUD + public active-only injuries view
- `US-025.spec.ts` -> public plan endpoint + athlete panel plan viewer (production smoke, fixture-gated)

## US-025 production smoke (G9 closeout)

`tests/e2e/US-025.spec.ts` verifies the public plans API and the plan viewer
against a deployed environment. Plan generation runs through the AI pipeline,
so fixtures are synthetic athletes prepared out-of-band (service-role seed)
and deleted after the run:

- `E2E_US025_PLAN_SHARE_CODE` — active code, synthetic athlete with **two**
  plans (newest = `E2E_US025_EXPECTED_PLAN_ID`)
- `E2E_US025_EMPTY_SHARE_CODE` — active code, no plans
- `E2E_US025_INACTIVE_SHARE_CODE` — inactive code that owns a plan
- `E2E_US025_RETIRED_SHARE_CODE` — well-formed code that no longer resolves
- `E2E_US025_EXPECTED_PLAN_ID` — id of the newest plan
- `E2E_US025_OLDER_PLAN_NAME` (optional) — older plan name, asserted absent

All codes must be uppercase, distinct and match `^[A-HJ-NP-Z2-9]{6}$`. The
spec fails hard in CI when the plan fixture is missing. Codes are bearer
credentials — never commit them; keep trace/screenshot/video disabled (the
spec forces them off).

## Required Environment Variables

Set in local `.env.local` or CI secrets:

```bash
PLAYWRIGHT_BASE_URL=https://<preview-or-staging-url>
E2E_COACH_EMAIL=<test-coach-email>
E2E_COACH_PASSWORD=<test-coach-password>
```

Optional:

```bash
E2E_ALLOW_AI_CALL=1
```

`E2E_ALLOW_AI_CALL=1` enables the live Anthropic happy-path test in `US-005.spec.ts`.

## Skip Rules

- Without `E2E_COACH_EMAIL` + `E2E_COACH_PASSWORD`, authenticated scenarios are skipped by design.
- Without `E2E_ALLOW_AI_CALL=1`, the live AI happy path stays skipped by design.

## Local Run

```bash
npm run test:e2e
```

PowerShell example:

```powershell
$env:PLAYWRIGHT_BASE_URL = "https://<deployment>.vercel.app"
$env:E2E_COACH_EMAIL = "coach@example.com"
$env:E2E_COACH_PASSWORD = "<password>"
npm run test:e2e
```

## CI Run

1. Add secrets:
   - `PLAYWRIGHT_BASE_URL`
   - `E2E_COACH_EMAIL`
   - `E2E_COACH_PASSWORD`
2. Run `npm run test:e2e`.
3. Keep traces/screenshots/videos only for failures (configured in Playwright).

## Latest Snapshot (2026-04-15)

- Preview on PR #6 is healthy (`/` and `/login` return 200).
- Full authenticated flows are still blocked by missing coach credentials in the local environment.
- Unauthenticated US-004 invalid-code checks pass on desktop and mobile.
- US-011 spec is present and runnable; without `E2E_COACH_*` it reports `4 skipped` by design.
