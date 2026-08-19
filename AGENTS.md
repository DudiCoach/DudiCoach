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

OpenCode configuration (see `opencode.json`):
- Loads this file and `docs/engineering-policy.md` as instructions.
- Bash default is `ask`; read-only `git` commands are allowed; `gh` commands require
  approval. `git push --force`, `git reset --hard`, `git clean`, and `git show` of the
  two PR #69 credential commits are denied.
- The `tester` subagent may only edit `tests/**` and `qa/**`; everything else is
  denied for it (including web access). Destructive remote operations (push, merge,
  deploy, secret changes) always require explicit user approval.
