// Clawd's stage: a width x H grid of cells. Every scene draws Clawd plus props for one frame,
// then the whole frame wanders left and right across the stage.
// Pure functions only, so the frames can be checked without the engine.

export const W = 40 // default stage width; the band passes its own
export const H = 4
export const ORANGE = '#D77757'

export type Cell = { ch: string; color?: string }
export type Grid = Cell[][]

const blank = (width: number): Grid => Array.from({ length: H }, () => Array.from({ length: width }, () => ({ ch: ' ' })))

/** Paints `s` at (x, y); spaces are transparent so props can overlap Clawd's gaps. */
const put = (g: Grid, x: number, y: number, s: string, color?: string) => {
  if (y < 0 || y >= H) return
  ;[...s].forEach((ch, i) => {
    const cx = x + i
    if (ch !== ' ' && cx >= 0 && cx < g[y].length) g[y][cx] = { ch, color }
  })
}

// Clawd, 9 columns x 3 rows, as the welcome banner draws it
const TOP = { open: ' ▐▛███▜▌ ', blink: ' ▐█████▌ ' }
const MID = { down: '▝▜█████▛▘', up: '▗▟█████▙▖', left: '▗▟█████▛▘', right: '▝▜█████▙▖' }
const LEGS = { stand: '  ▘▘ ▝▝  ', a: '  ▘ ▘▝ ▝ ', b: ' ▘ ▘ ▝ ▝ ', tuck: '         ' }

type Pose = {
  x?: number
  lift?: 0 | 1
  eyes?: keyof typeof TOP
  arms?: keyof typeof MID
  legs?: keyof typeof LEGS
}

// What the wander is doing this frame; scenes read it through clawd() so every pose walks along
const stride = { moving: false, hop: false, width: W }
/** Columns a travelling scene may roam: the stage less Clawd and its trailing props. */
const roam = (extra: number) => Math.max(4, stride.width - 11 - extra)

const clawd = (g: Grid, t: number, pose: Pose = {}) => {
  const x = pose.x ?? 2
  const y = 1 - (pose.lift ?? (stride.hop ? 1 : 0))
  const eyes = pose.eyes ?? (t % 24 === 0 ? 'blink' : 'open') // blinks on its own
  const swing = t % 2 === 0 ? 'left' : 'right'
  put(g, x, y, TOP[eyes], ORANGE)
  put(g, x, y + 1, MID[pose.arms ?? (stride.moving ? swing : 'down')], ORANGE)
  put(g, x, y + 2, LEGS[pose.legs ?? (stride.moving ? walkLegs(t) : 'stand')], ORANGE)
}

/** Back-and-forth position over `span` columns. */
const pingPong = (t: number, span: number) => {
  const p = t % (span * 2)
  return p < span ? p : span * 2 - p
}
const walkLegs = (t: number) => (t % 2 === 0 ? 'a' : 'b') as Pose['legs']
const pick = <T,>(xs: readonly T[], t: number) => xs[t % xs.length]

type Scene = (g: Grid, t: number) => void

