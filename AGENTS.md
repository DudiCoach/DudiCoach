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

Agent skills (see `docs/skills/README.md` and `docs/skills/INSTALL.md`):
- Vendored in `.agents/skills/`, the one project path both OpenCode and Codex
  discover. `adhd` (divergent ideation) and `unlazy` (completion gates) are
  committed, so cloning the repository is the install.
- `anti-slop` (Oxlint rules, advisory only) and `reticle` (MCP plus in-app SDK)
  are installed on demand rather than vendored, because both change the build or
  runtime instead of only adding instructions.
- Install with `npx skills add <owner>/<repo> -a opencode -a codex --copy`.
  `--copy` is required on Windows unless Developer Mode is enabled. The failure
  backoff ladder is in `docs/skills/INSTALL.md`.
- The target OS for this tooling is Windows. Each vendored `SKILL.md` carries a
  `## Windows environment` section: backslash paths, `%USERPROFILE%` not `~`,
  `curl.exe` not the PowerShell alias, split `VAR=value` prefixes, and no
  assumption that `grep`/`tail`/`sed` exist.
- `unlazy` executes approved shell commands. Read every `CHECK:` line before
  `--approve`. Its Claude Code Stop hook is not supported on OpenCode or Codex,
  so do not run `install-hooks.mjs` here.
- Vendored skill files are excluded from ESLint. Review them manually when
  updating; the linter will not flag changes.
