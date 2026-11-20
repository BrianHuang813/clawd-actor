import { pageOf, paper, MARGIN_COL, PAPER, type Line, type Section } from '../hooks/book.ts'
import { addLines, takeOn, tick, INBOX, NOTES, REMINDERS, TODO } from '../hooks/notes.ts'
import { frameRows, H } from '../hooks/scenes.ts'
import { say } from '../hooks/say.ts'
// /clawd book, for assets/book.gif: the whole terminal. Claude works on a fix while Clawd cooks above
// the prompt; `/clawd book` docks today's page on the right, and there a todo is ticked, a waiting one
// taken on, a note typed in and Plan folded away. The paper, the page, the stage and the hint are the
// mod's own (hooks/book.ts, scenes.ts, say.ts); the chat and the notebook's lines are an example.
const COLS = 112
const ROWS = 34
const PANE = 50 // the dock: at most 45% of the width, and a column for its border
const LEFT = COLS - PANE - 1
const DAY = '2026-11-20'
const WORD = 'Sautéing'
const WHITE = '#e8e8e8'
const DIM = '#787878'
const ORANGE = '#D77757'
const BORDER = '#5a5a60'
const PENCIL = '#5a5752'
const RED_PENCIL = '#b0413e'
const FADED = '#9a968e'
const BG = `#${PAPER.toString(16)}`
const s = say('en')
const hex = (n: number) => (n & 0x01000000 ? undefined : `#${n.toString(16).padStart(6, '0')}`)

type Cell = { ch: string; color?: string; bg?: string; strike?: boolean; bold?: boolean }
type Run = { text: string; color?: string; bg?: string; strike?: boolean; bold?: boolean }

const ink = (text: string, color?: string, more: Partial<Cell> = {}): Cell[] => [...text].map(ch => ({ ch, color, ...more }))
const put = (grid: Cell[][], r: number, c: number, cells: Cell[], width = Infinity) =>
  cells.slice(0, width).forEach((cell, k) => (grid[r][c + k] = cell))
const runs = (cells: Cell[]): Run[] =>
  cells.reduce<Run[]>((out, c) => {
    const last = out[out.length - 1]
    if (last && last.color === c.color && last.bg === c.bg && last.strike === c.strike && last.bold === c.bold) last.text += c.ch
    else out.push({ text: c.ch, color: c.color, bg: c.bg, strike: c.strike, bold: c.bold })
    return out
  }, [])
const wrap = (text: string, width: number) =>
  text.split(' ').reduce<string[]>((out, w) => {
    const last = out[out.length - 1]
    if (last !== undefined && last.length + 1 + w.length <= width) out[out.length - 1] = `${last} ${w}`
    else out.push(w)
    return out
  }, [])

// the notebook
let todoMd = addLines('', INBOX, TODO, ['- [ ] update the README'])
todoMd = addLines(todoMd, '2026-11-19', TODO, ['- [ ] review the pull request'])
todoMd = addLines(todoMd, DAY, TODO, ['- [ ] write the weekly report', '- [ ] fix the flaky test'])
todoMd = addLines(todoMd, DAY, REMINDERS, ['- [ ] 15:00 standup'])
let notesMd = addLines('', DAY, NOTES, ['- 09:40 the API returns 204 when empty'])
let folded: Section[] = []
let typed = '' // the pane's field
let prompt = '' // the prompt box
let isOpen = false
let t = 0

const CHAT: Cell[][] = [
  ink('> fix the flaky test in tests/api.test.ts', WHITE),
  [],
  [...ink('● ', WHITE), ...ink('Read', WHITE, { bold: true }), ...ink('(tests/api.test.ts)', DIM)],
  ink('  ⎿  Read 84 lines', DIM),
  [],
  ink('● The test waits on a real timer, so it fails when the', WHITE),
  ink('  machine is slow. I will give it a mock clock.', WHITE),
  [],
  [...ink('● ', '#98c379'), ...ink('Update', WHITE, { bold: true }), ...ink('(tests/api.test.ts)', DIM)],
  ink('  ⎿  Updated with 3 additions and 2 removals', DIM),
  [],
  [...ink('● ', WHITE), ...ink('Bash', WHITE, { bold: true }), ...ink('(npm test -- api)', DIM)],
]

const words = (line: Line): Cell[] => {
  const paperInk = (text: string, color = PENCIL, more: Partial<Cell> = {}) => ink(text, color, { bg: BG, ...more })
  if (line.kind === 'date') return paperInk(`# ${line.text}`, RED_PENCIL, { bold: true })
  if (line.kind === 'note') return paperInk(line.text)
  if (line.kind === 'head') return paperInk(`${line.isOpen ? '▾' : '▸'} ${line.text}`, PENCIL, { bold: true })
  if (line.kind === 'plan') return paperInk(`→ ${line.text}`)
  return line.isDone ? paperInk(`☑ ${line.text}`, FADED, { strike: true }) : paperInk(`☐ ${line.text}`)
}

