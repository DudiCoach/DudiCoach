---
name: sync-peaklab
description: "Plan and report drift between PeakLab UI (Next.js frontend at /home/hypeit/repos/private/peaklab-ui, branch testing) and CPET engine (FastAPI backend at /home/hypeit/repos/expereo/private/cpet-engine, branch test). Compares API contracts, TypeScript types vs Pydantic models, frontend pages vs backend routes, and client-side vs server-side calculations. Use when: user asks to sync peaklab repos, compare UI and backend, find API/type drift, plan cross-repo features, or audit contract mismatches."
---
## DudiCoach Context

- **Cross-project reference only.** This skill targets PeakLab UI + CPET engine repos (`/home/hypeit/...`), which are unrelated to DudiCoach.
- **Do not use for DudiCoach work.** Included for consistency with the global skill set.


# Sync PeakLab — UI ↔ Backend Contract Sync

Compare the PeakLab Next.js frontend with the CPET FastAPI backend and plan implementation of missing features or contract drift.

## Steps

### 1. Pull Latest Changes
Fetch both repos (do NOT auto-pull — just report status):
- `cd /home/hypeit/repos/private/peaklab-ui && git fetch --all --prune && git status`
- `cd /home/hypeit/repos/expereo/private/cpet-engine && git fetch --all --prune && git status`

Report ahead/behind for `testing` (peaklab-ui) and `test` (cpet-engine).

### 2. Compare API Contracts: TypeScript ↔ FastAPI
Read the frontend API caller:
  `/home/hypeit/repos/private/peaklab-ui/src/lib/api.ts`

Read the backend route files:
  `/home/hypeit/repos/expereo/private/cpet-engine/api/routes/lab.py`
  `/home/hypeit/repos/expereo/private/cpet-engine/api/routes/my.py`
  `/home/hypeit/repos/expereo/private/cpet-engine/api/routes/org.py`
  `/home/hypeit/repos/expereo/private/cpet-engine/api/routes/analyze.py`
  `/home/hypeit/repos/expereo/private/cpet-engine/api/routes/calculator.py`
  `/home/hypeit/repos/expereo/private/cpet-engine/api/routes/protocols.py`
  `/home/hypeit/repos/expereo/private/cpet-engine/api/routes/supplementary.py`
  `/home/hypeit/repos/expereo/private/cpet-engine/api/routes/training_plans.py`
  `/home/hypeit/repos/expereo/private/cpet-engine/api/routes/auth.py`

Cross-reference and list:
- Endpoints called by frontend but **missing from backend** (404 risk)
- Endpoints exposed by backend but **never called by frontend** (backend-only / dead feature)
- Method/path mismatches (e.g., frontend sends POST but backend expects PUT)

### 3. Compare Type Models: TypeScript ↔ Pydantic
Read frontend types:
  `/home/hypeit/repos/private/peaklab-ui/src/lib/types.ts`
  `/home/hypeit/repos/private/peaklab-ui/src/lib/calc-types.ts`
  `/home/hypeit/repos/private/peaklab-ui/src/lib/training-plan-types.ts`

Read backend models:
  `/home/hypeit/repos/expereo/private/cpet-engine/api/models/requests.py`
  `/home/hypeit/repos/expereo/private/cpet-engine/api/models/responses.py`

List:
- Backend Pydantic models with **no matching TypeScript interface**
- TypeScript interfaces with fields **missing or extra** vs backend schema
- Enum value drift between TS and Python (e.g., new `TestType` variants)

### 4. Compare Frontend Pages vs Backend Feature Surface
Read frontend pages in:
  `/home/hypeit/repos/private/peaklab-ui/src/app/(athlete)/`
  `/home/hypeit/repos/private/peaklab-ui/src/app/(lab)/`
  `/home/hypeit/repos/private/peaklab-ui/src/app/(coach)/`  (if exists)

Cross-reference with backend route capabilities. Identify:
- Backend features with **no UI exposure** (e.g., supplementary reports, batch processing, org management)
- Pages with no corresponding backend endpoint

