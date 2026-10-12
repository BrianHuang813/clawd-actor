---
name: update
description: Update the clawd-actor mod (Clawd acting above the prompt) to its latest release. Use when the user runs /clawd-actor:update or asks to update, upgrade or refresh clawd-actor, Clawd's animations or "the Clawd mod".
user-invocable: true
allowed-tools:
  - Bash(claude plugin list*)
  - Bash(claude plugin marketplace update clawd-actor*)
  - Bash(claude plugin update clawd-actor@clawd-actor*)
---

# Update clawd-actor

Claude Code's own plugin manager does the update; nothing is downloaded by hand.

1. Note the installed version and scope: `claude plugin list`, the `clawd-actor@clawd-actor` entry.
   If there is none, clawd-actor was not installed from its marketplace (for example it is loaded
   with `--plugin-dir` or from a mods folder): say so, and that `git pull` in that folder updates
   it; stop here.
2. Refresh the catalog: `claude plugin marketplace update clawd-actor`.
3. Update: `claude plugin update clawd-actor@clawd-actor`, adding `--scope <scope>` when step 1
   showed a scope other than `user`.
4. Report in one or two lines: the version before and after, or that it was already the latest.
   After an update, tell the user to run `/reload-plugins` (or restart Claude Code) to load it.

If a command fails, show its error as is and stop; do not retry with other flags.
