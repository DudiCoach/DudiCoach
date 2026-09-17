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
| `install-anti-slop` | `.agents/skills/install-anti-slop/` | Vendored and installed | [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) | `c44ef22` | MIT |
| `reticle` | not vendored | Install on demand | [reticlehq/reticle](https://github.com/reticlehq/reticle) | `3a7785d` | Apache-2.0 + FSL; `skills/` unstated |

`adhd`, `unlazy`, and `install-anti-slop` are committed to the repository so that
cloning it is sufficient — no network install required. The anti-slop Oxlint
plugin is also vendored at `tools/oxlint/anti-slop/`, with provenance in
[`tools/oxlint/anti-slop/UPSTREAM.md`](../../tools/oxlint/anti-slop/UPSTREAM.md).

`reticle` is installed on demand and vendors nothing, because the license for its
`skills/` directory is not stated. See
[Reticle — licensing finding and install path](#reticle--licensing-finding-and-install-path).

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

## Reticle — licensing finding and install path

Reticle was inspected before vendoring and is **deliberately not vendored**.

### What the license says

`reticlehq/reticle` uses a per-package model, recorded in its root `LICENSE`:

| Component | License |
|---|---|
| `@reticlehq/core`, `browser`, `react`, `babel-plugin`, `next`, `vite-plugin`, `eslint-plugin` | Apache-2.0 — explicitly safe to embed in your own app |
| `@reticlehq/server`, `init`, `test` | FSL-1.1-ALv2 — free for any Permitted Purpose; the one restriction is offering Reticle itself as a competing product; each version converts to Apache-2.0 two years after release |
| `packages/server/src/ee/` | Reticle Enterprise License — production use needs a subscription key |

The root `LICENSE` states that "each package contains its own LICENSE file,
which is authoritative." It covers **npm packages only**.

### Why nothing is vendored

The repository's `skills/` directory — twelve `SKILL.md` files plus supporting
references — carries **no stated license**. The root overview does not mention
it, and there is no `LICENSE` inside `skills/`. Redistribution terms for those
files are therefore undefined.

Rather than guess, this repository installs Reticle through its official path
and vendors nothing:

```powershell
$env:RETICLE_INSTALL_SOURCE = "readme"
npx @reticlehq/server init
```

That pulls the published Apache-2.0 SDK packages, registers the MCP server, and
installs Reticle's own skills through Reticle's own installer — so licensing
stays with upstream and no file of unclear terms is committed here.

If the team later wants the skills committed, ask Reticle Labs
(<hey@reticle.sh>) to clarify the license for `skills/`, then revisit.

### Available Reticle skills (installed by `init`, not vendored)

Inspected at commit `3a7785dda4c56712501da4fbf7626b49368fee8d`:

`agentic-tdd`, `audit-my-app`, `debug-broken-ui`, `design-system-compliance`,
`drive-desktop-app`, `false-green-tests`, `fix-what-i-pointed-at`,
`install-and-verify`, `replay-user-flows`, `test-error-states`,
`verify-ui-change`, `verify-unattended`

All twelve have valid frontmatter (`name` matches its directory, descriptions
373–473 characters) and would load in both hosts once installed.

The repository's **root** `SKILL.md` has no YAML frontmatter. It is the install
and verify critical path meant to be fetched or pasted, not discovered, so it
would not load as a skill in OpenCode or Codex. `install-and-verify` is the
discoverable entry point.

### MCP wiring

`init` registers the MCP server for every agent on the machine, including
OpenCode and Codex, so no hand-written MCP configuration is needed or wanted
here. Hand-registering a server that is not yet installed would break agent
startup.

After `init`, restart the client once so the tools appear. On Codex, prefer:

```powershell
npx @reticlehq/server init --relaunch
```

which prints the exact resume command instead of asking for a manual restart.

Setup is not complete until a verdict exists. Writing config files is not an
install; a connected session is not an install. Only `reticle_act_and_wait` and
`reticle_assert` produce a verdict.

Windows specifics are in [`INSTALL.md`](./INSTALL.md#5-per-skill-notes).

---

## Repository integration

| Concern | Handling |
|---|---|
| ESLint | `eslint.config.mjs` ignores `.agents/**`, `.opencode/**`, `.claude/**`, `.codex/**`, and the `functions` build output, so vendored skill scripts and build chunks are not linted as application source |
| Oxlint | `.oxlintrc.json` registers the vendored plugin and 19 rules. Runs via `npm run lint:oxlint` in **advisory mode only** — deliberately not wired into `.github/workflows/ci.yml`, so it cannot fail a build. ESLint remains the enforced linter |
| CI | No CI job runs these skills or Oxlint. They are developer tooling, not build inputs |
| Dependencies | `oxlint@1.83.0` and `@oxlint/plugins@1.83.0`, both pinned exactly as devDependencies. `adhd` is prompt-only; `unlazy` and the anti-slop installer use only `node:` builtins |
| Secrets | No vendored skill requires a credential. `reticle` writes `RETICLE_LICENSE_KEY` to `.env` only if an enterprise key is supplied, and `.env` is already gitignored |

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
