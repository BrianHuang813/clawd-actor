export type Frame = number
/** The turn's show, which a hot reload keeps: whether a turn runs, the frame it started on, the rotation's seed and acts played. */
export type Show = { isTurnRunning: boolean; turnBase: number; seed: number; played: number }

/** Bumped on every write to a notebook file, so the /clawd book pane redraws. */
export type Book = number

/** The parts of the /clawd book page folded shut. */
export type BookFold = ('todo' | 'note' | 'plan')[]

declare module 'claude-code' {
  interface PluginState {
    'clawd-actor': { frame: Frame; show: Show; book: Book; bookFold: BookFold }
  }
}
