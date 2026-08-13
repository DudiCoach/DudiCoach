---
name: dump-memory
description: Save current session context into memory bank feature folders. Use at end of session or when user asks to dump, save, or persist session memory.
---

Dump current session context into the memory bank as feature folders.

Steps:
1. Determine memory bank root — use `git rev-parse --show-toplevel` from workspace root, then `memory-bank/` subdir (or `~/Documents/cline-memory` if symlinked). Run `git fetch --all && git pull` there before writing anything
2. Review the current conversation to identify all features or tasks worked on
3. For each feature, check if a folder exists at `<memory-bank>/features/<feature-name>/`
4. If a folder does NOT exist:
   - Propose a concise kebab-case folder name
   - Ask the user to confirm before creating anything
   - Once confirmed, create the folder with: pt.md, design.md, tasks.md, context.md
   - Fill each file with all available session information:
     - pt.md: problem/goal, scope, acceptance criteria
     - design.md: architecture, decisions, tech stack
     - tasks.md: tasks with IDs, descriptions, status (done/in-progress/todo)
     - context.md: current state, blockers, next steps
5. If a folder already exists and is up to date, leave it unchanged
6. Never create the same folder twice
7. Stage ALL memory bank files (`git add .`) — not just the folders you created; commit with message `chore: dump memory bank - <date>`, then push