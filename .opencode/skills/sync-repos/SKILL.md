---
name: sync-repos
description: "Commit and push all memory bank repos (~/Documents/codex-memory, cline-memory, jepp-memory). Each is a different branch of matkoz111/memorybank on GitLab. Handles protected branches via MR. USE FOR: save memory, commit memory, push memory, sync repos, update memory bank, commit and push. Pass optional commit message as $ARGUMENTS."
---
## DudiCoach Context

- **Source of truth:** `docs/engineering-policy.md`.
- **This skill is for the personal memory bank repos** (`~/Documents/codex-memory`, `cline-memory`, `jepp-memory` on GitLab `matkoz111/memorybank`).
- **Not DudiCoach-specific:** DudiCoach lives on GitHub (`dawidmalickilodz/DudiCoach`) and uses PRs, not GitLab MRs.


# Sync All Memory Bank Repos

Commit and push changes across all three memory repos. Each is a different branch of `matkoz111/memorybank` on GitLab.

| Directory | Branch | Push method |
|---|---|---|
| `~/Documents/codex-memory` | `codex` | Direct push |
| `~/Documents/cline-memory` | `cline` | Protected → feature branch + MR via API |
| `~/Documents/jepp-memory` | `jepp` | Protected → feature branch + MR via API |

## Steps

### 1. Load token & set message

```bash
source ~/.private-env
MSG="${ARGUMENTS:-chore: update memory bank $(date +%Y-%m-%d)}"
```

### 2. Check status of all repos

```bash
for REPO in codex-memory cline-memory jepp-memory; do
  git -C "$HOME/Documents/$REPO" fetch --all --quiet 2>/dev/null
  echo "=== $REPO ===" && git -C "$HOME/Documents/$REPO" status --short
done
```

Skip repos with nothing to commit and nothing to push.

### 3. codex-memory — direct push

```bash
cd ~/Documents/codex-memory && git checkout codex && git pull --rebase --autostash --quiet
DIRTY=$(git status --short | wc -l | tr -d ' ')
AHEAD=$(git rev-list --count origin/codex..HEAD 2>/dev/null || echo 0)

if [ "$DIRTY" -gt 0 ]; then
  git add -A && git commit -m "$MSG"
fi
if [ "$AHEAD" -gt 0 ] || [ "$DIRTY" -gt 0 ]; then
  git push && echo "✅ codex-memory pushed"
else
  echo "⏭ codex-memory — nothing to do"
fi
```

### 4. cline-memory — protected branch → MR

```bash
cd ~/Documents/cline-memory && git checkout cline && git pull --rebase --autostash --quiet
DIRTY=$(git status --short | wc -l | tr -d ' ')
AHEAD=$(git rev-list --count origin/cline..HEAD 2>/dev/null || echo 0)

if [ "$DIRTY" -gt 0 ] || [ "$AHEAD" -gt 0 ]; then
  BRANCH="update/memory-$(date +%Y%m%d-%H%M)"
  [ "$AHEAD" -eq 0 ] && git checkout -b "$BRANCH" && git add -A && git commit -m "$MSG" || git checkout -b "$BRANCH"
  git push -u origin "$BRANCH"

  IID=$(curl -s --header "PRIVATE-TOKEN: $MATKOZ_GITLAB_TOKEN" \
    -X POST "https://gitlab.com/api/v4/projects/matkoz111%2Fmemorybank/merge_requests" \
    -d "source_branch=$BRANCH&target_branch=cline&title=$MSG&remove_source_branch=true" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['iid'])")
  echo "cline MR !$IID created"

  # Rebase (ff-only repo) then merge
  curl -s --header "PRIVATE-TOKEN: $MATKOZ_GITLAB_TOKEN" \
    -X PUT "https://gitlab.com/api/v4/projects/matkoz111%2Fmemorybank/merge_requests/$IID/rebase" > /dev/null
  sleep 4
  STATE=$(curl -s --header "PRIVATE-TOKEN: $MATKOZ_GITLAB_TOKEN" \
    -X PUT "https://gitlab.com/api/v4/projects/matkoz111%2Fmemorybank/merge_requests/$IID/merge" \
    -d "should_remove_source_branch=true" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('state','error'))")
  echo "✅ cline MR !$IID → $STATE"

  git checkout cline && git pull --quiet
  git branch -d "$BRANCH" 2>/dev/null || true
else
  echo "⏭ cline-memory — nothing to do"
fi
```

### 5. jepp-memory — protected branch → MR

Same pattern as cline-memory but `target_branch=jepp`.

```bash
cd ~/Documents/jepp-memory && git checkout jepp && git pull --rebase --autostash --quiet
DIRTY=$(git status --short | wc -l | tr -d ' ')
AHEAD=$(git rev-list --count origin/jepp..HEAD 2>/dev/null || echo 0)

if [ "$DIRTY" -gt 0 ] || [ "$AHEAD" -gt 0 ]; then
  BRANCH="update/memory-$(date +%Y%m%d-%H%M)"
  [ "$AHEAD" -eq 0 ] && git checkout -b "$BRANCH" && git add -A && git commit -m "$MSG" || git checkout -b "$BRANCH"
  git push -u origin "$BRANCH"

  IID=$(curl -s --header "PRIVATE-TOKEN: $MATKOZ_GITLAB_TOKEN" \
    -X POST "https://gitlab.com/api/v4/projects/matkoz111%2Fmemorybank/merge_requests" \
    -d "source_branch=$BRANCH&target_branch=jepp&title=$MSG&remove_source_branch=true" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['iid'])")
  echo "jepp MR !$IID created"

  curl -s --header "PRIVATE-TOKEN: $MATKOZ_GITLAB_TOKEN" \
    -X PUT "https://gitlab.com/api/v4/projects/matkoz111%2Fmemorybank/merge_requests/$IID/rebase" > /dev/null
  sleep 4
  STATE=$(curl -s --header "PRIVATE-TOKEN: $MATKOZ_GITLAB_TOKEN" \
    -X PUT "https://gitlab.com/api/v4/projects/matkoz111%2Fmemorybank/merge_requests/$IID/merge" \
    -d "should_remove_source_branch=true" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('state','error'))")
  echo "✅ jepp MR !$IID → $STATE"

  git checkout jepp && git pull --quiet
  git branch -d "$BRANCH" 2>/dev/null || true
else
  echo "⏭ jepp-memory — nothing to do"
fi
```

### 6. Final status

```bash
for REPO in codex-memory cline-memory jepp-memory; do
  BRANCH=$(git -C "$HOME/Documents/$REPO" branch --show-current)
  DIRTY=$(git -C "$HOME/Documents/$REPO" status --short | wc -l | tr -d ' ')
  [ "$DIRTY" = "0" ] && echo "✅ $REPO ($BRANCH) — clean" || echo "⚠️  $REPO ($BRANCH) — $DIRTY files uncommitted"
done
```
