---
name: list-memory-bank
description: List all feature folders in the memory bank as a table sorted by most recently modified. Use when the user wants to see what features exist in the memory bank or asks to list memory bank contents.
---

List all feature folders in the memory bank as a table sorted by most recently modified first.

Steps:
1. Determine memory bank root — use `git rev-parse --show-toplevel` from workspace root, then `memory-bank/` subdir (or `~/Documents/cline-memory`). Run `git fetch --all && git pull` first, then `ls -lath <memory-bank>/` to get directories sorted by modification date
2. Filter to only directories — exclude global files: projectBrief.md, productContext.md, systemPatterns.md, techContext.md, activeContext.md, progress.md, copilot-rules.md, memory-bank-instructions.md
3. For each feature folder read the first meaningful line from its `pt.md` or `context.md` as a one-liner description
4. Output a markdown table: Feature | Description | Last Modified
5. Separate each row with a ` ---> ` line