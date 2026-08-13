---
name: git-mr-reviewer
description: Intelligent merge request (MR/PR) reviewer that ONLY analyzes MRs/PRs authored by the current user. Auto-detects GitHub vs GitLab per repository, verifies CLI auth, and provides comprehensive analysis including rebase eligibility, conflict risk, and merge strategy recommendations. Use when asked to audit, analyze, consolidate, or clean up YOUR OWN MRs/PRs across any Git host.
---
## DudiCoach Context

- **Source of truth:** `docs/engineering-policy.md`.
- **Use for:** auditing YOUR OWN PRs on `dawidmalickilodz/DudiCoach` (GitHub). This skill only operates on PRs authored by the current user.
- **Host:** GitHub — use `gh` CLI. Repo: `dawidmalickilodz/DudiCoach`.
- **Related agents:** `.claude/agents/code-reviewer.md` (final gate).


# MR/PR Reviewer (GitHub + GitLab)

**Scope: ONLY MRs/PRs authored by the current authenticated user.** This skill never operates on MRs/PRs created by others. All list queries use `--author=@me` / `--author @me` filters.

Intelligent merge request reviewer that auto-detects the Git hoster for each workspace repository, checks authentication, and adapts commands accordingly. Supports both GitHub (`gh`) and GitLab (`glab`).

## When to Use

- Audit **YOUR OWN** open MRs/PRs across all accessible projects
- Detect merge conflicts before merging
- Assess rebase eligibility and conflict risk for **YOUR** branches
- Determine optimal merge strategy (squash vs rebase vs merge commit) for **YOUR** MRs
- Identify obsolete or superseded MRs/PRs **you created**
- Consolidate overlapping MRs/PRs **you created**
- Generate actionable cleanup plans for **YOUR** backlog
- Bulk-close or rebase stale MRs/PRs **you own**
- Mixed environments: GitHub + GitLab side by side

---

## STEP 0: Auto-Detection (ALWAYS RUN FIRST)

Before any MR/PR operations, always run the detection sequence to determine which CLI to use for each repository. **This step operates on repository metadata only, not on MR data.**

### 0a: Check which CLIs are available

```bash
echo "=== CLI Availability ==="
for cli in glab gh; do
  if command -v $cli >/dev/null 2>&1; then
    echo "  $cli: $(command -v $cli)"
  else
    echo "  $cli: NOT INSTALLED"
  fi
done
```

### 0b: Verify authentication

```bash
echo "=== GitLab Auth ==="
if command -v glab >/dev/null 2>&1; then
  if glab auth status 2>&1 | grep -q "Logged in"; then
    echo "  glab: AUTHENTICATED"
    glab auth status | grep "GitLab.com"
  else
    echo "  glab: NOT LOGGED IN — run 'glab auth login'"
  fi
else
  echo "  glab: not installed — GitLab operations unavailable"
fi

echo ""
echo "=== GitHub Auth ==="
if command -v gh >/dev/null 2>&1; then
  if gh auth status 2>&1 | grep -q "Logged in"; then
    echo "  gh: AUTHENTICATED"
  else
    echo "  gh: NOT LOGGED IN — run 'gh auth login'"
  fi
else
  echo "  gh: not installed — GitHub operations unavailable"
fi
```

### 0c: Detect workspace remotes (REQUIRED — determines per-repo which CLI to use)

```bash
echo "=== Workspace Remote Detection ==="
detect_host() {
  local url="$1"
  case "$url" in
    *github.com*) echo "github" ;;
    *gitlab.com*) echo "gitlab" ;;
    *gitlab-ext.digitalaviationservices.com*) echo "gitlab-ext" ;;
    *) echo "unknown" ;;
  esac
}

find . -maxdepth 4 -name ".git" -type d 2>/dev/null | while read gitdir; do
  repo_dir="$(dirname "$gitdir")"
  remote_url="$(git -C "$repo_dir" remote get-url origin 2>/dev/null || echo 'none')"
  host="$(detect_host "$remote_url")"
  case "$host" in
    github)    cli="gh" ;;
    gitlab|gitlab-ext) cli="glab" ;;
    *)        cli="UNKNOWN" ;;
  esac
  echo "  [$cli] $repo_dir"
  echo "         ($remote_url)"
done | sort -u
```

