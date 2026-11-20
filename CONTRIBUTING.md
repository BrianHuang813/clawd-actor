# Contributing to clawd-actor

Bug reports, ideas and new scenes are welcome.

**Found a bug or have an idea?** [Open an issue](https://github.com/BrianHuang813/clawd-actor/issues):
say what you saw and what you expected, with your Claude Code version and terminal. A screenshot
helps with anything drawn wrong.

**Want to change something?** Read [CLAUDE.md](CLAUDE.md) first: how the code is laid out and
the rules that are easy to break (Claude Code reads it on its own). Then send a pull request:

1. Fork the repository, clone your fork and make a branch for the change.
2. Run Clawd from your clone. If you have the marketplace version installed, turn it off while you
   work, as two plugins of the same name cannot load together:

   ```sh
   claude plugin disable clawd-actor@clawd-actor   # enable it again when you are done
   claude --plugin-dir .
   ```

3. Check the change; both must pass:

   ```sh
   claude plugin validate .
   claude plugin test .
   ```

   CI runs them on every push and pull request, but only the tests the change touches:
   `tools/ci_tests.py` follows each test's imports, skips docs-only changes, and runs everything
   for a file it cannot place. `git diff --name-only main | python3 tools/ci_tests.py` shows the pick.

4. If the change shows in one of the GIFs, regenerate it (see below).
5. Open a pull request against `main`. Say what changes on stage; a GIF or a few frames help.
   Leave `version` in `.claude-plugin/plugin.json` alone: it is bumped when a release goes out.

**Adding a scene:** write it as a function in `scenes` in `hooks/scenes.ts`, give it spinner-word
stems in `VERBS`, and add a word that picks it to `PROBE` in `tests/scenes.test.ts`. The tests then
check it on its own.

## Dress Clawd for a badge

Every badge can earn Clawd a costume, and most still have none: this is the easiest way in, and
each one is a small pull request of its own. Marathon's runner's kit is the example to follow.

| Badge (id) | How it is earned | Costume |
| --- | --- | --- |
| `marathon` | a turn of 10 minutes | a red headband and a 42 race bib, in `run` and `walk` |
| `hello` | say anything to Clawd | up for grabs |
| `petLover` | pet Clawd 100 times | up for grabs |
| `foodie` | feed Clawd 50 cookies | up for grabs |
| `scribe` | write 20 notes | up for grabs |
| `finisher` | tick off 50 todos | up for grabs |
| `cleanSlate` | finish all of a day's todos | up for grabs |
| `onTime` | set 10 reminders | up for grabs |
| `busyBee` | 50 turns in a day | up for grabs |
| `regular` | 7 days in a row | up for grabs |
| `nightOwl` | a turn between midnight and 4 a.m. | up for grabs |

To claim one, open an issue saying which badge and what Clawd wears, so two people do not draw the
same one. Then:

1. **Pick the scenes** it is worn in. They must be scenes without a costume of their own (`DRESSED`
   in `hooks/scenes.ts` lists those that have one), and should suit it: a nightcap in `idle`, say.
   A scene can carry one reward only, so check `REWARDS` for scenes already taken.
2. **Draw it** as a `Costume` next to `RUNNER` in `hooks/scenes.ts`. `dress(g, x, y)` gets Clawd's
   left column `x` and head row `y`: the row above (`y - 1`) is for hats, `y + 1` is the body with
   the arms at its ends, and `y + 2` the legs. `put(g, x, y, text, color, bg)` paints, spaces left
   transparent. Keep to the five face cells' edges (`x + 1` to `x + 7` on the head row): the tests
   fail on anything drawn over the face. Use colours that show on dark and light terminals alike
   (charcoal `#3A3A42` rather than black).
3. **Give it to the badge**: one line in `REWARDS`, `<badge id>: { scenes: [...], costume: ... }`.
   The first scene listed is where Clawd shows it off as the badge is earned.
4. **Look at it** without starting Claude Code: `node tools/peek.ts <scene> <badge id> 8` prints
   frames as drawn and with the costume on, side by side (shapes only, no colours).
5. **Check it**: `claude plugin test .` checks every reward on its own, at three stage widths: that
   it shows only in its scenes and only once earned, keeps the stage size and Clawd's face, and that
   a hat stays on stage when Clawd hops. Add a row to the table above and to the badge table in
   `README.md`, and attach a few frames from `tools/peek.ts` (or a screenshot, for the colours) to
   the pull request.

## What the tests check

That every scene keeps the stage size at 30, 40 and 60 columns and moves Clawd about only in the
scenes without set pieces (the rest are checked to stay put), that no prop is ever drawn over
Clawd's face, that the dressed-up scenes put their costume on Clawd and keep its hat on stage even mid-hop, that a turn opens on the running tool or the spinner word and then rotates through
every other scene whatever tools run, picking up where the last turn stopped, that a scene holds
for its whole act, that the timer animates Clawd during a turn, keeps it going when a subagent's turn ends or
`/reload-plugins` runs, and lets go after the turn, that Clawd stays out while a command (not a turn) keeps
the engine busy and starts moving once a turn starts, even on a band drawn just before it, that `/clawd`
plays its reactions between turns and shows Haiku's answer (or a fallback) in a bubble that fits
any script (combining marks included), that `/clawd shift` calls 閃身步 a character at a time
before the dash and leaves afterimages that fade, wherever the frame counter stands, that only the latest `/clawd` gets its answer shown, that
the mods beneath get the rows Clawd leaves them, that `/clawd book` draws the day on ruled paper filling the pane, ticks and unticks a
line, folds a part and adds what is typed, that the `animate` setting off keeps Clawd out of turns,
that the update notice shows only when `main` carries a newer version, and that the
first session after an update says what is new, once.

Block characters and symbols are drawn one cell wide; a terminal font that draws some of them
wider may shift a frame.

## Regenerating the GIFs

With Node 22+ and Python with Pillow:

```sh
node tools/frames.ts > frames.json      # the frames, straight from hooks/scenes.ts
python tools/render.py frames.json assets/demo.gif
node tools/chat-frames.ts > chat.json   # a mid-turn /clawd chat, with hooks/chat.ts's bubble
python tools/render.py chat.json assets/chat.gif
node tools/notebook-frames.ts > notebook.json   # the notebook and a badge, with hooks/say.ts's lines
python tools/render.py notebook.json assets/notebook.gif
node tools/book-frames.ts > book.json           # /clawd book's pane, with hooks/book.ts's paper and page
python tools/render.py book.json assets/book.gif
```

`tools/render.py` uses DejaVu Sans Mono (and Droid Sans Fallback for 閃身步) and draws block
elements as exact rectangles; edit the font paths at its top for your system.

## Releasing (maintainers)

Push to `main` as often as you like: CI runs, and nothing reaches anyone until the version is
bumped. Releases are batched, so people are not asked to update for every small change.

| Change | Version | When it goes out |
| --- | --- | --- |
| A new feature or a big change: a command, setting, scene or badge, or a change to the notebook files' format | minor | right away, once checked in a real session |
| A bug that loses or garbles notebook data, breaks a command, or crashes the mod | patch | right away |
| A small change: any other fix, wording, help text, a tweak | patch | once five or more have piled up |
| Docs, tests, CI | none | with the next release; they do not count toward the five |

- Count the small changes since the last tag: the `fix:`, `feat:`, `refactor:` and `perf:`
  commits (`git fetch --tags && git log $(git describe --tags --abbrev=0)..HEAD --oneline`; the
  fetch matters, as `gh release create` makes the tag on GitHub only).
- Before a release: CI is green on `main`, and the notes cover everything since the last tag,
  with any change to the notebook files called out first.
- A minor release also updates the README's **New in** line.

1. Bump `version` in `.claude-plugin/plugin.json` in the commit that ships the change.
   `claude plugin update` and the update notice go by that number alone, so code merged without a
   bump never reaches anyone (a change to docs alone needs none).
2. Merge or push it to `main`.
3. Tag the commit and publish its release notes; tags and releases are the changelog, updates do
   not read them:

   ```sh
   git tag -a v0.6.0 -m "clawd-actor 0.6.0" && git push origin v0.6.0
   gh release create v0.6.0 --title "clawd-actor 0.6.0 — …" --notes "…"
   ```
