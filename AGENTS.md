# AGENTS.md

`docs/engineering-policy.md` is the primary and authoritative source of truth.
If this file conflicts with policy, follow `docs/engineering-policy.md`.

Core behavioral rules:
1. Don’t assume. Don’t hide confusion. Surface tradeoffs.
2. Minimum code that solves the problem. Nothing speculative.
3. Touch only what you must. Clean up only your own mess.
4. Define success criteria. Loop until verified.

Codex wrapper rules:
- Classify lane (A/B/C) before any work and before file edits.
- Keep changes small, reversible, and auditable.
- Prohibit unrelated changes outside approved scope.
- Do not claim tests/CI/runtime/security verification without evidence.
- Use Change Brief + required gates from `docs/engineering-policy.md`.

## OpenCode Agents

Repo-local opencode config in `opencode.json` defines three agents:

| Agent | Model | Reasoning | Edit | Bash | Role |
|-------|-------|-----------|------|------|------|
| `plan` | openai/gpt-5.6-sol | xhigh | deny | ask | Planning, architecture, scope definition |
| `tester` | opencode/nemotron-3-ultra-free | high | allow | allow | Test writing + running, coverage verification |
| `build` | opencode/mimo-v2.5-free | — | allow | allow | Code generation, edits, implementation |

### Agent Workflow

```
plan (read-only, xhigh reasoning)
  → tester (write tests, run tests, report evidence)
  → build (write production code, fix bugs)
  → tester (re-run tests, verify fix)
  → plan (review, approve)
```

The `tester` agent sits between planner and builder:
- **Higher reasoning than build** (high vs none) — analyzes code and designs test cases
- **Lower reasoning than plan** (high vs xhigh) — focused on execution, not over-analysis
- **Edit access** — writes test files only (`tests/**`, `qa/**`); never production code
- **Bash access** — runs `npm run test`, `npx vitest`, `npx playwright test`
- **Free model** — Nemotron 3 Ultra Free, no API cost

## OpenCode Skills

Repo-local skills live in `.opencode/skills/`. These are adapted from the
global `~/.opencode/skills/` and tailored for DudiCoach's stack
(Next.js + Supabase + Firebase + Vitest + Playwright).

### Skill ↔ Agent Mapping

Skills complement the existing `.claude/agents/` and `.codex/agents/`:

| Skill | Claude Agent | Codex Agent | SDLC Gate | Opencode Agent |
|-------|-------------|------------|-----------|---------------|
| systematic-debugging | — | — | All lanes, debugging | plan, tester |
| verification-before-completion | — | — | All lanes, before Done | tester, plan |
| dudicoach-tester | qa-dev, qa-test | qa-dev, qa-test | G5 | tester |
| pr-review | code-reviewer | code-reviewer | G6 | plan |
| security-auditor | security | security | G7 | plan |
| git-workflow-master | devops | devops-release | Branch mgmt | build |
| requesting-code-review | code-reviewer | code-reviewer | G6 prep | build |
| receiving-code-review | developer-* | frontend/backend | Post-review | build |
| git-mr-reviewer | — | — | MR/PR audit | plan |
| cicd-pipeline | devops | devops-release | CI/CD setup | build |
| cicd-automation-workflow-automate | devops | devops-release | Workflow design | build |
| devops-automation | devops | devops-release | Infra automation | build |
| cloud-architect | architect | architect | G2 (infra) | plan |
| python-expert | — | — | Python scripts | build |
| python-specialist | — | — | Python scripts | build |
| writing-skills | — | — | Meta: create skills | plan |
| memory-bank-manager | — | — | Context persistence | plan |
| sync-repos | — | — | Memory bank sync | plan |
| sync-peaklab | — | — | Cross-project ref | — |
| supabase-cpet-monitor | — | — | Cross-project ref | — |
| hallmark | ui-reviewer | ui-reviewer | G4 (UI design) | build |

### How to Use Skills

Skills are loaded automatically by opencode when their `description`
matches the task context. To manually invoke a skill:

```
Use the [skill-name] skill to [task description].
```

### Skill Priority

1. `docs/engineering-policy.md` — authoritative policy (always wins)
2. `.claude/agents/` and `.codex/agents/` — agent-specific instructions
3. `.opencode/skills/` — reusable technique guidance
4. `CLAUDE.md` — Claude wrapper rules

If a skill conflicts with the engineering policy or an agent's instructions,
follow the higher-priority source.