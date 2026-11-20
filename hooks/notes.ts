// /clawd note, todo, plan, done, list, remind and clean: what they ask, and the markdown file they keep.
// Pure functions only, like scenes.ts; what Clawd says about it is in say.ts. Two files, each one `# YYYY-MM-DD` heading a day:
// the notes file has a `## Notes` list under it, the todo file `## Todo` and `## Reminders`, so a person (or Claude) can read them.
// A `# Inbox` heading at the top of the todo file holds the todos for some day, not yet picked for one.

import { say, type Lang } from './say.ts'

export const NOTES = 'Notes'
export const TODO = 'Todo'
export const REMINDERS = 'Reminders'
export const INBOX = 'Inbox' // kept like a day of its own, at the top of the file
export const NOTES_FILE = 'clawd-notes.md'
export const TODO_FILE = 'clawd-todo.md'
// the defaults of the settings plugin.json's userConfig declares
export const KEEP_DAYS = 30 // /clawd clean leaves the days this recent alone
export const CLEAN_HINT = 20 // finished lines to clean before /clawd list mentions it
export const MAX_PICKS = 3 // suggestions a plan offers: as many as the bubble shows
export const WARN_MIN = 5 // minutes before a reminder that Clawd first calls it out
const DAY_MIN = 24 * 60
// ponytail: only the newest open notes go to Haiku, so the prompt stays small; older ones still show in /clawd list note
const MAX_NOTE_CANDS = 20

export type NoteAsk =
  | { kind: 'note'; text: string }
  | { kind: 'plan'; items: string[] }
  | { kind: 'todo'; text: string } // into the inbox, for some day
  | { kind: 'suggest' } // a lone plan: Clawd picks from the inbox and days past
  | { kind: 'accept'; picks?: number[] } // plan ok [1 3]: the suggestions taken, 1-based; absent, all
  | { kind: 'done'; n?: number } // the n-th of today's todos, 1-based; absent, the first open one
  | { kind: 'list'; of?: 'note' | 'todo' } // absent: today's list; note or todo: every open one, all days
  | { kind: 'remind'; when: string; text: string }
  | { kind: 'clean' } // drops what is finished from days before KEEP_DAYS ago
  | { kind: 'usage'; of: 'note' | 'todo' | 'plan' | 'done' | 'remind' } // the command, missing what it needs

export type Item = { isDone: boolean; text: string }

/**
 * A reminder's time and text: 14:00 or 14：00, or a wait of 1h30m, 30m, 30min, 1小時30分 or
 * 30分鐘, the text after it with or without a space. The time comes back as 14:00, 1h30m or 30m.
 */
const parseWhen = (rest: string): { when: string; text: string } | undefined => {
  const clock = /^(\d{1,2})[:：](\d{2})(?!\d)\s*(.*)$/s.exec(rest)
  if (clock) return { when: `${clock[1]}:${clock[2]}`, text: clock[3]!.trim() }
  // an English unit must end the word: "30 meeting" is no wait
  const wait = /^(?:(\d+)(?:h(?:ours?|rs?)?(?![a-z])|小時|小时))?\s*(?:(\d+)(?:m(?:in(?:ute)?s?)?(?![a-z])|分鐘|分钟|分))?\s*(.*)$/is.exec(rest)
  if (!wait || (!wait[1] && !wait[2])) return undefined
  return { when: `${wait[1] ? `${wait[1]}h` : ''}${wait[2] ? `${wait[2]}m` : ''}`, text: wait[3]!.trim() }
}

/** The note command `text` asks for, or undefined when it is not one. */
export const parseNotes = (text: string): NoteAsk | undefined => {
  const m = /^(note|todo|plan|done|list|remind|clean)(?![\p{L}\p{N}_])\s*(.*)$/isu.exec(text.trim())
  if (!m) return undefined
  const cmd = m[1]!.toLowerCase() as 'note' | 'todo' | 'plan' | 'done' | 'list' | 'remind' | 'clean'
  const rest = m[2]!.trim()
  if (cmd === 'clean') return rest ? undefined : { kind: 'clean' } // "clean up this function" is a chat
  if (cmd === 'list') {
    if (!rest) return { kind: 'list' }
    if (/^notes?$/i.test(rest)) return { kind: 'list', of: 'note' }
    if (/^todos?$/i.test(rest)) return { kind: 'list', of: 'todo' }
    return undefined // "list the files" is a chat
  }
  if (cmd === 'note') return rest ? { kind: 'note', text: rest } : { kind: 'usage', of: 'note' }
  if (cmd === 'todo') return rest ? { kind: 'todo', text: rest } : { kind: 'usage', of: 'todo' }
  if (cmd === 'plan') {
    if (!rest) return { kind: 'suggest' }
    const ok = /^ok((?:[\s,]+\d+)*)$/i.exec(rest)
    if (ok) {
      const picks = ok[1]!.split(/[\s,]+/).filter(Boolean).map(Number)
      return picks.length ? { kind: 'accept', picks } : { kind: 'accept' }
    }
    const items = rest.split(/[;；\n]/).map(s => s.trim()).filter(Boolean)
    return items.length ? { kind: 'plan', items } : { kind: 'usage', of: 'plan' }
  }
  if (cmd === 'done') {
    if (!rest) return { kind: 'done' }
    if (!/^\d+$/.test(rest)) return undefined // "done with this?" is a chat
    return Number(rest) > 0 ? { kind: 'done', n: Number(rest) } : { kind: 'usage', of: 'done' }
  }
  const r = parseWhen(rest)
  return r?.text ? { kind: 'remind', ...r } : { kind: 'usage', of: 'remind' }
}