/** The chat, Clawd on the stage, the spinner and the prompt box, in the left `width` columns. */
const left = (grid: Cell[][], width: number) => {
  CHAT.forEach((line, r) => put(grid, r + 1, 0, line, width))
  const top = ROWS - H - 6
  frameRows(WORD, 'thinking', t, Math.min(width, 60), 'cook').forEach((row, r) =>
    put(grid, top + r, 0, row.flatMap(run => ink(run.text, run.color, { bg: run.bg }))),
  )
  put(grid, top + H + 1, 0, [...ink('✻✶'[Math.floor(t / 3) % 2], ORANGE), ...ink(` ${WORD}…`, ORANGE), ...ink(' (esc to interrupt)', DIM)])
  put(grid, ROWS - 3, 0, ink(`╭${'─'.repeat(width - 2)}╮`, BORDER))
  put(grid, ROWS - 2, 0, [...ink('│ ', BORDER), ...ink('> ', DIM), ...ink(prompt, WHITE), ...(isOpen ? [] : ink('▌', DIM))])
  put(grid, ROWS - 2, width - 1, ink('│', BORDER))
  put(grid, ROWS - 1, 0, ink(`╰${'─'.repeat(width - 2)}╯`, BORDER))
}

/** The pane docked on the right: its title, the paper with the page over it, the hint and the field. */
const pane = (grid: Cell[][], pressed: number) => {
  const at = LEFT + 1
  for (let r = 0; r < ROWS; r++) grid[r][LEFT] = { ch: '│', color: BORDER }
  put(grid, 0, at + 1, ink("Clawd's notebook", WHITE, { bold: true }))
  const hint = wrap(s.bookHint, PANE)
  const height = ROWS - 1 - hint.length - 1 // the paper fills the pane, the hint and the field below it
  const raw = paper(PANE, height)
  for (let r = 0; r < height; r++)
    for (let c = 0; c < PANE; c++) {
      const i = (r * PANE + c) * 3
      grid[1 + r][at + c] = { ch: String.fromCodePoint(raw[i]), color: hex(raw[i + 1]), bg: hex(raw[i + 2]) }
    }
  pageOf(todoMd, notesMd, DAY, folded).forEach((line, i) => {
    const cells = words(line).map(c => (i === pressed ? { ...c, color: BG, bg: PENCIL } : c))
    put(grid, 1 + i * 2, at + MARGIN_COL + 2, cells, PANE - MARGIN_COL - 3)
  })
  hint.forEach((l, k) => put(grid, 1 + height + k, at, ink(l, DIM)))
  const field = typed ? ink(typed, WHITE) : ink(s.bookPlaceholder, DIM)
  put(grid, ROWS - 1, at, [...ink('+ ', ORANGE), ...field, ...ink('▌', DIM)])
}

const out: { rows: Run[][] }[] = []
const frame = (pressed = -1) => {
  const grid: Cell[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ({ ch: ' ' })))
  left(grid, isOpen ? LEFT - 1 : COLS)
  if (isOpen) pane(grid, pressed)
  out.push({ rows: grid.map(runs) })
  t++
}
const hold = (n: number, pressed = -1) => {
  for (let i = 0; i < n; i++) frame(pressed)
}
const press = (match: (l: Line) => boolean, then: () => void) => {
  hold(3, pageOf(todoMd, notesMd, DAY, folded).findIndex(match))
  then()
  hold(14)
}
const type = (text: string, into: (s: string) => void) => {
  for (let k = 1; k <= text.length; k += 2) {
    into(text.slice(0, k)) // two keys a frame
    hold(1)
  }
  into(text)
  hold(4)
}

hold(10)
type('/clawd book', v => (prompt = v))
prompt = ''
isOpen = true
hold(16)
press(l => l.kind === 'item' && l.text === 'write the weekly report', () => (todoMd = tick(todoMd, DAY, TODO, 0)!))
press(l => l.kind === 'plan' && l.cand.text === 'review the pull request', () => (todoMd = takeOn(todoMd, DAY, [{ from: '2026-11-19', text: 'review the pull request' }]).md))
type('note ask PM about the empty state', v => (typed = v))
typed = ''
notesMd = addLines(notesMd, DAY, NOTES, ['- 10:15 ask PM about the empty state'])
hold(14)
press(l => l.kind === 'head' && l.section === 'plan', () => (folded = ['plan']))
hold(10)
console.log(JSON.stringify({ width: COLS, screen: true, frames: out }))
