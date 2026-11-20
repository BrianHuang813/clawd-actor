# clawd-actor

A Claude Code mod: Clawd acts out the spinner word above the prompt, keeps a notebook (notes,
todos, reminders) and hands out badges. Users run it; changes ship through releases.
[CONTRIBUTING.md](CONTRIBUTING.md) is the human guide (running from a clone, drawing a costume,
what the tests check, regenerating the GIFs, releasing); this file is what to know before changing
the code. Read both.

## Layout

- `hooks/register.tsx` is the only module with side effects: hooks, `/clawd`, the files, the store,
  timers. Everything else in `hooks/` is pure and tested on its own:
  - `scenes.ts` the scenes and costumes; `svg.ts` the Desktop/VS Code drawing
  - `chat.ts` parses `/clawd`, the speech bubble, `HELP`
  - `notes.ts` the notebook: commands, the markdown files, plan picks, clean, settings defaults
  - `say.ts` every line Clawd says about the notebook, English and Chinese
  - `badges.ts` the badges and their counts
  - `book.ts` `/clawd book`'s ruled paper and the page laid out on it
- New logic goes in a pure function in one of those, with a test; `register.tsx` only wires it up.
- `tools/` are dev scripts (GIFs, `book-frames.ts`, `peek.ts`, `ci_tests.py`), not shipped behaviour.

## Rules that are easy to break

- **The bubble** is at most 3 lines at most 60 columns (`MAX_STAGE`); longer text is cut with `…`.
  Keep anything Clawd says short, and check a new line with `bubble(text, 60)`. `HELP` has a test
  that it fits.
- **Clawd's language**: commands are English; Clawd answers in Chinese when the text it is about
  holds Han characters (`langOf`), else English. Every line in `say.ts` needs both `EN` and `ZH`.
- **The notebook files** are the person's own: `~/.claude/clawd-notes.md` (notes) and
  `~/.claude/clawd-todo.md` (inbox, todos, reminders), plain markdown under `# YYYY-MM-DD` and
  `## Notes` / `## Todo` / `## Reminders` headings. Never write over a file that failed to read
  (only a missing file reads as empty), keep lines the person wrote, and go through `edit()` so
  writes are queued. A change to the format needs a migration like `splitNotebook` and is a minor
  release, called out first in its notes.
- **Nothing is deleted without being asked**: `/clawd clean` is the only thing that drops lines,
  and only finished ones older than the `keepDays` setting.
- **Settings** are `userConfig` in `.claude-plugin/plugin.json` (shown in `/config`), read by
  `readConfig` in `notes.ts`, which holds their defaults and falls back on a bad value. A new
  setting needs all three, a test with `test(name, { options }, ...)`, and a row in the README.
- A lone word that is not a command is a chat with Clawd (a Haiku call), so a new command must not
  swallow ordinary sentences: `parseNotes` returns `undefined` for "list the files", and the tests
  list such phrases.

## Checking a change

- `claude plugin validate .` and `claude plugin test .` must both pass.
- On a slow machine, running the whole suite at once can time a few tests out ("timed out after
  5000 ms", different ones each run): that is load, not a bug. Run one test file at a time to be
  sure, and never two suites side by side.
- CI runs only the tests a change touches (`tools/ci_tests.py` follows each test's imports);
  `git diff --name-only main | python3 tools/ci_tests.py` shows the pick.

## Commits and releases

- Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `ci:`, `chore:`), in
  English, the body saying why.
- Pushing to `main` reaches no user until `version` in `.claude-plugin/plugin.json` is bumped.
  When to bump follows the table under Releasing in CONTRIBUTING.md: features and urgent fixes
  right away, small changes once five are waiting. Pull requests leave `version` alone.
- `gh release create` tags on GitHub only: `git fetch --tags` before counting what waits to ship.
- Docs that change with the code: the README's command and settings tables, its **New in** line on
  a minor release, and CONTRIBUTING.md's badge table.