const two = (n: number) => String(n).padStart(2, '0')
/** The day's heading key, in local time: 2026-11-14. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
/** Minutes since local midnight. */
export const minuteOf = (d: Date) => d.getHours() * 60 + d.getMinutes()
export const hhmm = (min: number) => `${two(Math.floor(min / 60))}:${two(min % 60)}`
const toMin = (t: string) => {
  const [h = 0, m = 0] = t.split(':').map(Number)
  return h * 60 + m
}

/** Why a reminder's time will not do, as say.ts words it. */
export type NoTime = 'notTime' | 'passed' | 'rightNow' | 'todayOnly'

/** The minute of today `when` (14:00, 30m, 1h30m) names, or why not when it is no time later today. */
export const resolveAt = (when: string, now: Date): number | NoTime => {
  const nowMin = minuteOf(now)
  let at: number
  if (when.includes(':')) {
    const [h = 0, m = 0] = when.split(':').map(Number)
    if (h > 23 || m > 59) return 'notTime'
    at = h * 60 + m
    if (at <= nowMin) return 'passed'
  } else {
    const h = Number(/(\d+)h/.exec(when)?.[1] ?? 0)
    const m = Number(/(\d+)m/.exec(when)?.[1] ?? 0)
    at = nowMin + h * 60 + m
    if (at === nowMin) return 'rightNow'
  }
  return at < DAY_MIN ? at : 'todayOnly'
}

/** Index of the first line in [from, to) that `isIt`, or `to`. */
const scan = (lines: string[], from: number, to: number, isIt: (l: string) => boolean) => {
  for (let i = from; i < to; i++) if (isIt(lines[i]!)) return i
  return to
}

