# Agent Skills — Install Guide and Backoff Plan

How to install, verify, and recover the agent skills used in this repository.

**Target OS: Windows.** Every command below is given in PowerShell first, with
`cmd` variants where the syntax differs. macOS and Linux equivalents are noted
only where they matter.

Primary agents: **OpenCode** and **Codex**.

---

## 1. Where skills live, and why

Both OpenCode and Codex discover project skills from the **same** directory:

```
.agents/skills/<name>/SKILL.md
```

- **OpenCode** scans `.opencode/skills/`, `.claude/skills/`, and
  `.agents/skills/` (project), walking up to the git worktree root.
- **Codex** scans `.agents/skills/` from the current directory up to the
  repository root.

`.agents/skills/` is therefore the single location that serves both hosts.
Skills committed there are available to anyone who clones the repository,
with no install step.

Skills already vendored in this repository:

| Skill | Path | Purpose |
|---|---|---|
| `adhd` | `.agents/skills/adhd/` | Parallel divergent ideation for design and naming decisions |
| `unlazy` | `.agents/skills/unlazy/` | Completion discipline via acceptance gates and re-verification |

The repository also keeps an OpenCode-only tester skill at
`.opencode/skills/dudicoach-tester/`. That one is intentionally not in
`.agents/skills/` because it is specific to OpenCode's agent routing.

---

## 2. Primary path — `npx skills add`

