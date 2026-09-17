# Vendored anti-slop Oxlint plugin

## Source

- **Repository:** <https://github.com/dmmulroy/anti-slop>
- **Commit:** `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b` (2026-09-10)
- **License:** MIT (Copyright (c) 2026 Dillon Mulroy) — see `LICENSE` beside this
  file, copied from the upstream repository root.
- **Copied from:** the install skill's bundled asset tree at
  `skills/install-anti-slop/assets/anti-slop/`, which upstream keeps byte-identical
  to its canonical `src/` via `pnpm sync:skill-assets` and a CI drift check.
- **Installed by:** `node .agents/skills/install-anti-slop/scripts/install.mjs`

## Installed paths

```
tools/oxlint/anti-slop/            this directory - the plugin entry point and rules
.agents/skills/install-anti-slop/  the installer skill (SKILL.md, assets, references, scripts)
.oxlintrc.json                     ignorePatterns, jsPlugins, and enabled rules
package.json                       oxlint and @oxlint/plugins dev dependencies
```

## Dependency versions

Both packages are pinned exactly so upgrades move them together, as the install
skill requires:

| Package | Version | Type |
|---|---|---|
| `oxlint` | `1.83.0` | devDependency |
| `@oxlint/plugins` | `1.83.0` | devDependency |

The repository had no prior `oxlint` dependency, so both were installed at the
same current version resolved from `npm view`.

## Nested vendored dependency

`vendor/eslint-stylistic/` contains an adapted copy of ESLint Stylistic's
`padding-line-between-statements` rule, MIT-licensed, with its own `LICENSE` and
`UPSTREAM.md` retained verbatim. That inner `UPSTREAM.md` is authoritative for
those files and records the upstream commit and local adaptations. Keep both
files with any redistributed copy.

## Intentional deviations from the install skill's defaults

1. **Advisory mode.** The skill registers rules at `"error"`. This repository
   runs Oxlint through `npm run lint:oxlint` only. It is **not** wired into
   `.github/workflows/ci.yml`. ESLint remains the enforced linter, so these
   rules cannot fail a build or block an in-flight PR.

2. **Additional ignore patterns.** Beyond the skill's agent-tooling list, the
   config ignores this repository's build and generated output so the linter
   reports only owned source:

   ```
   .next/**, out/**, build/**, coverage/**, playwright-report/**,
   test-results/**, supabase/.temp/**, functions/**, next-env.d.ts
   ```

   `functions/**` is the Firebase Hosting build output produced by `build.sh`.
   It contains no tracked source.

3. **Effect rules not enabled.** The opt-in `anti-slop-effect` plugin is left
   disabled. The skill requires a direct `effect` dependency in the package
   manifest or an explicit user request; `effect` is not a direct dependency
   here, and it must not be enabled merely because it appears transitively in a
   lockfile.

4. **No cleanup applied.** The first run reports findings in owned source. Per
   the skill, findings are reported and not auto-fixed unless migration or
   cleanup is explicitly requested. No rule was suppressed, no severity weakened,
   and no unsafe cast added to make the linter pass.

## Baseline findings at install time

First run against `main` plus the Tier A skills branch, with the configuration
above:

| Rule | Findings |
|---|---|
| `anti-slop/require-readable-spacing` | 1281 |
| `anti-slop/require-safety-comment-for-type-assertion` | 383 |
| `anti-slop/no-module-mocking` | 60 |
| `anti-slop/no-unknown-parameters` | 36 |
| `anti-slop/no-runtime-typeof` | 26 |
| `anti-slop/no-unsafe-dictionary-type` | 17 |
| `anti-slop/no-known-value-widening` | 9 |
| `anti-slop/no-chained-type-assertions` | 7 |
| `anti-slop/no-object-parameters` | 5 |
| `anti-slop/no-unknown-returns` | 3 |
| `anti-slop/no-array-filter-map` | 1 |
| **Total** | **1828** |

Rules that reported nothing: `oxc/no-accumulating-spread`,
`anti-slop/no-reduce-accumulator-copy`, `anti-slop/no-conditional-empty-object-spread`,
`anti-slop/no-reflect-apply`, `anti-slop/no-reflect-get`,
`anti-slop/no-shape-in-symbol-names`, `anti-slop/no-unknown-type-aliases`,
`anti-slop/no-widen-then-assert`.

This is a baseline for triage, not a claim that the codebase is deficient.
`require-readable-spacing` is autofixable and cosmetic; adopt it separately from
the semantic rules if the team wants it.

Note on `no-array-filter-map`: the skill advises preferring lazy
`.values().filter(...).map(...).toArray()` pipelines only when the runtime
supports iterator helpers. This repository targets Node 20 in CI, where iterator
helpers are not stable, so prefer a single `flatMap` or a locally mutating
reducer when addressing that finding.

## Updating

Ask the agent to **update anti-slop while preserving local customizations**,
optionally naming an upstream revision. The install skill stages incoming source
separately, three-way merges when the original upstream snapshot is recoverable,
and ports reviewed changes conservatively. It preserves the deviations recorded
above and never force-replaces this directory.

After updating:

1. Re-read the installed `oxlint` version and install `@oxlint/plugins` at
   exactly that version.
2. Run `npm run lint:oxlint` and compare findings against the baseline above.
3. Update the commit SHA and baseline table in this file.

The copy script does not fetch or merge updates by itself.

## Windows

Oxlint ships as a cross-platform native binary through npm, so no extra setup is
needed on Windows. Run it with:

```powershell
npm run lint:oxlint
```

The installer is plain Node and uses only `node:fs`, `node:path`, and `node:url`:

```powershell
node .agents\skills\install-anti-slop\scripts\install.mjs
```

It refuses to overwrite an existing destination. Route an existing copy through
the update procedure rather than passing `--force`.
