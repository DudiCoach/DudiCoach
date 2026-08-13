---
name: switch-memory-bank
description: Switch active memory bank context to a specific feature folder. Use when the user wants to focus on a specific feature or says "switch to <feature>".
argument-hint: <feature-name>
---

Switch active memory bank context to the feature folder specified as $ARGUMENTS.

Steps:
1. Determine memory bank root — use `git rev-parse --show-toplevel` from workspace root, then `memory-bank/` subdir (or `~/Documents/cline-memory`). Run `git fetch --all && git pull`
2. Refresh activeContext.md and progress.md with latest state
3. Navigate to `<memory-bank>/features/$ARGUMENTS/` (or `<memory-bank>/$ARGUMENTS/` if no features subfolder)
4. Load files with these mappings:
   - `context.md` → acts as activeContext.md for this feature
   - `tasks.md` → acts as progress.md for this feature
   - `copilot-rules.md` from the core memory bank applies globally
5. Summarize the loaded feature: current state, active tasks, next steps
6. Confirm the switch and wait for the next command