const GRAY = 'gray'
const scenes: Record<string, Scene> = {
  idle: (g, t) => clawd(g, t, { lift: t % 12 === 6 ? 1 : 0 }),

  think: (g, t) => {
    clawd(g, t, { arms: t % 16 < 8 ? 'down' : 'right' })
    const bubble = ['·', '· ∘', '· ∘ ○', '· ∘ ○ ?', '· ∘ ○ !'][Math.floor(t / 3) % 5]
    put(g, 11, 0, bubble, GRAY)
  },

  cook: (g, t) => {
    clawd(g, t, { arms: t % 4 < 2 ? 'left' : 'right' }) // stirring
    put(g, 12, 1, pick(['  ~  ', ' ~ ≈ ', '≈ ~ ≈', ' ≈ ~ '], t), GRAY)
    put(g, 12, 2, '▄▄▄▄▄', 'white')
    put(g, 12, 3, '▀███▀', 'white')
    put(g, 11, 2, t % 4 < 2 ? '\\' : '|', 'yellow') // spoon
  },

  bake: (g, t) => {
    clawd(g, t, { arms: t % 10 < 5 ? 'right' : 'down' })
    put(g, 12, 1, '┌────┐', 'white')
    put(g, 12, 2, `│${pick(['▒░▒░', '░▒░▒'], t)}│`, 'white')
    put(g, 13, 2, pick(['▒░▒░', '░▒░▒'], t), 'red')
    put(g, 12, 3, '└────┘', 'white')
    put(g, 14, 0, pick(['~', ' ~', '~ ~'], Math.floor(t / 2)), GRAY)
  },

  brew: (g, t) => {
    clawd(g, t, { arms: 'right' })
    put(g, 12, 1, pick([' ≈ ', '≈  ', '  ≈'], Math.floor(t / 2)), GRAY)
    put(g, 12, 2, '╭─╮╮', 'white')
    put(g, 12, 3, '╰─╯ ', 'white')
    put(g, 13, 2, '▀', 'yellow')
  },

  walk: (g, t) => clawd(g, t, { x: 1 + pingPong(t, roam(0)), legs: walkLegs(t), arms: t % 2 ? 'left' : 'right' }),

  run: (g, t) => {
    const x = 1 + pingPong(t * 2, roam(0))
    clawd(g, t, { x, legs: walkLegs(t), lift: t % 4 === 0 ? 1 : 0, arms: t % 2 ? 'left' : 'right' })
    put(g, x - 2, 2, '≡', GRAY) // speed lines
  },

  moonwalk: (g, t) => {
    const x = 1 + roam(3) - pingPong(t, roam(3))
    clawd(g, t, { x, legs: walkLegs(t), arms: 'right' })
    put(g, x + 10, 0, pick(['♪', ' ♫', '♪ ♫'], t), 'cyan')
  },

  herd: (g, t) => {
    const x = 1 + pingPong(t, roam(7))
    clawd(g, t, { x, legs: walkLegs(t), arms: 'up' })
    const dir = t % (2 * roam(7)) < roam(7) ? 1 : -1
    put(g, x + (dir > 0 ? 11 : -6), 3, pick(['o o o', ' o o o', 'o  o o'], t), 'white') // the flock
  },

  spin: (g, t) => {
    clawd(g, t, { x: 2 + (t % 2), arms: pick(['left', 'up', 'right', 'down'] as const, t) })
    put(g, 12, 0, t % 2 ? '↻' : '↺', 'cyan')
    put(g, 0, 2, pick(['(', ' ', ')', ' '], t), GRAY)
  },

  magic: (g, t) => {
    clawd(g, t, { arms: 'up', lift: t % 8 < 4 ? 1 : 0 })
    const sparks = ['✦', '✧', '⋆', '✶', '·']
    for (let i = 0; i < 5; i++) put(g, 11 + ((i * 3 + t) % 9), (i + t) % 3, pick(sparks, t + i), pick(['magenta', 'cyan', 'yellow'], i + t))
  },

  levitate: (g, t) => {
    clawd(g, t, { lift: 1, legs: 'tuck', arms: 'up' })
    put(g, 3, 3, pick(['· ✧ ·', '✧ · ✧'], t), 'cyan')
  },

  hatch: (g, t) => {
    clawd(g, t, { arms: 'right' })
    const stage = Math.floor(t / 6) % 4
    put(g, 13, 2, ['▗▄▖', '▗╱▖', '▗╳▖', '✧▖✧'][stage], 'white')
    put(g, 13, 3, '▝▀▘', 'white')
    if (stage === 3) put(g, 14, 1, '▴', ORANGE) // a tiny clawd peeks out
  },

  grow: (g, t) => {
    clawd(g, t, { arms: 'right' })
    const h = Math.floor(t / 4) % 4
    for (let i = 0; i < h; i++) put(g, 13, 3 - i, i === h - 1 ? '❀' : '│', i === h - 1 ? 'magenta' : 'green')
    put(g, 12, 3, '▁▁▁', 'yellow')
  },

  forge: (g, t) => {
    const hit = t % 4 === 0
    clawd(g, t, { arms: hit ? 'right' : 'up' })
    put(g, 11, hit ? 2 : 0, hit ? '╾' : '╤', 'white') // hammer
    put(g, 12, 3, '▀▀█▀▀', 'white')
    if (hit) put(g, 12, 1, pick(['* ✶', '✶ *'], t), 'yellow')
  },

  compute: (g, t) => {
    clawd(g, t, { arms: t % 2 ? 'left' : 'right' })
    for (let row = 1; row <= 3; row++) {
      const bits = Array.from({ length: 8 }, (_, i) => (((i + 1) * 7 + t * (row + 2)) % 3 === 0 ? '1' : '0')).join('')
      put(g, 12, row, bits, 'green')
    }
  },

  type: (g, t) => {
    clawd(g, t, { arms: t % 2 ? 'left' : 'right' })
    const keys = '▤▤▤▤▤▤'
    put(g, 12, 3, keys, GRAY)
    put(g, 12 + (t % keys.length), 3, '▣', 'white')
  },

  talk: (g, t) => {
    clawd(g, t, { arms: t % 6 < 3 ? 'right' : 'down' })
    put(g, 12, 1, pick(['‹ .   ›', '‹ ..  ›', '‹ ... ›'], t), 'white')
  },

  dance: (g, t) => {
    clawd(g, t, { lift: t % 2 ? 1 : 0, arms: t % 4 < 2 ? 'left' : 'right', legs: walkLegs(t) })
    put(g, 12, 0, pick(['♪', '♪ ♫', ' ♫ ♪', '♫'], t), 'cyan')
  },

  juggle: (g, t) => {
    clawd(g, t, { arms: t % 2 ? 'left' : 'right' })
    // left hand → over the head → right hand and back; row 1 only beside the body
    const arc: [number, number][] = [[-1, 1], [1, 0], [4, 0], [7, 0], [9, 1], [7, 0], [4, 0], [1, 0]]
    for (let b = 0; b < 3; b++) {
      const [dx, y] = arc[(t + b * 3) % arc.length]
      put(g, 2 + dx, y, 'o', pick(['red', 'yellow', 'cyan'], b))
    }
  },

  honk: (g, t) => {
    clawd(g, t, { arms: 'up', lift: t % 6 < 2 ? 1 : 0 })
    if (t % 6 < 4) put(g, 12, 1, '< HONK! >', 'yellow')
  },

  sketch: (g, t) => {
    clawd(g, t, { arms: t % 2 ? 'right' : 'down' })
    put(g, 12, 1, '┌──────┐', 'white')
    put(g, 12, 2, `│${'╱╲'.repeat(3).slice(0, (t % 7))}`.padEnd(7) + '│', 'white')
    put(g, 12, 3, '└──────┘', 'white')
  },

  weather: (g, t) => {
    clawd(g, t, { eyes: 'open', arms: 'up' })
    put(g, 3, 0, '☁☁☁', 'white')
    put(g, 3 + (t % 3), 1, '╵', 'cyan')
  },

  thunder: (g, t) => {
    clawd(g, t, { arms: t % 4 === 0 ? 'up' : 'down', lift: t % 4 === 0 ? 1 : 0 })
    put(g, 12, 0, '☁☁', GRAY)
    if (t % 4 === 0) put(g, 13, 1, 'ϟ', 'yellow')
  },

  dig: (g, t) => {
    // tunnels along the ground at a third of walking pace, dirt flying out behind
    const x = 1 + pingPong(Math.floor(t / 3), roam(2))
    const soil = '▒▓▒░▓▒▒░▓▒▓░'
    put(g, 0, 3, Array.from({ length: stride.width }, (_, i) => soil[i % soil.length]).join(''), 'yellow')
    clawd(g, t, { x, lift: 0, arms: t % 2 ? 'left' : 'right', legs: 'tuck' })
    put(g, x - 2, 2, pick(['· ', ' ∙', '∙·'], t), 'yellow')
  },

  flow: (g, t) => {
    clawd(g, t, { lift: t % 6 < 3 ? 1 : 0 })
    const wave = '∿~'
    put(g, 0, 3, Array.from({ length: 16 }, (_, i) => wave[(i + t) % 2]).join(''), 'cyan')
  },
}

