import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { ACT_FRAMES, FRAME_MS, frameRows, H, sceneAt, type Mode } from './scenes'

const MAX_STAGE = 60 // widest the wander roams, however wide the terminal
const frame = atom({ plugin: 'clawd-actor', key: 'frame' } as const, 0)

// The spinner's word, read while it draws. State cannot be written during a render,
// so it lives here; the frame timer's redraws pick it up.
let word = 'Thinking'
let mode: Mode = 'thinking'
let isTurnRunning = false
let turnBase = 0 // the frame the turn started on: acts count from it
let seed = 0 // shuffles the session's rotation of scenes
let played = 0 // rotation acts earlier turns got through
const running: { id: string; tool: string }[] = [] // tools in flight, newest last

export const register: Register = on => {
  // A timer must start where work may outlive the dispatch: session.start (fires again on reload).
  // It ticks all session long but only writes, and so redraws, while a turn runs.
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    seed = Math.floor(await $.clock.now()) % 9973
    played = 0
    $.clock.every(FRAME_MS, () => (isTurnRunning ? update($, frame, f => (f + 1) % 100_000) : undefined))
    return r
  })

  on('turn.start', async ($, e, next) => {
    isTurnRunning = true
    turnBase = await read($, frame)
    running.length = 0
    return next(e)
  })

  // While a tool runs Clawd acts it out; back to the rotation once it returns
  on('tool.call', async ($, e, next) => {
    running.push({ id: e.tool_use_id, tool: e.tool })
    try {
      return await next(e)
    } finally {
      const i = running.findIndex(r => r.id === e.tool_use_id)
      if (i >= 0) running.splice(i, 1)
    }
  })

  on('turn.complete', async ($, e, next) => {
    isTurnRunning = false
    played += Math.floor(((await read($, frame)) - turnBase) / ACT_FRAMES) // acts after the opener
    return next(e)
  })

  // Observe only: remember what the spinner says, let the engine draw it as usual
  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    word = e.props.message ?? e.props.word
    mode = e.props.mode
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e) // keep whatever other band mods draw here
    // isWorking is the engine's own word on whether a turn runs
    if (e.props.hasSurvey || !e.props.isWorking) return below

    const t = await read($, frame)
    const { Box, Text } = $.ui.resolve(e)
    const scene = sceneAt({ word, mode, tick: t - turnBase, seed, played, tool: running[running.length - 1]?.tool })
    const rows = frameRows(word, mode, t, Math.min(e.props.bodyColumns, MAX_STAGE), scene)

    return (
      <Box flexDirection="column">
        <Box flexDirection="column" height={H}>
          {rows.map(runs => (
            <Text>
              {runs.map(r => (r.color ? <Text color={r.color} backgroundColor={r.bg}>{r.text}</Text> : r.text))}
            </Text>
          ))}
        </Box>
        {below}
      </Box>
    )
  })
}
