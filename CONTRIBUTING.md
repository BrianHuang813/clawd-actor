# Contributing to clawd-actor

Bug reports, ideas and new scenes are welcome.

**Found a bug or have an idea?** [Open an issue](https://github.com/BrianHuang813/clawd-actor/issues):
say what you saw and what you expected, with your Claude Code version and terminal. A screenshot
helps with anything drawn wrong.

**Want to change something?** Send a pull request:

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

4. If the change shows in one of the GIFs, regenerate it (see below).
5. Open a pull request against `main`. Say what changes on stage; a GIF or a few frames help.
   Leave `version` in `.claude-plugin/plugin.json` alone: it is bumped when a release goes out.

**Adding a scene:** write it as a function in `scenes` in `hooks/scenes.ts`, give it spinner-word
stems in `VERBS`, and add a word that picks it to `PROBE` in `tests/scenes.test.ts`. The tests then
check it on its own.

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
the mods beneath get the rows Clawd leaves them, that the update notice shows only when `main` carries a newer version, and that the
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
```

`tools/render.py` uses DejaVu Sans Mono (and Droid Sans Fallback for 閃身步) and draws block
elements as exact rectangles; edit the font paths at its top for your system.

## Releasing (maintainers)

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