// Spinner word → scene, by stem; the first match wins
const VERBS: [RegExp, string][] = [
  [/moonwalk/, 'moonwalk'],
  [/levitat|hyperspac/, 'levitate'],
  [/thunder/, 'thunder'],
  [/honk|boop|hullaballoo|shenanigan|tomfool|razzle/, 'honk'],
  [/juggl/, 'juggle'],
  [/sketch|doodl|draw/, 'sketch'],
  [/bak|proof|leaven|knead|frost|roast/, 'bake'],
  [/brew|percolat|ferment|steep/, 'brew'],
  [/cook|simmer|stew|saut|marinat|flamb|julienn|season|garnish|zest|blanch|carameli|drizzl|whisk|concoct|infus|temper|boil|fry/, 'cook'],
  [/herd|wrangl|muster/, 'herd'],
  [/scamper|scurr|skedaddl|gallop|hustl|catapult|swoop|pounc|zoom|dash/, 'run'],
  [/mosey|schlep|putter|wander|meander|perambul|gallivant|stroll|waddl|lollygag|dilly|zigzag|scuttl/, 'walk'],
  [/spin|churn|whirr|swirl|whirlpool|twist|reticulat|orbit|cascad|topsy|wibbl|combobul|coalesc|smoosh/, 'spin'],
  [/conjur|manifest|transmut|transfigur|enchant|prestidig|metamorph|quantum|warp|sublimat|ioniz|crystalli|channel|alchem/, 'magic'],
  [/hatch|incubat|nest|roost/, 'hatch'],
  [/germinat|sprout|pollinat|photosynth|cultivat|propagat|unfurl|symbiot|bloom|nucleat/, 'grow'],
  [/vib|groov|boogi|jitterbug|shimm|sock|bebop|frolic|choreograph|harmoni|orchestrat|compos|improvis|jam/, 'dance'],
  [/calculat|comput|crunch|process|infer|synthesi|analy|hash|gitif|quantif/, 'compute'],
  [/forg|craft|build|construct|tinker|form|creat|generat|actualiz|accomplish|action|effect|embellish|bootstrap|doing|work/, 'forge'],
  [/mist|nebuli|evaporat|billow|gust|precipitat|cloud/, 'weather'],
  [/burrow|spelunk|slither|dig/, 'dig'],
  [/flow|ebb|osmos|undulat|wav/, 'flow'],
  [/ponder|mus|mull|ruminat|cogitat|cerebrat|consider|contemplat|deliberat|think|philosoph|pontificat|puzzl|deciph|elucidat|envision|imagin|ideat|determin|perus|bloviat|befuddl|flummox|noodl|claud|reason/, 'think'],
]

