---
name: update-memory-bank
description: Update the memory bank by pulling latest changes and refreshing activeContext.md and progress.md with current state, then committing and pushing. Use when the user asks to update, sync, or refresh the memory bank.
---

Update the memory bank by refreshing all core files with the latest context.

Steps to follow:
1. Navigate to the memory bank root — use `git rev-parse --show-toplevel` to find the workspace root, then `memory-bank/` subdirectory (or `~/Documents/cline-memory` if symlinked)
2. Run `git fetch --all` then `git pull` to get latest changes
3. Review recent git log (last 7 days) for completed work, new tasks, and decisions
4. Update `activeContext.md` with current focus, recent changes, and active decisions
5. Update `progress.md` with latest task completion status and what's next
6. Check all feature folders and update their `context.md` and `tasks.md` if out of sync with main files
7. Stage ALL memory bank files (`git add .`) — do not cherry-pick only the files you touched; commit with message `update: memory bank — <describe what changed>`, then push
8. Confirm what was updated and pushed