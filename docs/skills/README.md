# Agent Skills

Third-party agent skills used in this repository, with provenance and host
compatibility.

For installation, verification, and the failure backoff ladder, see
[`INSTALL.md`](./INSTALL.md).

---

## What is vendored

| Skill | Path | Status | Upstream | Pinned commit | License |
|---|---|---|---|---|---|
| `adhd` | `.agents/skills/adhd/` | Vendored | [UditAkhourii/adhd](https://github.com/UditAkhourii/adhd) | `16dc239` | MIT |
| `unlazy` | `.agents/skills/unlazy/` | Vendored | [Leonxlnx/unlazy](https://github.com/Leonxlnx/unlazy) | `1667149` | MIT |
| `install-anti-slop` | not vendored | Install on demand | [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) | `c44ef22` | MIT |
| `reticle` | not vendored | Install on demand | [reticlehq/reticle](https://github.com/reticlehq/reticle) | `3a7785d` | Apache-2.0 + FSL |

`adhd` and `unlazy` are committed to the repository so that cloning it is
sufficient — no network install required. `anti-slop` and `reticle` are
installed on demand because both change the build or runtime rather than only
adding instructions:

- **anti-slop** vendors an Oxlint plugin into `tools/oxlint/anti-slop/` and adds
  dev dependencies. Its own install skill performs that work and records
  provenance in `UPSTREAM.md`.
- **reticle** installs a dev-only SDK into the running app and registers an MCP
  server machine-wide. Installing through the published npm packages avoids
  vendoring its FSL-licensed source.

Each vendored skill directory carries its upstream `LICENSE` file.

---

## Vendored contents

### adhd

```
.agents/skills/adhd/
  SKILL.md         skill definition (prompt-only)
  SOURCE-SPEC.md   the divergent-ideation spec the skill operationalises
  LICENSE          MIT
```

A `## Windows environment` section was appended to `SKILL.md`. No other content
was modified.

### unlazy

```
.agents/skills/unlazy/
  SKILL.md              skill definition
  SECURITY.md           CHECK/shell/approval/hook threat model
  LICENSE               MIT
  agents/openai.yaml    Codex and ChatGPT UI metadata
  scripts/              gate-check, gate-lint, dispatch-check, install-hooks, stop-hook, lib/
  references/           gates, method, orchestration, dispatch, parallel, token-economy
  templates/            PLAN.md, gates-leaf.md, gates-node.md
```

A `## Windows environment` section was appended to `SKILL.md`, and
`license: MIT` was added to its frontmatter. No other content was modified.

Upstream `tests/`, `research/`, `CHANGELOG.md`, `CONTRIBUTING.md`, and
`package.json` were intentionally not vendored. The scripts are
zero-dependency and import only `node:` builtins plus their local `./lib/`
modules, so they run without a package manifest.

---

## Host compatibility

Verified against the OpenCode skills documentation, the Codex skills
documentation, and the `skills` CLI supported-agents matrix.

### Discovery paths

| Host | Project path | Global path |
|---|---|---|
| OpenCode | `.opencode/skills/`, `.claude/skills/`, `.agents/skills/` | `~/.config/opencode/skills/`, `~/.claude/skills/`, `~/.agents/skills/` |
| Codex | `.agents/skills/` (CWD up to repo root) | `$HOME/.agents/skills/` |

`.agents/skills/` is the one project location both hosts read, which is why the
vendored skills live there.

### Feature support

| Skill | Mechanism | OpenCode | Codex | Notes |
|---|---|---|---|---|
| `adhd` | Parallel isolated subagent fan-out, then a critic pass | Yes | Yes | Uses the host `task`/subagent tool. Degrades to sequential if a host cannot spawn subagents — that is not ADHD, and the skill says so |
| `unlazy` | `GATES.md` ledger plus Node checker scripts | Yes | Yes | Scripts are zero-dependency and cross-platform |
| `unlazy` Stop hook | Claude Code Stop hook | **No** | **No** | Hooks are Claude-Code-only. Do not run `install-hooks.mjs` on OpenCode or Codex |
| `install-anti-slop` | Installer skill that edits lint config | Yes | Yes | Agent-agnostic; the result is a linter |
| `reticle` | MCP server plus in-app SDK | Yes | Yes | `init` registers the MCP server for every agent on the machine |

Neither OpenCode nor Codex supports `context: fork`. Neither skill depends on
it.

### Frontmatter constraints

Both hosts require `name` and `description`. OpenCode additionally enforces:

- `name`: 1–64 characters, lowercase alphanumeric with single hyphens, must
  match the containing directory name.
- `description`: 1–1024 characters.

Codex budgets the initial skill list to roughly 2% of the context window and
shortens descriptions first, so keep them concise. `adhd` ships a single-line
description under 600 characters specifically because some Codex builds
truncate or reject multi-line YAML block scalars.

Both vendored skills satisfy these constraints:

| Skill | `name` | Matches dir | `description` length |
|---|---|---|---|
| `adhd` | `adhd` | Yes | 534 |
| `unlazy` | `unlazy` | Yes | 462 |

---

## Windows

The target development OS for this repository's agent tooling is Windows. Every
vendored skill carries a `## Windows environment` section covering:

- Backslash paths and `%USERPROFILE%` instead of `~`.
- `curl.exe` rather than the PowerShell `curl` alias.
- `New-Item -ItemType Directory -Force` instead of `mkdir -p`.
- Splitting Unix `VAR=value command` prefixes into PowerShell
  (`$env:VAR = "value"; command`) or `cmd` (`set VAR=value && command`) forms.
- `--copy` for the `skills` CLI, because symlinks need Developer Mode.
- Not assuming `grep`, `tail`, `tr`, `sed`, or `awk` exist.

`unlazy` additionally needs an explicit shell choice: its checker defaults to
`process.env.ComSpec` (`cmd.exe`) on Windows, not PowerShell.

Full details in [`INSTALL.md`](./INSTALL.md).

---

## Repository integration

| Concern | Handling |
|---|---|
| Linting | `eslint.config.mjs` ignores `.agents/**`, `.opencode/**`, `.claude/**`, `.codex/**` so vendored skill scripts are not linted as application source |
| CI | No CI job runs these skills. They are developer tooling, not build inputs |
| Dependencies | None added. `adhd` is prompt-only; `unlazy` scripts use only `node:` builtins |
| Secrets | No skill in this set requires a credential. `reticle` writes `RETICLE_LICENSE_KEY` to `.env` only if an enterprise key is supplied, and `.env` is already gitignored |

---

## Updating vendored skills

1. Re-fetch upstream and note the new commit SHA.
2. Re-apply the two local modifications: the `## Windows environment` section
   in each `SKILL.md`, and `license: MIT` in the `unlazy` frontmatter.
3. Update the pinned commit in the table above.
4. Run `npm run lint` and `npm run typecheck` to confirm nothing regressed.

Prefer `npx skills update` for skills installed through the CLI. For vendored
copies, overwrite the files and record the new SHA here.

---

## Security review

These skills were reviewed before vendoring.

- **No credentials.** Neither vendored skill reads, stores, or transmits a
  secret.
- **No network calls at runtime.** `adhd` is prompt-only. `unlazy` scripts run
  only the `CHECK:` commands a developer explicitly approved.
- **`unlazy` executes shell commands.** That is its purpose, and it is gated:
  `--status` never executes, a first run against an unapproved oracle prints
  the resolved command without running it, and execution requires an explicit
  `--approve` after reading every `CHECK:` line. Approval records are
  owner-private and live outside the repository. Treat `--approve` as a
  consent step, not a formality.
- **The Stop hook is not installed here.** It is Claude-Code-only and inert on
  OpenCode and Codex.
- **Vendored scripts are excluded from lint.** Review them manually when
  updating, since ESLint will not flag changes.