export type Mode = 'requesting' | 'responding' | 'thinking' | 'tool-input' | 'tool-use'

/** Which scene a spinner word acts out; an unknown word falls back to what the turn is doing. */
export const sceneFor = (word: string, mode: Mode) => {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  const hit = VERBS.find(([re]) => re.test(w))
  if (hit) return hit[1]
  return mode === 'tool-use' || mode === 'tool-input' ? 'type' : mode === 'responding' ? 'talk' : mode === 'thinking' ? 'think' : 'idle'
}

// Scenes that already travel on their own (or whose ground must stay put) skip the wander
const SELF_MOVING = new Set(['walk', 'run', 'moonwalk', 'herd', 'dig'])
const PROPS_WIDTH = 22 // the widest scene's Clawd plus props, from column 0
const PAUSE = 10 // frames spent standing at each end

/** Where the wander puts the frame: stroll right, pause, stroll left, pause; a hop at each turn. */
export const wander = (t: number, width: number) => {
  const span = Math.max(0, Math.min(width - PROPS_WIDTH, 30))
  if (span === 0) return { dx: 0, moving: false, hop: false }
  const period = 2 * (span + PAUSE)
  const p = t % period
  if (p < span) return { dx: p, moving: true, hop: false }
  if (p < span + PAUSE) return { dx: span, moving: false, hop: p === span }
  if (p < 2 * span + PAUSE) return { dx: 2 * span + PAUSE - p, moving: true, hop: false }
  return { dx: 0, moving: false, hop: p === 2 * span + PAUSE }
}

