import { test, expect } from 'claude-code/testing'
import { frameRows, SCENE_NAMES, WANDERS, H, sceneFor, sceneAt, sceneForTool, ACT_FRAMES } from '../hooks/scenes'

const PROBE: Record<string, string> = { think: 'Pondering', cook: 'Cooking', bake: 'Baking', brew: 'Brewing', walk: 'Moseying', run: 'Scampering',
  moonwalk: 'Moonwalking', herd: 'Herding', spin: 'Spinning', magic: 'Conjuring', levitate: 'Levitating', hatch: 'Hatching', grow: 'Sprouting',
  forge: 'Forging', compute: 'Computing', type: 'Xyzzy', talk: 'Xyzzy', dance: 'Vibing', juggle: 'Juggling', honk: 'Honking', sketch: 'Sketching',
  weather: 'Misting', thunder: 'Thundering', dig: 'Burrowing', flow: 'Flowing', kick: 'Kicking', skate: 'Skating', campfire: 'Kindling', chalk: 'Deciphering', idle: 'Xyzzy' }
const modeOf = (name: string) => (name === 'type' ? 'tool-use' : name === 'talk' ? 'responding' : 'requesting') as any

const TRAVELS = new Set(['walk', 'run', 'moonwalk', 'herd', 'dig', 'skate', 'chalk'])

test('every scene keeps the stage size; Clawd roams only where its props can come along, and no prop hides its face', { timeoutMs: 60_000 }, () => {
  for (const width of [30, 40, 60])
    for (const name of SCENE_NAMES) {
      expect(sceneFor(PROBE[name], modeOf(name))).toBe(name)
      const columns = new Set<number>()
      for (let t = 0; t < 120; t++) {
        const rows = frameRows(PROBE[name], modeOf(name), t, width).map(r => r.map(x => x.text).join(''))
        expect(rows.length).toBe(H)
        for (const r of rows) expect([...r].length).toBe(width)
        const col = rows.map(r => [...r].indexOf('▐')).find(i => i >= 0) // Clawd's head; the little ones have none
        if (col !== undefined) columns.add(col)
        // each head row reads ▐ + five face cells + ▌, nothing drawn over it
        for (const r of rows) for (const m of r.matchAll(/▐/g)) expect(r.slice(m.index, m.index + 7)).toMatch(/^▐[▛▜█^]{5}▌$/)
      }
      if (!WANDERS.has(name) && !TRAVELS.has(name)) expect(columns.size).toBe(1) // stays by its pot, board, anvil…
      else if (width >= 40) expect(columns.size).toBeGreaterThan(4)
    }
})

test('a turn opens on the spinner word, then rotates through every other scene; a running tool wins', () => {
  for (const seed of [0, 17, 4242]) {
    const cue = (act: number, tool?: string) => ({ word: 'Sauteing', mode: 'thinking' as const, tick: act * ACT_FRAMES + 3, seed, tool })
    expect(sceneAt(cue(0))).toBe('cook')
    const seen = new Set<string>()
    for (let act = 1; act <= 60; act++) {
      const s = sceneAt(cue(act))
      expect(s).not.toBe('cook')
      expect(s).not.toBe(sceneAt(cue(act + 1))) // every act changes scene
      seen.add(s)
    }
    expect(seen.size).toBe(SCENE_NAMES.length - 4) // all but idle, type, talk and the opening cook
    expect(sceneAt(cue(0, 'Bash'))).toBe('type')
    expect(sceneAt(cue(9, 'Edit'))).toBe('sketch')
  }
  expect(sceneForTool('Grep')).toBe('think')
  expect(sceneForTool('Agent')).toBe('herd')
  expect(sceneForTool('WebFetch')).toBe('weather')
  expect(sceneForTool('mcp__x__y')).toBe('magic')
  expect(sceneForTool('Something')).toBe('forge')
})
