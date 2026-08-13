---
name: clean-memory-bank
description: Remove empty or incomplete feature folders from the memory bank. Use when the user wants to clean up, prune, or remove stale memory bank entries.
---

Clean up empty or incomplete feature folders from the memory bank.

Steps:
1. Determine memory bank root — use `git rev-parse --show-toplevel` from workspace root, then `memory-bank/` subdir (or `~/Documents/cline-memory`). Run `git fetch --all && git pull` to get latest state before scanning
2. List all directories in `<memory-bank>/features/` (or `<memory-bank>/` if no features subfolder)
3. Exclude global files: projectBrief.md, productContext.md, systemPatterns.md, techContext.md, activeContext.md, progress.md, copilot-rules.md, memory-bank-instructions.md
4. For each feature folder check pt.md, design.md, tasks.md, context.md:
   - Flag if ANY file is empty, contains only template placeholder text, or is clearly unfilled
5. Present flagged folders with a reason for each
6. Ask the user to confirm EACH deletion individually — never bulk-delete without confirmation
7. After confirmed deletions, stage ALL memory bank files (`git add .`) and push