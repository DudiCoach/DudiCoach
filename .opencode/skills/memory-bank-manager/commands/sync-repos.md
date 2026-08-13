# Sync Repos

Execute the following bash block to synchronize all memory bank repos and the current workspace. Self-contained — no external script required.

```bash
bash << 'SYNC'
set -uo pipefail

MEMORY_REPOS=(
    "$HOME/Documents/codex-memory"
    "$HOME/Documents/cline-memory"
    "$HOME/Documents/jepp-memory"
)
WORKSPACE="${1:-$PWD}"

header() { echo ""; echo "--- $1 ---------------------------------"; }
ok()     { echo "  * $*"; }
info()   { echo "  -> $*"; }
warn()   { echo "  ! $*"; }

# Returns list of gh CLI accounts
gh_accounts() {
    command -v gh &>/dev/null || return
    gh auth status 2>/dev/null \
        | grep -E "Logged in to .* account" \
        | grep -oP 'account \K\S+' \
        || true
}

# Try pull using a specific gh CLI account's token
try_pull_gh() {
    local user="$1"
    local token
    token=$(gh auth token --hostname github.com --user "$user" 2>/dev/null) || return 1
    git -c "credential.helper=!f(){ echo username=$user; echo password=$token; }; f" \
        pull --rebase --autostash --quiet 2>/dev/null \
    || git -c "credential.helper=!f(){ echo username=$user; echo password=$token; }; f" \
        pull --quiet 2>/dev/null
}

# Try pull using GCM manager directly
try_pull_gcm() {
    git -c "credential.helper=" \
        -c "credential.helper=manager" \
        -c "credential.credentialStore=secretservice" \
        pull --rebase --autostash --quiet 2>/dev/null \
    || git -c "credential.helper=" \
        -c "credential.helper=manager" \
        -c "credential.credentialStore=secretservice" \
        pull --quiet 2>/dev/null
}

# Pull with fallback through all available credential strategies
pull_with_fallback() {
    if git pull --rebase --autostash --quiet 2>/dev/null || git pull --quiet 2>/dev/null; then
        return 0
    fi
    local remote_url
    remote_url=$(git remote get-url origin 2>/dev/null || echo "")
    [[ "$remote_url" != https://github.com/* ]] && { warn "pull failed (non-GitHub or SSH remote)"; return 1; }
    info "pull failed -- trying gh CLI accounts..."
    for user in $(gh_accounts); do
        info "  trying $user..."
        if try_pull_gh "$user"; then ok "  succeeded with gh account: $user"; return 0; fi
    done
    info "gh accounts failed -- trying GCM directly..."
    if try_pull_gcm; then ok "  succeeded with GCM"; return 0; fi
    warn "all credential strategies failed for $(basename "$PWD")"
    return 1
}

sync_repo() {
    local repo="${1%/}" name
    name="$(basename "$repo")"
    git -C "$repo" rev-parse --show-toplevel >/dev/null 2>&1 || { warn "skipping $name -- not a valid git repo"; return; }
    header "$name"; cd "$repo"
    info "fetching..."
    git fetch --all --prune --quiet 2>/dev/null || { warn "fetch failed, skipping $name"; return; }
    local stashed=false
    if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet; then
        git stash --quiet 2>/dev/null && stashed=true && info "stashed local changes"
    fi
    if pull_with_fallback; then
        ok "pulled latest"
    else
        warn "pull failed"
    fi
    $stashed && { git stash pop --quiet 2>/dev/null && info "restored stashed changes"; }
}

# Sync all memory repos
for repo in "${MEMORY_REPOS[@]}"; do
    [[ -d "$repo/.git" ]] || continue
    sync_repo "$repo"
done

# Also sync the current workspace if it's a git repo
if [[ -d "$WORKSPACE/.git" ]]; then
    header "$(basename "$WORKSPACE") (workspace)"
    cd "$WORKSPACE"
    git fetch --all --prune --quiet 2>/dev/null || true
    if pull_with_fallback; then ok "pulled latest"; else warn "pull skipped"; fi
fi

echo ""; echo "Sync complete."
SYNC
```

Run the bash block above. After completion, confirm which repos were synced and any failures.