The [`skills`](https://github.com/vercel-labs/skills) CLI from Vercel Labs is
the official installer for all four skills this project uses. It supports
OpenCode and Codex explicitly.

### Prerequisites

```powershell
node --version    # must be >= 18
npx --version
```

If `node` is missing, install Node LTS from <https://nodejs.org> or via
`winget install OpenJS.NodeJS.LTS`, then open a new terminal.

### Install commands

Run these from the repository root.

```powershell
# ADHD — divergent ideation
npx skills add UditAkhourii/adhd -a opencode -a codex

# unlazy — completion gates
npx skills add Leonxlnx/unlazy -a opencode -a codex

# anti-slop — Oxlint rule installer (Tier B)
npx skills add dmmulroy/anti-slop --skill install-anti-slop -a opencode -a codex
```

Reticle uses its own installer rather than the `skills` CLI:

```powershell
$env:RETICLE_INSTALL_SOURCE = "readme"
npx @reticlehq/server init
```

In `cmd`, the Reticle form is:

```bat
set RETICLE_INSTALL_SOURCE=readme && npx @reticlehq/server init
```

On macOS/Linux the same command is a single line:
`RETICLE_INSTALL_SOURCE=readme npx @reticlehq/server init`.

### Useful flags

| Flag | Effect |
|---|---|
| `-a opencode -a codex` | Target both hosts explicitly instead of auto-detecting |
| `-g` | Install to the user directory instead of the project |
| `--copy` | Copy files instead of symlinking (**required on most Windows setups**) |
| `-y` | Skip confirmation prompts (CI-friendly) |
| `--all` | Install every skill in the repo to every detected agent |
| `--list` | Show what a repo offers without installing |

### Windows: always pass `--copy`

The CLI symlinks by default. Creating symlinks on Windows requires Developer
Mode or an elevated shell, and fails with `EPERM` otherwise. Use:

```powershell
npx skills add UditAkhourii/adhd -a opencode -a codex --copy
```

If Developer Mode is enabled (Settings > System > For developers), symlinks
work and `--copy` is optional. Copy is still the safer default for a shared
repository because symlinks do not survive every clone and archive path.

---

## 3. Verify the install

### OpenCode

Skills appear in the `skill` tool description as an `<available_skills>` list.
Ask the agent to list its skills, or invoke one directly. If a skill is
missing:

1. Confirm the file is spelled `SKILL.md` in all caps.
2. Confirm the frontmatter has both `name` and `description`.
3. Confirm `name` matches the containing directory name.
4. Check `opencode.json` permissions — a `deny` rule hides the skill.

### Codex

```
/skills
```

or type `$` to see the skill list, then invoke `$adhd` or `$unlazy`. Codex
detects new skills automatically; if one does not appear, restart Codex.

Codex reads `name` and `description` from frontmatter and budgets the initial
skill list to about 2% of the context window. Keep descriptions concise and
single-line.

### unlazy smoke test

```powershell
node .agents\skills\unlazy\scripts\gate-check.mjs --help
```

A usage listing means the vendored scripts are intact and Node can run them.

---

## 4. Backoff plan — when `npx skills add` fails

Work down this ladder and stop at the first rung that works. Each rung lists
the symptom that justifies it.

### Rung 1 — Agent not detected

**Symptom:** the CLI installs to the wrong host, or reports no agents found.

Force the targets:

```powershell
npx skills add UditAkhourii/adhd -a codex -a opencode
```

Add `-g` if the project path is read-only or the repo layout confuses
detection:

```powershell
npx skills add UditAkhourii/adhd -a codex -g
```

### Rung 2 — `EPERM` / symlink failure

**Symptom:** `EPERM: operation not permitted, symlink` or similar.

Use copy mode:

```powershell
npx skills add UditAkhourii/adhd -a opencode -a codex --copy
```

Or enable Developer Mode and retry without `--copy`.

### Rung 3 — Interactive prompts block automation

**Symptom:** the CLI waits for input in CI or a non-interactive shell.

```powershell
npx skills add UditAkhourii/adhd -a opencode -a codex --copy -y
```

or `--all` to skip selection entirely.

### Rung 4 — `npx` cannot resolve the package

**Symptom:** `npm ERR! 404`, registry timeout, or a stale cached CLI.

Install the CLI globally, or force the latest version:

```powershell
npm install -g skills
skills add UditAkhourii/adhd -a opencode -a codex --copy
```

```powershell
npx skills@latest add UditAkhourii/adhd -a opencode -a codex --copy
```

Check the registry if both fail:

```powershell
npm config get registry
npm view skills version
```

### Rung 5 — The `skills` CLI is unusable

**Symptom:** the CLI errors out, or the organisation blocks it.

Install manually by copying the files. PowerShell:

```powershell
New-Item -ItemType Directory -Force -Path .agents\skills\adhd | Out-Null
curl.exe -fsSL https://raw.githubusercontent.com/UditAkhourii/adhd/main/skills/adhd/SKILL.md `
  -o .agents\skills\adhd\SKILL.md
```

For unlazy, copy the whole skill directory rather than one file, because
`SKILL.md` references `scripts/`, `references/`, and `templates/`:

```powershell
git clone --depth 1 https://github.com/Leonxlnx/unlazy.git $env:TEMP\unlazy
New-Item -ItemType Directory -Force -Path .agents\skills\unlazy | Out-Null
Copy-Item $env:TEMP\unlazy\SKILL.md, $env:TEMP\unlazy\SECURITY.md, $env:TEMP\unlazy\LICENSE `
  -Destination .agents\skills\unlazy\
Copy-Item $env:TEMP\unlazy\scripts, $env:TEMP\unlazy\references, $env:TEMP\unlazy\templates `
  -Destination .agents\skills\unlazy\ -Recurse
```

In `cmd`, use `mkdir` and `curl.exe` instead of `New-Item`:

```bat
mkdir .agents\skills\adhd
curl.exe -fsSL https://raw.githubusercontent.com/UditAkhourii/adhd/main/skills/adhd/SKILL.md -o .agents\skills\adhd\SKILL.md
```

Note: in PowerShell `curl` is an alias for `Invoke-WebRequest`, which does not
accept `-fsSL`. Always write `curl.exe`.

### Rung 6 — GitHub raw or API is blocked

**Symptom:** `raw.githubusercontent.com` or `api.github.com` is unreachable.

Clone over SSH or an internal mirror, then copy:

```powershell
git clone git@github.com:UditAkhourii/adhd.git $env:TEMP\adhd
Copy-Item $env:TEMP\adhd\skills\adhd\SKILL.md -Destination .agents\skills\adhd\
```

### Rung 7 — No network on the target machine

**Symptom:** an offline or air-gapped environment.

Nothing to install. The skills are vendored in this repository under
`.agents/skills/`. Cloning the repository is the install. This is the reason
the vendored copies exist, and it is the guaranteed floor of this ladder.

---

## 5. Per-skill notes

### adhd

Prompt-only. Reads and writes no files, runs no shell commands. Identical
behaviour on Windows, macOS, and Linux. The optional CLI is not vendored:

```powershell
npm install -g adhd-agent
$env:ANTHROPIC_API_KEY = "..."
adhd "design a rate limiter that survives a leader election"
```

### unlazy

Zero-dependency Node scripts; Node 16 or newer. Three Windows specifics:

1. **Paths.** Use `.agents\skills\unlazy\scripts\gate-check.mjs`. Approval
   records live at `%USERPROFILE%\.unlazy\approved`, not `~/.unlazy/approved`.
2. **Shell.** The checker defaults to `process.env.ComSpec` (`cmd.exe`) on
   Windows, not PowerShell. Pin the shell per ledger with `--shell pwsh` or
   `$env:UNLAZY_SHELL = "pwsh"`, and write every `CHECK:` line for that one
   shell. Do not assume `grep`, `tail`, `tr`, `sed`, or `awk` exist.
3. **Stop hook.** `install-hooks.mjs` targets Claude Code and writes
   `.claude/settings.local.json`. OpenCode and Codex do not support hooks.
   **Do not run it on those hosts.** Rely on leaf self-check, parent
   `--reverify`, and branch integration gates instead.

Keep `.unlazy/` and `.unlazy-hook-state.json` out of version control. Never
commit approval records; they bind absolute paths and the full inherited
`PATH`.

### anti-slop

An installer skill that vendors an Oxlint plugin into
`tools/oxlint/anti-slop/`, adds `oxlint` and `@oxlint/plugins` as dev
dependencies, and merges rules into the lint configuration. Agent-agnostic:
it edits files and runs `npm`. Oxlint ships as a cross-platform binary through
npm, so Windows needs no extra setup.

This project runs Oxlint in **advisory mode** (`npm run lint:oxlint`), not in
CI. ESLint remains the enforced linter.

### reticle

Installs a dev-only SDK into the running app and registers an MCP server for
every agent on the machine, including OpenCode and Codex. Windows specifics:

- Split the environment-variable prefix (PowerShell and `cmd` forms in §2).
  The Unix `VAR=value command` form does not work in either Windows shell.
- The dev server must be started after `init` edits the build config. A server
  already running serves the old bundle without the SDK. Restart it, then
  hard-reload the tab.
- Start background processes with `Start-Process` in PowerShell rather than
  `&`:

  ```powershell
  Start-Process npm -ArgumentList "run","dev" -NoNewWindow
  ```

- Reticle registers globally, so the MCP tools persist across projects. On
  Claude Code and Codex, `npx @reticlehq/server init --relaunch` prints the
  resume command instead of asking for a manual restart.
- Setup is not complete until a verdict exists. Writing config files is not an
  install.

Licensing: the Reticle repository is Apache-2.0 (SDK) plus Functional Source
License components. This project installs through the published Apache-2.0 npm
packages (`@reticlehq/server`, `@reticlehq/react`) and vendors no Reticle
source, so no FSL redistribution applies.

---

## 6. Updating

```powershell
npx skills update                    # interactive scope prompt
npx skills update adhd               # one skill
npx skills update -p -y              # project scope, non-interactive
npx skills list                      # what is installed where
```

For vendored copies, re-run the relevant rung in §4 and overwrite. Record the
new upstream commit in [`README.md`](./README.md) so the provenance stays
accurate.

For anti-slop, ask the agent to "update anti-slop while preserving local
customizations" rather than re-running a fresh install. The install skill
stages incoming source separately and three-way merges when the original
upstream snapshot is recoverable. It never force-replaces the vendored
directory.

---

## 7. Removing

```powershell
npx skills remove adhd
npx skills remove --all              # everything, no confirmation
npx skills remove my-skill -a codex  # one host only
```

Vendored copies are ordinary repository files. Remove them with `git rm -r
.agents/skills/<name>` and commit.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "No skills found" | Missing or malformed `SKILL.md` frontmatter | Confirm `name` and `description` are present and valid YAML |
| Skill invisible in Codex | Long or multi-line description | Keep the description single-line and under ~600 characters |
| Skill invisible in OpenCode | Permission rule | Check `opencode.json` `permission.skill` for a `deny` pattern |
| Skill loads but scripts fail | Wrong shell or missing Unix tools | Pin `--shell pwsh`; call Node scripts instead of `grep`/`tail` |
| `EPERM` on install | Symlinks need Developer Mode | Pass `--copy` |
| MCP tools never appear | Client not restarted after `init` | Restart the client, or use `init --relaunch` on Codex |
| Reticle session list empty | Dev server started before `init` | Restart the dev server, then hard-reload the tab |
