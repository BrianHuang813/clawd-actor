// /clawd book: today's page of the notebook in a pane, ruled paper drawn as a terminal Raster.
// Pure functions only, like scenes.ts; register.tsx draws the words over the paper and wires the presses.

import { items, noteLines, openTodos, INBOX, REMINDERS, TODO, type Candidate } from './notes.ts'

export const PAPER = 0xf6f1e1 // cream
const RULE = 0xb7cbe3 // faint blue
const MARGIN = 0xe39a9a // red
const HOLE = 0x8c8577
const DEFAULT = 0x01000000 // the terminal's own foreground
export const MARGIN_COL = 4 // words start two columns after it

/**
 * The paper as Raster cells, packed `[codePoint, foreground, background]` per cell: words sit on
 * the even rows, the odd ones are ruled, with a red margin and a binder hole every fourth row.
 */
export const paper = (columns: number, rows: number): Uint32Array => {
  const cells = new Uint32Array(columns * rows * 3)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const [ch, fg] =
        c === 1 && r % 4 === 0 ? [0x25cf, HOLE] // ●
        : c === MARGIN_COL ? [0x2502, MARGIN] // │
        : r % 2 === 1 && c > 1 ? [0x2500, RULE] // ─
        : [0x20, DEFAULT]
      cells.set([ch, fg, PAPER], (r * columns + c) * 3)
    }
  }
  return cells
}

/** The page's foldable parts: today's todos and reminders, today's notes, and the todos waiting for a day. */
export const SECTIONS = ['todo', 'note', 'plan'] as const
export type Section = (typeof SECTIONS)[number]
const TITLE: Record<Section, string> = { todo: 'Todo', note: 'Notes', plan: 'Plan' }

/** One line of the page: the date, a part's heading, or a line under it with what a press on it needs. */
export type Line =
  | { kind: 'date'; text: string }
  | { kind: 'head'; section: Section; text: string; isOpen: boolean }
  | { kind: 'item'; section: typeof TODO | typeof REMINDERS; n: number; isDone: boolean; text: string }
  | { kind: 'note'; text: string }
  | { kind: 'plan'; cand: Candidate; text: string }

/**
 * `day`'s page: Todo (its todos, then its reminders), Notes, and Plan (the inbox and open todos left
 * from days before), each heading counting what is under it; a part in `folded` shows its heading only.
 */
export const pageOf = (todoMd: string, notesMd: string, day: string, folded: readonly Section[] = []): Line[] => {
  const list = (section: typeof TODO | typeof REMINDERS) =>
    items(todoMd, day, section).map((it, n): Line => ({ kind: 'item', section, n, isDone: it.isDone, text: it.text }))
  const todo = [...list(TODO), ...list(REMINDERS)]
  const done = todo.filter(l => l.kind === 'item' && l.isDone).length
  const parts: Record<Section, { count: string; lines: Line[] }> = {
    todo: { count: todo.length ? `${done}/${todo.length}` : '', lines: todo },
    note: { count: '', lines: noteLines(notesMd, day).map((text): Line => ({ kind: 'note', text })) },
    plan: {
      count: '',
      lines: openTodos(todoMd, day).map((cand): Line => ({ kind: 'plan', cand, text: cand.from === INBOX ? cand.text : `${cand.from.slice(5)} ${cand.text}` })),
    },
  }
  return [
    { kind: 'date', text: day },
    ...SECTIONS.flatMap((section): Line[] => {
      const { count, lines } = parts[section]
      const isOpen = !folded.includes(section)
      const text = `${TITLE[section]} ${count || (section === 'todo' ? '' : lines.length || '')}`.trim()
      return [{ kind: 'head', section, text, isOpen }, ...(isOpen ? lines : [])]
    }),
  ]
}

/** The cells as a Raster takes them: their bytes in base64 (the engine's Uint8Array has toBase64). */
export const toBase64 = (cells: Uint32Array): string =>
  (new Uint8Array(cells.buffer) as Uint8Array & { toBase64(): string }).toBase64()