const shift = (g: Grid, dx: number): Grid =>
  dx === 0 ? g : g.map(row => row.map((_, x) => (x - dx >= 0 ? row[x - dx] : { ch: ' ' })))

/** One frame of the stage, as rows of same-colour runs. */
export const frameRows = (word: string, mode: Mode, t: number, width: number = W, scene?: string) => {
  const name = scene ?? sceneFor(word, mode)
  const step = SELF_MOVING.has(name) ? { dx: 0, moving: false, hop: false } : wander(t, width)
  stride.moving = step.moving
  stride.hop = step.hop
  stride.width = width
  const g0 = blank(width)
  ;(scenes[name] ?? scenes.idle)(g0, t)
  const g = shift(g0, step.dx)
  return g.map(row => {
    const runs: { text: string; color?: string }[] = []
    for (const c of row) {
      const last = runs[runs.length - 1]
      if (last && last.color === c.color) last.text += c.ch
      else runs.push({ text: c.ch, color: c.color })
    }
    return runs
  })
}

export const SCENE_NAMES = Object.keys(scenes)

// ---- Which scene plays when: a running tool first, else the spinner word's act, then a rotation ----

/** A running tool's scene, by tool name; any other tool hammers away. */
const TOOL_SCENES: [RegExp, string][] = [
  [/^(Bash|PowerShell|Monitor)$/, 'type'],
  [/^(Read|Grep|Glob|LS)$/, 'think'],
  [/^(Edit|Write|MultiEdit|NotebookEdit)$/, 'sketch'],
  [/^(Agent|Task|SendMessage)$/, 'herd'],
  [/^Web/, 'weather'],
  [/^(TodoWrite|Skill|ToolSearch)$/, 'juggle'],
  [/^mcp__/, 'magic'],
]
export const sceneForTool = (tool: string) => TOOL_SCENES.find(([re]) => re.test(tool))?.[1] ?? 'forge'

export const FRAME_MS = 140
export const ACT_MS = 30_000 // each act runs half a minute
export const ACT_FRAMES = Math.round(ACT_MS / FRAME_MS)
const ROTATION = SCENE_NAMES.filter(n => n !== 'idle' && n !== 'type' && n !== 'talk')

export type Cue = { word: string; mode: Mode; tick: number; seed: number; tool?: string }

/**
 * The scene for this frame of a turn: the running tool's while one runs; otherwise
 * act 0 plays the spinner word, and each later act steps through the rest in an
 * order the turn's seed shuffles (a step coprime with the list's length visits all).
 */
export const sceneAt = ({ word, mode, tick, seed, tool }: Cue) => {
  if (tool) return sceneForTool(tool)
  const first = sceneFor(word, mode)
  const act = Math.floor(Math.max(0, tick) / ACT_FRAMES)
  if (act === 0) return first
  const others = ROTATION.filter(n => n !== first)
  const step = [7, 5, 3, 11, 13].find(k => others.length % k !== 0) ?? 1
  return others[(seed + act * step) % others.length]
}
