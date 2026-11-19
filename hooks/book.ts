// /clawd book: today's page of the notebook in a pane, ruled paper drawn as a terminal Raster.
// Pure functions only, like scenes.ts; register.tsx draws the words over the paper and wires the presses.

import { items, noteLines, NOTES, REMINDERS, TODO } from './notes.ts'

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

/** One line of the page: a heading, a note, or a checklist item with its 0-based place in its section. */
export type Line =
  | { kind: 'date' | 'head' | 'note'; text: string }
  | { kind: 'item'; section: typeof TODO | typeof REMINDERS; n: number; isDone: boolean; text: string }

/** `day`'s page: its todos, its reminders and its notes, each under a heading when it has any (Todo always). */
export const pageOf = (todoMd: string, notesMd: string, day: string): Line[] => {
  const list = (section: typeof TODO | typeof REMINDERS): Line[] =>
    items(todoMd, day, section).map((it, n) => ({ kind: 'item', section, n, isDone: it.isDone, text: it.text }))
  const todos = list(TODO)
  const reminders = list(REMINDERS)
  const notes = noteLines(notesMd, day).map((text): Line => ({ kind: 'note', text }))
  return [
    { kind: 'date', text: day },
    { kind: 'head', text: TODO },
    ...todos,
    ...(reminders.length ? [{ kind: 'head', text: REMINDERS } as const, ...reminders] : []),
    ...(notes.length ? [{ kind: 'head', text: NOTES } as const, ...notes] : []),
  ]
}

/** The cells as a Raster takes them: their bytes in base64 (the engine's Uint8Array has toBase64). */
export const toBase64 = (cells: Uint32Array): string =>
  (new Uint8Array(cells.buffer) as Uint8Array & { toBase64(): string }).toBase64()