### 5. Compare Client-Side vs Server-Side Calculations
Read frontend calculation libraries:
  `/home/hypeit/repos/private/peaklab-ui/src/lib/interval-formulas.ts`
  `/home/hypeit/repos/private/peaklab-ui/src/lib/critical-power.ts`
  `/home/hypeit/repos/private/peaklab-ui/src/lib/substrate-formulas.ts`
  `/home/hypeit/repos/private/peaklab-ui/src/lib/kinetics-formulas.ts`
  `/home/hypeit/repos/private/peaklab-ui/src/lib/race-formulas.ts`
  `/home/hypeit/repos/private/peaklab-ui/src/lib/environment-formulas.ts`

Read backend equivalents:
  `/home/hypeit/repos/expereo/private/cpet-engine/engine_core.py`
  `/home/hypeit/repos/expereo/private/cpet-engine/mlss_analyzer.py`
  `/home/hypeit/repos/expereo/private/cpet-engine/kinetics_analyzer.py`
  `/home/hypeit/repos/expereo/private/cpet-engine/lactate_kinetics_v2.py`
  `/home/hypeit/repos/expereo/private/cpet-engine/sprint_wingate_analyzer.py`
  `/home/hypeit/repos/expereo/private/cpet-engine/physio_analysis.py`

Flag formulas implemented **twice** — client-side and server-side. Risk of drift; recommend single source of truth.

### 6. Scan Recent Commits
Run in each repo:
```
cd /home/hypeit/repos/private/peaklab-ui && git log --oneline -20
cd /home/hypeit/repos/expereo/private/cpet-engine && git log --oneline -20
```

Identify commits that suggest contract changes: new endpoints, model edits, breaking renames. Also check for open PRs:
```
gh pr list --repo mateuszkozako/peaklab-ui --state open
gh pr list --repo mateuszkozako/cpet-engine --state open
```

### 7. Generate Gap Report

Produce a structured table:

| Category | Backend | Frontend | Status | Priority | Effort |
|----------|---------|----------|--------|----------|--------|
| API endpoint | `POST /lab/tests/{id}/thresholds/commit` | `api.ts:928` — found | Synced | — | — |
| API endpoint | `GET /supplementary/...` | (not called) | Backend-only | P1 | M |
| Type drift | `LabTestResponse.notes` | (missing in TS) | Schema gap | P2 | S |
| Double impl | `critical_power.ts` ↔ `engine_core.py` | — | Drift risk | P2 | L |
| ... | ... | ... | ... | ... | ... |

Priority: P0 critical / P1 high / P2 medium / P3 low
Effort: S < 1h / M 1-4h / L 4-8h / XL > 8h

### 8. Plan Implementation (P0/P1 gaps only)
For each P0/P1 gap, create a plan:
- Exact files to modify in both repos
- Branch to commit on (`test` for cpet-engine, `testing` for peaklab-ui)
- Push constraints: `gh auth switch --user hypeitnow` before pushing peaklab-ui
- Pre-commit hooks for cpet-engine: ruff + black enforced; use `--no-verify` only for merge commits
- Tests to add (`tests/` for backend, `vitest` for UI)
- Memory Bank reminder: update `activeContext.md` + `progress.md` after any code changes

### 9. Argument Filter
If the user's request contains a feature name (e.g. `thresholds`, `supplementary`, `training-plans`, `kinetics`, `analytics`), filter all above steps to focus only on that feature's endpoints, types, pages, and calculations.

## Output
Present the gap report and implementation plan. **Do NOT implement anything** — this is a planning-only command.
Wait for the user to approve the plan before any code changes.

## Constraints
- Push only to `test` (cpet-engine) and `testing` (peaklab-ui) — never `main`/`master`
- peaklab-ui push: run `gh auth switch --user hypeitnow` first
- cpet-engine pre-commit: ruff + black enforced; use `--no-verify` only for merge commits
- After any code changes: update Memory Bank at `/home/hypeit/Documents/codex-memory/` and push to branch `codex`

## Note
The user can also invoke this same workflow via the slash command `/sync-peaklab [feature]` in the OpenCode command palette.