**Expected host → CLI mapping:**
| Remote pattern | Host | CLI to use |
|---|---|---|
| `github.com` | github | `gh` |
| `gitlab.com` | gitlab | `glab` |
| `gitlab-ext.digitalaviationservices.com` | gitlab-ext | `glab --hostname gitlab-ext...` |

**If a repository is on a host whose CLI is not authenticated:** skip that repository in all operations and report it as an auth gap.

---

## STEP 1: Data Collection — YOUR MRs Only (after auto-detection)

Only proceed if at least one CLI is authenticated. **All queries MUST include `--author=@me` (GitLab) or filter by current user (GitHub) — never list all project MRs.**

### GitLab — YOUR open MRs

```bash
glab mr list --author=@me --state=opened --all-projects --output json
```

### GitHub — YOUR open PRs

```bash
gh pr list --author=@me --state=open --json number,title,url,state,createdAt,updatedAt,headRefName,baseRefName,mergeable,labels,milestone,additions,deletions
```

> **Important:** Always use `--author=@me` / `--author @me`. If omitted, these commands return MRs from ALL users in the project, not just yours.

### Per-item detailed view

```bash
# GitLab MR (must be YOUR MR — no --author flag on view, use project+id)
glab mr view <mr-id> --project=<project-id> \
  --json=webUrl,title,state,createdAt,updatedAt,sourceBranch,targetBranch,mergeStatus,labels,milestone,headPipeline,author,diffRefs

# GitHub PR (must be YOUR PR — verify author in output)
gh pr view <pr-number> --repo <owner/repo> \
  --json=number,title,url,state,createdAt,updatedAt,headRefName,baseRefName,mergeable,mergeableState,labels,milestone,author,additions,deletions,commits
```

---

## STEP 2: Rebase & Merge Strategy Analysis (CORE)

For each MR/PR, determine: (a) how many commits behind target, (b) whether it can merge cleanly, (c) which merge strategies are available and recommended.

### 2a: Divergence from target branch

```bash
# GitLab — commits between target and source
glab api projects/<project-id>/repository/compare?from=<target-branch>&to=<source-branch> \
  --paginate | jq '{behind: .diff_stats.total_changes, ahead: .ahead, behind_count: .diff_stats.total_removals}'

# GitHub — compare base vs head
gh api repos/<owner>/<repo>/compare/heads/<head-ref>...<base-ref> \
  | jq '{behind: .behind_by, ahead: .ahead_by, status: .status}'
```

### 2b: Conflict detection via merge dry-run

```bash
# GitLab — does it merge cleanly?
glab mr merge <mr-id> --project=<project-id> --dry-run
# Exit 0 = clean | Exit != 0 + "conflict" = has conflicts | Exit != 0 + "not open" = already merged/closed

# GitHub — is it mergeable?
gh pr merge <pr-number> --repo <owner/repo> --admin --dry-run
# Exit 0 = can merge | Exit != 0 = has blocking state (conflicts, draft, blocked)
```

### 2c: Pipeline / checks status (required before merge)

```bash
# GitLab pipeline
glab pipeline list --project=<project-id> --ref=<source-branch> --status=running
glab mr view <mr-id> --project=<project-id> --json=headPipeline | jq -r '.headPipeline.status // "none"'

# GitHub checks
gh api repos/<owner>/<repo>/commits/<sha>/check-runs --jq '.check_runs[] | select(.status=="completed") | {name, conclusion, status}'
```

### 2d: Merge strategy eligibility

Each platform supports different merge methods. Determine which are available and which are recommended.

```bash
# GitLab — project merge settings
glab api projects/<project-id> --jq '.permissions, .merge_method, .only_allow_merge_if_pipeline_succeeds, .only_allow_merge_if_all_discussions_are_resolved'

# GitHub — repository merge settings
gh api repos/<owner>/<repo> --jq '.allow_merge_commit, .allow_squash_merge, .allow_rebase_merge, .delete_branch_on_merge'
```

**Merge strategy rules:**

