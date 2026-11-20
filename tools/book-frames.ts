import { pageOf, paper, MARGIN_COL, PAPER, type Line, type Section } from '../hooks/book.ts'
import { addLines, takeOn, tick, INBOX, NOTES, REMINDERS, TODO } from '../hooks/notes.ts'
import { say } from '../hooks/say.ts'
// /clawd book, for assets/book.gif: today's page on ruled paper, a todo ticked, a waiting one taken on,
// a note typed into the field, and Plan folded away. The paper and the page are hooks/book.ts's own;
// the colours and the hint are register.tsx's and say.ts's. The notebook's lines are an example.
const WIDTH = 56
const ROWS = 25 // the paper: one page of words, every other row ruled
const DAY = '2026-11-20'
const PENCIL = '#5a5752'
const RED_PENCIL = '#b0413e'
const FADED = '#9a968e'
const DIM = '#787878'
const BG = `#${PAPER.toString(16)}`
const s = say('en')
const hex = (n: number) => (n & 0x01000000 ? undefined : `#${n.toString(16).padStart(6, '0')}`)

type Cell = { ch: string; color?: string; bg?: string; strike?: boolean; bold?: boolean }
type Run = { text: string; color?: string; bg?: string; strike?: boolean; bold?: boolean }

let todoMd = addLines('', INBOX, TODO, ['- [ ] update the README'])
todoMd = addLines(todoMd, '2026-11-19', TODO, ['- [ ] review the pull request'])
todoMd = addLines(todoMd, DAY, TODO, ['- [ ] write the weekly report', '- [ ] fix the flaky test'])
todoMd = addLines(todoMd, DAY, REMINDERS, ['- [ ] 15:00 standup'])
let notesMd = addLines('', DAY, NOTES, ['- 09:40 the API returns 204 when empty'])
let folded: Section[] = []
let typed = ''

const words = (line: Line): Cell[] & { text?: string } => {
  const ink = (text: string, color = PENCIL, more: Partial<Cell> = {}) => [...text].map(ch => ({ ch, color, bg: BG, ...more }))
  if (line.kind === 'date') return ink(`# ${line.text}`, RED_PENCIL, { bold: true })
  if (line.kind === 'note') return ink(line.text)
  if (line.kind === 'head') return ink(`${line.isOpen ? '▾' : '▸'} ${line.text}`, PENCIL, { bold: true })
  if (line.kind === 'plan') return ink(`→ ${line.text}`)
  return line.isDone ? ink(`☑ ${line.text}`, FADED, { strike: true }) : ink(`☐ ${line.text}`)
}

const wrap = (text: string, width: number) =>
  text.split(' ').reduce<string[]>((out, w) => {
    const last = out[out.length - 1]
    if (last !== undefined && last.length + 1 + w.length <= width) out[out.length - 1] = `${last} ${w}`
    else out.push(w)
    return out
  }, [])

const runs = (cells: Cell[]): Run[] =>
  cells.reduce<Run[]>((out, c) => {
    const last = out[out.length - 1]
    if (last && last.color === c.color && last.bg === c.bg && last.strike === c.strike && last.bold === c.bold) last.text += c.ch
    else out.push({ text: c.ch, color: c.color, bg: c.bg, strike: c.strike, bold: c.bold })
    return out
  }, [])

/** One frame of the pane: its title, the paper with the page over it, the hint and the field. `pressed` lights a line up. */
const pane = (pressed = -1) => {
  const page = pageOf(todoMd, notesMd, DAY, folded)
  const raw = paper(WIDTH, ROWS)
  const grid: Cell[][] = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: WIDTH }, (_, c) => {
      const at = (r * WIDTH + c) * 3
      return { ch: String.fromCodePoint(raw[at]), color: hex(raw[at + 1]), bg: hex(raw[at + 2]) }
    }),
  )
  page.forEach((line, i) => {
    const left = MARGIN_COL + 2
    words(line).slice(0, WIDTH - left - 1).forEach((cell, k) => {
      grid[i * 2][left + k] = i === pressed ? { ...cell, color: BG, bg: PENCIL } : cell
    })
  })
  const title = [...` Clawd's notebook`.padEnd(WIDTH)].map(ch => ({ ch, color: '#e8e8e8', bold: true }))
  const hint = wrap(s.bookHint, WIDTH).map(l => [...l].map(ch => ({ ch, color: DIM })))
  const field = [
    { ch: '+', color: '#D77757' },
    { ch: ' ' },
    ...(typed ? [...typed].map(ch => ({ ch, color: '#e8e8e8' })) : [...s.bookPlaceholder].map(ch => ({ ch, color: DIM }))),
    { ch: '▌', color: DIM },
  ]
  return { rows: [title, ...grid, [], ...hint, field].map(runs) }
}

const out: { rows: Run[][] }[] = []
const hold = (n: number, pressed = -1) => {
  for (let i = 0; i < n; i++) out.push(pane(pressed))
}
const lineOf = (match: (l: Line) => boolean) => pageOf(todoMd, notesMd, DAY, folded).findIndex(match)
const press = (match: (l: Line) => boolean, then: () => void) => {
  hold(3, lineOf(match))
  then()
  hold(14)
}

hold(16)
press(l => l.kind === 'item' && l.text === 'write the weekly report', () => (todoMd = tick(todoMd, DAY, TODO, 0)!))
press(l => l.kind === 'plan' && l.cand.text === 'review the pull request', () => (todoMd = takeOn(todoMd, DAY, [{ from: '2026-11-19', text: 'review the pull request' }]).md))
const note = 'note ask PM about the empty state'
for (let k = 1; k <= note.length; k += 2) {
  typed = note.slice(0, k) // two keys a frame
  hold(1)
}
typed = note
hold(4)
typed = ''
notesMd = addLines(notesMd, DAY, NOTES, ['- 10:15 ask PM about the empty state'])
hold(14)
press(l => l.kind === 'head' && l.section === 'plan', () => (folded = ['plan']))
hold(10)
console.log(JSON.stringify({ width: WIDTH, pane: true, frames: out }))
