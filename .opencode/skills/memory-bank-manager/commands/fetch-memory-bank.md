# Fetch Memory Bank

Pulls the latest changes from all memory bank repos and outputs the content of every file that changed since the last time this command was invoked. A marker file (`~/.local/state/memory-bank-last-fetch`) tracks the timestamp across sessions.

**Usage:**
- `/fetch-memory-bank` — all changes since last session
- `/fetch-memory-bank ecr_module` — only changes under paths matching `ecr_module`

```bash
bash << 'FETCHMB'
set -uo pipefail

FEATURE="${1:-}"
MARKER="$HOME/.local/state/memory-bank-last-fetch"
MEMORY_REPOS=(
    "$HOME/Documents/codex-memory"
    "$HOME/Documents/cline-memory"
    "$HOME/Documents/jepp-memory"
)

# Determine since-timestamp
if [[ -f "$MARKER" ]]; then
    SINCE=$(cat "$MARKER")
    echo "Fetching changes since: $SINCE"
else
    SINCE=$(date -d '7 days ago' '+%Y-%m-%d %H:%M:%S' 2>/dev/null \
         || date -v-7d '+%Y-%m-%d %H:%M:%S' 2>/dev/null \
         || echo "1970-01-01 00:00:00")
    echo "No prior marker found — fetching last 7 days (since: $SINCE)"
fi
[[ -n "$FEATURE" ]] && echo "Filtering to feature: $FEATURE" || echo "Scope: entire memory bank"
echo ""

# Pull all repos silently first
for repo in "${MEMORY_REPOS[@]}"; do
    [[ -d "$repo/.git" ]] || continue
    git -C "$repo" fetch --all --prune --quiet 2>/dev/null || true
    git -C "$repo" pull --rebase --autostash --quiet 2>/dev/null \
        || git -C "$repo" pull --quiet 2>/dev/null || true
done

found_any=false

for repo in "${MEMORY_REPOS[@]}"; do
    [[ -d "$repo/.git" ]] || continue
    repo_name="$(basename "$repo")"

    if [[ -n "$FEATURE" ]]; then
        changed=$(git -C "$repo" log \
            --since="$SINCE" \
            --pretty=format: \
            --name-only \
            -- "*${FEATURE}*" "*/${FEATURE}/*" "${FEATURE}*" \
            2>/dev/null | sort -u | grep -v '^$' || true)
    else
        changed=$(git -C "$repo" log \
            --since="$SINCE" \
            --pretty=format: \
            --name-only \
            2>/dev/null | sort -u | grep -v '^$' || true)
    fi

    if [[ -z "$changed" ]]; then continue; fi
    found_any=true
    echo "=== $repo_name ==="
    while IFS= read -r file; do
        [[ -z "$file" ]] && continue
        full="$repo/$file"
        [[ -f "$full" ]] || continue
        echo "--- $file ---"
        cat "$full" | head -60
        echo ""
    done <<< "$changed"
    echo ""
done

$found_any || echo "No changes found since $SINCE"
date '+%Y-%m-%d %H:%M:%S' > "$MARKER"
FETCHMB
```

Run the bash block above. After completion, confirm how many repos were scanned and how many files changed.