| Strategy | GitLab | GitHub | When to use |
|----------|--------|--------|-------------|
| Merge commit | ✓ always | ✓ if enabled | Multiple logical commits to preserve history |
| Squash merge | ✓ if enabled | ✓ if enabled | Many small commits; clean linear history |
| Rebase + merge | ✗ (GitLab always rebases transparently) | ✓ if enabled | When you want linear history but preserve commits |
| Fast-forward | ✓ via `ff-only` merge method setting | N/A | Strict linear history |

**Decision logic:**
1. If `mergeStatus == "cannot_be_merged"` → **Has Conflicts** — must resolve or close
2. If pipeline failing → **Blocked** — cannot merge until pipeline passes
3. If `behind > 0` AND dry-run clean → **Needs Rebase** (or just update-to-date)
4. If `behind > 0` AND dry-run conflict → **Has Conflicts + Behind** — rebase will be needed AND may reveal more conflicts
5. If `behind == 0` AND dry-run clean → **Ready to Merge**
6. If `behind > 0` AND `allow_squash_merge` AND squash doesn't require rebase → **Squash Recommended** (avoids manual rebase)
7. If draft/WIP → **Draft** — not eligible for merge until marked ready

### 2e: Conflict resolution path

If an MR/PR has conflicts, determine the resolution path:

```bash
# GitLab — fetch MR branch locally to inspect conflicts
git fetch origin <source-branch>
git checkout <source-branch>
git rebase origin/<target-branch>
# If conflicts: resolve in editor, git add, git rebase --continue

# GitHub — fetch PR branch locally to inspect conflicts
git fetch origin <head-branch>
git checkout <head-branch>
git rebase origin/<base-branch>
# If conflicts: resolve in editor, git add, git rebase --continue
git push --force-with-lease origin <head-branch>
```

---

## STEP 3: Relevance Analysis

### Check if MR/PR is superseded by main commits

```bash
# GitLab — commits added to main since MR creation
glab api projects/<project-id>/repository/commits?ref_name=main&since=<created-at>

# GitHub — main commits since PR creation
gh api repos/<owner>/<repo>/commits?sha=main&since=<created-at>
```

### Changed paths from diff

```bash
# GitLab
glab mr diff <mr-id> --project=<project-id> | grep "^diff --git"

# GitHub
gh pr diff <pr-number> --repo <owner/repo>
```

---

## STEP 4: Consolidation Detection

Group MRs/PRs by:
- Same top-level directory (extract from diffs)
- Shared branch name prefix: `feat/`, `fix/`, `chore/`, `wip/`
- Same JIRA ticket pattern: `PROJ-123-`
- Cross-references in descriptions: "Depends on !123" / "Closes #456"

---

## STEP 5: Report Generation