/** Where `section` of `day` sits in `lines`: its heading's index and the end of its body; heading -1 when absent. */
const locate = (lines: string[], day: string, section: string) => {
  const d = lines.findIndex(l => l.trim() === `# ${day}`)
  if (d < 0) return { day: -1, dayEnd: lines.length, head: -1, end: -1 }
  const dayEnd = scan(lines, d + 1, lines.length, l => /^# /.test(l))
  const head = scan(lines, d + 1, dayEnd, l => l.trim() === `## ${section}`)
  if (head === dayEnd) return { day: d, dayEnd, head: -1, end: -1 }
  return { day: d, dayEnd, head, end: scan(lines, head + 1, dayEnd, l => /^#{1,2} /.test(l)) }
}

const split = (md: string) => (md.trim() ? md.replace(/\s+$/, '').split(/\r?\n/) : []) // written back with \n
const join = (lines: string[]) => lines.join('\n') + '\n'

/** The file with `add` appended to `section` of `day`, the day and section made when missing. */
export const addLines = (md: string, day: string, section: string, add: string[]): string => {
  const lines = split(md)
  const at = locate(lines, day, section)
  if (at.day < 0) {
    const made = [`# ${day}`, '', `## ${section}`, ...add]
    // the inbox goes first, a day last
    if (day === INBOX) return join([...made, ...(lines.length ? ['', ...lines] : [])])
    return join([...lines, ...(lines.length ? [''] : []), ...made])
  }
  // after the last non-blank line of the section, or of the day for a new section
  const [from, to] = at.head < 0 ? [at.day, at.dayEnd] : [at.head, at.end]
  let end = to
  while (end > from + 1 && !lines[end - 1]!.trim()) end--
  const head = at.head < 0 ? ['', `## ${section}`] : []
  return join([...lines.slice(0, end), ...head, ...add, ...lines.slice(end)])
}

const ITEM = /^\s*- \[( |x|X)\] (.*)$/

/** The checklist items of `section` of `day`, in order. */
export const items = (md: string, day: string, section: string): Item[] => {
  const lines = split(md)
  const at = locate(lines, day, section)
  if (at.head < 0) return []
  return lines.slice(at.head + 1, at.end).flatMap(l => {
    const m = ITEM.exec(l)
    return m ? [{ isDone: m[1] !== ' ', text: m[2]!.trim() }] : []
  })
}

/** The `- ` lines of `day`'s notes, as written: `14:05 ask PM`. */
export const noteLines = (md: string, day: string): string[] => {
  const lines = split(md)
  const at = locate(lines, day, NOTES)
  if (at.head < 0) return []
  return lines.slice(at.head + 1, at.end).flatMap(l => {
    const m = /^\s*- (.*)$/.exec(l)
    return m?.[1]?.trim() ? [m[1].trim()] : []
  })
}

/** The file with the `n`-th (0-based) checklist item of `section` of `day` ticked, `note` after it; undefined when there is none. */
export const tick = (md: string, day: string, section: string, n: number, note = ''): string | undefined =>
  setItem(md, day, section, n, l => l.replace(/- \[ \]/, '- [x]') + note)

/** The file with the `n`-th (0-based) checklist item of `section` of `day` open again; undefined when there is none. */
export const untick = (md: string, day: string, section: string, n: number): string | undefined =>
  setItem(md, day, section, n, l => l.replace(/- \[[xX]\]/, '- [ ]'))

const setItem = (md: string, day: string, section: string, n: number, change: (line: string) => string) => {
  const lines = split(md)
  const at = locate(lines, day, section)
  if (at.head < 0) return undefined
  let seen = -1
  const i = scan(lines, at.head + 1, at.end, l => ITEM.test(l) && ++seen === n)
  if (i === at.end) return undefined
  return join(lines.map((l, k) => (k === i ? change(l) : l)))
}

export type Due = { n: number; at: number; text: string; isNow: boolean }

/** Today's open reminders to call out at minute `nowMin`: due ones (isNow), and ones within `warnMin` minutes. */
export const dueReminders = (md: string, day: string, nowMin: number, warnMin = WARN_MIN): Due[] =>
  items(md, day, REMINDERS).flatMap((it, n): Due[] => {
    const m = /^(\d{1,2}:\d{2}) (.*)$/.exec(it.text)
    if (it.isDone || !m) return []
    const at = toMin(m[1]!)
    const text = m[2]!
    if (at <= nowMin) return [{ n, at, text, isNow: true }]
    return at - nowMin <= warnMin ? [{ n, at, text, isNow: false }] : []
  })

/** What /clawd list says: today's todos, numbered and ticked, the reminders still to come, and the todos waiting in the inbox. */
export const summary = (md: string, day: string, lang: Lang): string => {
  const s = say(lang)
  const todo = items(md, day, TODO).map((it, i) => `${i + 1}.${it.isDone ? '✓' : ''} ${it.text}`)
  const later = items(md, day, REMINDERS).filter(it => !it.isDone).map(it => it.text)
  const inbox = items(md, INBOX, TODO).filter(it => !it.isDone).map(it => it.text)
  const earlier = openTodos(md, day).filter(c => c.from !== INBOX).length
  const parts = [
    todo.length ? s.today(todo.join(', ')) : s.noTodos,
    later.length ? s.later(later.join(', ')) : '',
    inbox.length ? s.todos(inbox.join(', ')) : '',
    earlier ? s.earlier(earlier) : '',
  ]
  return parts.filter(Boolean).join(' · ')
}

/** An open todo, or a note not yet planned, that could go on today's list. */
export type Candidate = { from: string; text: string; isNote?: boolean }

const TAKEN = / → \d{2}-\d{2}$/ // after a note planned for a day
const TIME = /^\d{1,2}:\d{2}\s+/

const dayHeads = (md: string) => split(md).flatMap(l => /^# (\d{4}-\d{2}-\d{2})\s*$/.exec(l)?.[1] ?? []).sort()

/** The notes of every day up to `today` not yet planned, oldest first, their time left off. */
export const openNotes = (notesMd: string, today: string): Candidate[] =>
  dayHeads(notesMd)
    .filter(d => d <= today)
    .flatMap(from => noteLines(notesMd, from).filter(l => !TAKEN.test(l)).map(l => ({ from, text: l.replace(TIME, ''), isNote: true })))
    .filter(c => c.text)

/** Open todos left from days before `today`, oldest first, then the inbox's, in its order. */
export const openTodos = (md: string, today: string): Candidate[] =>
  [...dayHeads(md).filter(d => d < today), INBOX].flatMap(from => items(md, from, TODO).filter(it => !it.isDone).map(it => ({ from, text: it.text })))

/** What /clawd plan picks from: the waiting todos, then the newest open notes. */
export const candidates = (todoMd: string, notesMd: string, today: string): Candidate[] => [
  ...openTodos(todoMd, today),
  ...openNotes(notesMd, today).slice(-MAX_NOTE_CANDS),
]

/** What /clawd list note or list todo says: every open one, the newest first. */
export const listAll = (of: 'note' | 'todo', todoMd: string, notesMd: string, today: string, lang: Lang): string => {
  const s = say(lang)
  const mmdd = (c: Candidate) => (c.from === today || c.from === INBOX ? c.text : `${c.from.slice(5)} ${c.text}`)
  const all =
    of === 'note'
      ? openNotes(notesMd, today)
      : [...openTodos(todoMd, today), ...items(todoMd, today, TODO).filter(it => !it.isDone).map(it => ({ from: today, text: it.text }))]
  if (!all.length) return of === 'note' ? s.noOpenNotes : s.noOpenTodos
  const list = [...all].reverse().map(mmdd).join(' · ')
  return of === 'note' ? s.allNotes(all.length, list) : s.allTodos(all.length, list)
}

/** Every note line of `day`, as written. */
const noteAt = (lines: string[], day: string) => {
  const at = locate(lines, day, NOTES)
  return at.head < 0 ? [] : Array.from({ length: at.end - at.head - 1 }, (_, k) => at.head + 1 + k)
}

/** The notes file with each of `taken`'s notes marked "→ MM-DD", and the notes it found to mark. */
export const markNotes = (notesMd: string, today: string, taken: Candidate[]): { md: string; marked: Candidate[] } => {
  const lines = split(notesMd)
  const marked: Candidate[] = []
  for (const c of taken) {
    // found again by its text: the file may have changed since the suggestion
    const i = noteAt(lines, c.from).find(k => {
      const m = /^\s*- (.*)$/.exec(lines[k]!)
      return m && !TAKEN.test(m[1]!.trim()) && m[1]!.trim().replace(TIME, '') === c.text
    })
    if (i === undefined) continue
    lines[i] = `${lines[i]!.trimEnd()} → ${today.slice(5)}`
    marked.push(c)
  }
  return { md: marked.length ? join(lines) : notesMd, marked }
}

/** Haiku's prompt for picking today's work out of `cands`, numbered from 1. */
export const pickPrompt = (cands: Candidate[], today: string, time: string, reminders: string[]) =>
  [
    `It is ${today}, ${time}. ${reminders.length ? `Today's reminders: ${reminders.join('; ')}.` : 'No meetings today.'}`,
    'Open todos (where each came from in brackets):',
    ...cands.map((c, i) => `${i + 1}. [${c.isNote ? `note from ${c.from}` : c.from === INBOX ? 'inbox' : `left from ${c.from}`}] ${c.text}`),
  ].join('\n')

export const PICK_SYSTEM = [
  `You help a programmer choose what to work on today. Choose at most ${MAX_PICKS} of the numbered todos:`,
  'favour ones left over from earlier days, anything urgent, and what fits around the reminders.',
  'Notes are passing thoughts: pick one only when it is a job to do.',
  'Reply with JSON only: {"picks":[numbers],"why":"one short reason, 12 words at most, in the language of the todos"}',
].join(' ')

/** The 0-based candidates Haiku picked in `reply`, or the oldest ones when it gave none that hold. */
export const readPicks = (reply: string, count: number): { picks: number[]; why: string } => {
  try {
    const json = JSON.parse(/\{[\s\S]*\}/.exec(reply)?.[0] ?? '')
    const picks = [...new Set<number>((json.picks ?? []).filter((n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= count))]
    if (picks.length) return { picks: picks.slice(0, MAX_PICKS).map(n => n - 1), why: typeof json.why === 'string' ? json.why : '' }
  } catch {
    // not JSON: the oldest ones, below
  }
  return { picks: Array.from({ length: Math.min(MAX_PICKS, count) }, (_, i) => i), why: '' }
}

/** The todo file with `taken` added to today's todos, each todo ticked where it came from, "→ MM-DD" after it; notes are marked by markNotes. */
export const takeOn = (md: string, today: string, taken: Candidate[]): { md: string; count: number } => {
  let out = md
  let count = 0
  for (const c of taken) {
    if (c.isNote) {
      out = addLines(out, today, TODO, [`- [ ] ${c.text}`])
      count++
      continue
    }
    // found again by its text: the file may have changed since the suggestion
    const n = items(out, c.from, TODO).findIndex(it => !it.isDone && it.text === c.text)
    const ticked = n < 0 ? undefined : tick(out, c.from, TODO, n, ` → ${today.slice(5)}`)
    if (!ticked) continue
    out = addLines(ticked, today, TODO, [`- [ ] ${c.text}`])
    count++
  }
  return { md: out, count }
}

/**
 * The one-file notebook of 0.8 split in two: the `## Notes` sections, and anything else of a day
 * that is not under a section, stay in the notes file; Todo, Reminders and the inbox go to the todo file.
 */
export const splitNotebook = (md: string): { notes: string; todo: string } => {
  const out = { notes: [] as string[], todo: [] as string[] }
  const headed = { notes: '', todo: '' } // the day heading each was last given
  let [head, sect] = ['', '']
  for (const l of split(md)) {
    if (/^# /.test(l)) [head, sect] = [l.trim(), '']
    else if (/^## /.test(l)) sect = l.slice(3).trim()
    if (/^# /.test(l)) continue // given lazily, so a day with no notes has no heading there
    const to = sect && sect !== NOTES ? 'todo' : 'notes'
    if (!l.trim()) {
      if (headed[to] === head) out[to].push(l) // a blank line never makes a heading of its own
      continue
    }
    if (head && headed[to] !== head) {
      out[to].push('', head, '')
      headed[to] = head
    }
    out[to].push(l)
  }
  const tidy = (ls: string[]) => {
    const text = ls.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    return text ? text + '\n' : ''
  }
  return { notes: tidy(out.notes), todo: tidy(out.todo) }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
/** A finished line: a ticked item, or a note taken on ("→ MM-DD"). */
const isFinished = (l: string) => /^\s*- \[[xX]\] /.test(l) || (/^\s*- (?!\[)/.test(l) && TAKEN.test(l.trimEnd()))

/**
 * The file without what is finished in the inbox and in days before `cutoff`, and without the sections and
 * days that leaves empty; open items and the person's own lines stay. `count` is the lines it dropped.
 */
export const sweep = (md: string, cutoff: string): { md: string; count: number } => {
  const lines = split(md)
  const isOld = (head: string) => head === INBOX || (DATE.test(head) && head < cutoff)
  let head = ''
  let count = 0
  const kept = lines.filter(l => {
    if (/^# /.test(l)) head = l.slice(2).trim()
    const isGone = isOld(head) && isFinished(l)
    if (isGone) count++
    return !isGone
  })
  if (!count) return { md, count }
  // drop the old headings with nothing under them but blank lines and empty headings
  const out: string[] = []
  head = ''
  for (let i = 0; i < kept.length; i++) {
    const l = kept[i]!
    if (/^# /.test(l)) head = l.slice(2).trim()
    if (/^#{1,2} /.test(l) && isOld(head)) {
      const isDay = /^# /.test(l)
      const end = scan(kept, i + 1, kept.length, x => (isDay ? /^# / : /^#{1,2} /).test(x))
      if (kept.slice(i + 1, end).every(x => !x.trim() || /^## /.test(x))) {
        i = end - 1
        continue
      }
    }
    out.push(l)
  }
  const text = out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return { md: text ? text + '\n' : '', count }
}

/** The settings: the person's own from plugin.json's userConfig, each a whole number of at least `min`, else its default. */
export type Config = { keepDays: number; cleanHint: number; remindAhead: number; nudgeMinutes: number; bookLanguage: Lang; animate: boolean }
const LIMITS: Record<Exclude<keyof Config, 'bookLanguage' | 'animate'>, [fallback: number, min: number]> = {
  keepDays: [KEEP_DAYS, 1],
  cleanHint: [CLEAN_HINT, 0], // 0: never mentioned
  remindAhead: [WARN_MIN, 0], // 0: called only when due
  nudgeMinutes: [30, 0], // 0: no "next up" bubbles
}
export const readConfig = (options: Readonly<Record<string, unknown>> = {}): Config => {
  const pick = (k: keyof typeof LIMITS) => {
    const [fallback, min] = LIMITS[k]
    const n = Number(options[k])
    return Number.isInteger(n) && n >= min ? n : fallback
  }
  const bookLanguage: Lang = options.bookLanguage === 'zh' ? 'zh' : 'en' // English unless zh is chosen
  const animate = options.animate !== false && options.animate !== 'false' // on unless turned off
  return { keepDays: pick('keepDays'), cleanHint: pick('cleanHint'), remindAhead: pick('remindAhead'), nudgeMinutes: pick('nudgeMinutes'), bookLanguage, animate }
}