```
# MY MR/PR Review Report — <date>
# Platforms: github (gh) | gitlab (glab) | gitlab-ext (glab)
# Auth: glab=<OK/FAIL> | gh=<OK/FAIL>
# Scope: ONLY MRs/PRs authored by @me

## Executive Summary
- My open MRs/PRs: N (GitLab: X | GitHub: Y)
- Average age: Z days | Backlog health: <score>/100
- Ready to merge: R | Needs rebase: B | Has conflicts: C | Obsolete: O
- Auth gaps: <list>

---

## My GitLab MRs

| !ID | Title | Project | Age | Behind | Conflicts | Pipeline | Strategy | Action |
|-----|-------|---------|-----|--------|-----------|---------|----------|--------|
| !123 | ... | proj | 5d | 3 | No | passing | squash | merge |
| !124 | ... | proj | 12d | 15 | YES | passing | rebase then merge | rebase |
| !125 | ... | proj | 30d | 47 | YES | failing | blocked | close |

**Strategy column values:** `merge` | `squash` | `rebase-then-merge` | `blocked` | `close`

## My GitHub PRs

| #ID | Title | Repo | Age | Behind | Mergeable | Checks | Strategy | Action |
|-----|-------|------|-----|--------|-----------|--------|----------|--------|
| #456 | ... | owner/repo | 3d | 1 | true | passing | merge | merge |
| #457 | ... | owner/repo | 8d | 22 | false | passing | squash | rebase or close |
| #458 | ... | owner/repo | 45d | 89 | false | failing | blocked | close |

---

## Risk Assessment

| ID | Platform | Category | Merge Strategy | Rebase Conflict Risk | Action |
|----|----------|----------|---------------|---------------------|--------|
| !123 | gitlab | Ready to Merge | squash merge | N/A | merge |
| !124 | gitlab | Needs Rebase | squash recommended (avoids manual rebase) | LOW | rebase or squash-merge |
| !789 | gitlab | Has Conflicts | must rebase to resolve | HIGH (47 commits behind) | manual conflict resolution |
| #456 | github | Ready to Merge | merge commit | N/A | merge |
| #458 | github | Potentially Obsolete | blocked | N/A | close |
| #457 | github | Needs Rebase | squash merge (avoids rebase) | MED (22 commits) | rebase or squash |

**Conflict risk levels:**
- `LOW`: < 5 commits behind, no overlapping file changes with main
- `MED`: 5–20 commits behind, some file path overlap
- `HIGH`: > 20 commits behind, significant file path overlap with main
- `BLOCKED`: pipeline failing or MR closed/locked

---

## Consolidation Candidates
- MR !124 and !127 both modify `src/api/` — consider squash-merging !124 first, then rebase !127 on result
- PR #456 is a partial implementation of #460 — coordinate before merging

---

## Action Plan (by priority)

### Immediate — Ready to Merge (no conflicts, pipeline passing)
```bash
glab mr merge !123 --project=<id> --squash --remove-source-branch
gh pr merge 456 --repo owner/repo --squash --delete-branch
```

### High Priority — Squash recommended (behind target but squash avoids rebase)
```bash
glab mr merge !124 --project=<id> --squash --remove-source-branch
# If squash not available:
glab mr rebase !124 --project=<id>
```

### Medium Priority — Needs rebase (conflicts likely, high divergence)
```bash
# Local rebase workflow:
git fetch origin <source-branch>
git checkout <source-branch>
git rebase origin/<target-branch>
# Resolve any conflicts, then:
git push --force-with-lease origin <source-branch>
glab mr merge !789 --project=<id> --squash --remove-source-branch
```

### Low Priority — Obsolete / Close
```bash
glab mr close !125 --project=<id> --comment "Closing: superseded by !130, 47 commits behind main and pipeline failing"
gh pr close 458 --repo owner/repo --comment "Closing: 89 commits behind main, appears obsolete"
```

---

## STEP 6: GitLab Enterprise (gitlab-ext)

For `gitlab-ext.digitalaviationservices.com`, add `--hostname gitlab-ext.digitalaviationservices.com` to every `glab` command, or set globally:

```bash
glab auth login --hostname gitlab-ext.digitalaviationservices.com
export GITLAB_HOSTNAME=gitlab-ext.digitalaviationservices.com
glab api projects/<id> --hostname gitlab-ext.digitalaviationservices.com --jq '.merge_method'
```

---

## Success Criteria (30% reduction target)

| Metric | Target |
|--------|--------|
| Open MR/PR reduction | ≥ 30% |
| Commits behind target | ≤ 50 per item (≥ 51 = recommend close) |
| Merge strategy documented | All items classified |
| Conflicts in high-priority items | 0 |
| Auth gaps reported | All identified before ops |
| Actions documented | All with timestamps and rationale |

---

## Common Issues

**"Not logged in" for glab** — run: `glab auth login` or `glab auth login --hostname gitlab-ext.digitalaviationservices.com`

**"Not logged in" for gh** — run: `gh auth login`

**glab --all-projects returns nothing** — try explicit project: `glab mr list --project=<id> --author=@me --state=opened`

**gh pr list returns nothing** — check token scope: `gh auth status --show-token`

**`mergeStatus: cannot_be_merged` on GitLab** — common causes: conflicts, draft, pipeline blocked, not approved, WIP prefix

**GitHub `mergeable: false` with no conflict message** — check if: draft PR, pending checks, base branch protection requires admins to bypass

**Squash merge greyed out on GitHub** — repository may have `allow_squash_merge: false`. Check: `gh api repos/<owner>/<repo> --jq '.allow_squash_merge'`

**Rebase on GitHub shows conflicts** — this is expected when main has diverged significantly. Consider squash merge instead as an alternative

**Force-push after rebase** — always use `--force-with-lease` (not `--force`) to avoid overwriting others' work:
```bash
git push --force-with-lease origin <branch>
```

**Both CLIs available but only one authenticated** — operate on authenticated platform only; report which platform is unavailable