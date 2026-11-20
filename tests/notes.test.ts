import { test, expect } from 'claude-code/testing'
import { langOf } from '../hooks/say'
import { addLines, candidates, listAll, markNotes, readConfig, splitNotebook, sweep, dueReminders, items, noteLines, parseNotes, readPicks, resolveAt, summary, takeOn, tick, untick, INBOX, NOTES, REMINDERS, TODO } from '../hooks/notes'

const DAY = '2026-11-14'
const at = (h: number, m: number) => new Date(2026, 10, 14, h, m)

test('note commands parse; anything else is left to chat', () => {
  expect(parseNotes('note ask PM about the field')).toEqual({ kind: 'note', text: 'ask PM about the field' })
  expect(parseNotes('NOTE 等下要問 PM')).toEqual({ kind: 'note', text: '等下要問 PM' })
  expect(parseNotes('plan a; b；c;;')).toEqual({ kind: 'plan', items: ['a', 'b', 'c'] })
  expect(parseNotes('todo look into restack')).toEqual({ kind: 'todo', text: 'look into restack' })
  expect(parseNotes('plan')).toEqual({ kind: 'suggest' })
  expect(parseNotes('plan ok')).toEqual({ kind: 'accept' })
  expect(parseNotes('plan OK 1, 3')).toEqual({ kind: 'accept', picks: [1, 3] })
  expect(parseNotes('plan okay then')).toEqual({ kind: 'plan', items: ['okay then'] })
  expect(parseNotes('done')).toEqual({ kind: 'done' })
  expect(parseNotes('done 2')).toEqual({ kind: 'done', n: 2 })
  expect(parseNotes('list')).toEqual({ kind: 'list' })
  expect(parseNotes('list note')).toEqual({ kind: 'list', of: 'note' })
  expect(parseNotes('clean')).toEqual({ kind: 'clean' })
  expect(parseNotes('clean up this function')).toBeUndefined()
  expect(parseNotes('LIST todos')).toEqual({ kind: 'list', of: 'todo' })
  expect(parseNotes('remind 14:00 standup')).toEqual({ kind: 'remind', when: '14:00', text: 'standup' })
  expect(parseNotes('remind 1h30m call back')).toEqual({ kind: 'remind', when: '1h30m', text: 'call back' })
  // full-width colons, Chinese units, English words for units, no space before the text
  expect(parseNotes('remind 14：00 站會')).toEqual({ kind: 'remind', when: '14:00', text: '站會' })
  expect(parseNotes('remind 14:00站會')).toEqual({ kind: 'remind', when: '14:00', text: '站會' })
  expect(parseNotes('remind 30分 回電')).toEqual({ kind: 'remind', when: '30m', text: '回電' })
  expect(parseNotes('remind 1小時30分鐘 開會')).toEqual({ kind: 'remind', when: '1h30m', text: '開會' })
  expect(parseNotes('remind 2小时 交报告')).toEqual({ kind: 'remind', when: '2h', text: '交报告' })
  expect(parseNotes('remind 45min tea')).toEqual({ kind: 'remind', when: '45m', text: 'tea' })
  expect(parseNotes('remind 1 hour tea')?.kind).toBe('usage') // a number with no unit next to it
  expect(parseNotes('remind 30 meeting')?.kind).toBe('usage')
  for (const bad of ['note', 'todo', 'plan ;', 'done 0', 'remind standup', 'remind 14:00'])
    expect(parseNotes(bad)?.kind).toBe('usage')
  for (const chat of ['notebook is cool', 'what did I note?', 'hello', 'planning ahead', 'list the files I changed', 'done with this?', 'notes are handy', 'notes'])
    expect(parseNotes(chat)).toBeUndefined()
})

test('a reminder time resolves to a minute later today, or says why not', () => {
  expect(resolveAt('14:00', at(10, 0))).toBe(14 * 60)
  expect(resolveAt('30m', at(10, 0))).toBe(10 * 60 + 30)
  expect(resolveAt('1h30m', at(10, 0))).toBe(11 * 60 + 30)
  expect(typeof resolveAt('09:00', at(10, 0))).toBe('string') // passed
  expect(typeof resolveAt('25:00', at(10, 0))).toBe('string')
  expect(typeof resolveAt('3h', at(22, 0))).toBe('string') // tomorrow
})

test('lines go into the right day and section, made when missing, leaving the rest alone', () => {
  let md = addLines('', DAY, NOTES, ['- 10:00 first'])
  expect(md).toBe(`# ${DAY}\n\n## ${NOTES}\n- 10:00 first\n`)
  md = addLines(md, DAY, TODO, ['- [ ] a', '- [ ] b'])
  md = addLines(md, DAY, NOTES, ['- 10:05 second'])
  expect(md).toBe(`# ${DAY}\n\n## ${NOTES}\n- 10:00 first\n- 10:05 second\n\n## ${TODO}\n- [ ] a\n- [ ] b\n`)

  // an earlier day, and the person's own words, stay as they were
  const old = `# 2026-11-13\n\nmy own line\n\n## ${TODO}\n- [ ] old\n`
  const next = addLines(old, DAY, TODO, ['- [ ] new'])
  expect(next.startsWith(old)).toBe(true)
  expect(items(next, DAY, TODO)).toEqual([{ isDone: false, text: 'new' }])
  expect(items(next, '2026-11-13', TODO)).toEqual([{ isDone: false, text: 'old' }])

  // a section added to a day that is not the last one lands inside that day
  const mid = addLines(`# ${DAY}\n\n## ${NOTES}\n- x\n\n# 2026-11-15\n`, DAY, TODO, ['- [ ] a'])
  expect(mid).toBe(`# ${DAY}\n\n## ${NOTES}\n- x\n\n## ${TODO}\n- [ ] a\n\n# 2026-11-15\n`)
})

test('a file saved with CRLF reads the same', () => {
  const md = `# ${DAY}\r\n\r\n## ${REMINDERS}\r\n- [ ] 9:05 standup\r\n`
  expect(items(md, DAY, REMINDERS)).toEqual([{ isDone: false, text: '9:05 standup' }])
  expect(dueReminders(md, DAY, 9 * 60 + 5)).toEqual([{ n: 0, at: 9 * 60 + 5, text: 'standup', isNow: true }])
})

test('tick checks off the n-th item of the section only', () => {
  const md = addLines(addLines('', DAY, TODO, ['- [ ] a', 'a note in between', '- [ ] b']), DAY, REMINDERS, ['- [ ] 14:00 x'])
  const done = tick(md, DAY, TODO, 1)!
  expect(items(done, DAY, TODO)).toEqual([{ isDone: false, text: 'a' }, { isDone: true, text: 'b' }])
  expect(items(done, DAY, REMINDERS)[0].isDone).toBe(false)
  expect(tick(md, DAY, TODO, 5)).toBeUndefined()
  expect(tick(md, '2026-01-01', TODO, 0)).toBeUndefined()
  expect(untick(done, DAY, TODO, 1)).toBe(md) // a slip of the finger, taken back
  expect(untick(md, DAY, TODO, 5)).toBeUndefined()
})

test('reminders are called out 5 minutes ahead, then when due, until ticked', () => {
  const md = addLines('', DAY, REMINDERS, ['- [ ] 14:00 standup', '- [x] 13:00 lunch', '- [ ] 16:00 review'])
  expect(dueReminders(md, DAY, 13 * 60 + 50)).toEqual([])
  expect(dueReminders(md, DAY, 13 * 60 + 55)).toEqual([{ n: 0, at: 14 * 60, text: 'standup', isNow: false }])
  expect(dueReminders(md, DAY, 14 * 60)).toEqual([{ n: 0, at: 14 * 60, text: 'standup', isNow: true }])
  expect(dueReminders(tick(md, DAY, REMINDERS, 0)!, DAY, 14 * 60 + 1)).toEqual([])
})

test('notes read back the day\'s note lines, in order', () => {
  const md = addLines(addLines('', DAY, NOTES, ['- 09:10 ask PM', '- 14:05 等下要問']), DAY, TODO, ['- [ ] a'])
  expect(noteLines(md, DAY)).toEqual(['09:10 ask PM', '14:05 等下要問'])
  expect(noteLines(md, '2026-11-13')).toEqual([])
})

test('the summary numbers todos and lists what is still to come', () => {
  const md = addLines(addLines('', DAY, TODO, ['- [x] a', '- [ ] b']), DAY, REMINDERS, ['- [ ] 14:00 standup'])
  expect(summary(md, DAY, 'en')).toBe('Today: 1.✓ a, 2. b · Later: 14:00 standup')
  expect(summary('', DAY, 'en')).toBe('No todos today.')
})

test('the inbox sits at the top; candidates are days past, oldest first, then the inbox', () => {
  let md = addLines('', '2026-11-13', TODO, ['- [ ] left over', '- [x] finished'])
  md = addLines(md, INBOX, TODO, ['- [ ] someday'])
  md = addLines(md, DAY, TODO, ['- [ ] today'])
  expect(md.startsWith(`# ${INBOX}\n\n## ${TODO}\n- [ ] someday\n\n# 2026-11-13`)).toBe(true)
  expect(candidates(md, '', DAY)).toEqual([{ from: '2026-11-13', text: 'left over' }, { from: INBOX, text: 'someday' }])
  expect(summary(md, DAY, 'en')).toBe('Today: 1. today · Todo: someday (/clawd plan to pick) · 1 left from earlier days (/clawd list todo)')
})

test("Haiku's picks are read safely, and the oldest stand in when they do not hold", () => {
  expect(readPicks('Sure! {"picks":[3,1,3,9],"why":"due soon"}', 4)).toEqual({ picks: [2, 0], why: 'due soon' })
  expect(readPicks('{"picks":[1,2,3,4]}', 5).picks).toEqual([0, 1, 2])
  expect(readPicks('no idea', 5)).toEqual({ picks: [0, 1, 2], why: '' })
  expect(readPicks('{"picks":["1"]}', 2)).toEqual({ picks: [0, 1], why: '' })
})

test('taking todos on moves them to today and ticks where they came from, once', () => {
  let md = addLines('', '2026-11-13', TODO, ['- [ ] left over'])
  md = addLines(md, INBOX, TODO, ['- [ ] someday'])
  const taken = candidates(md, '', DAY)
  const r = takeOn(md, DAY, taken)
  expect(r.count).toBe(2)
  expect(items(r.md, INBOX, TODO)).toEqual([{ isDone: true, text: 'someday → 11-14' }])
  expect(items(r.md, '2026-11-13', TODO)).toEqual([{ isDone: true, text: 'left over → 11-14' }])
  expect(items(r.md, DAY, TODO)).toEqual([{ isDone: false, text: 'left over' }, { isDone: false, text: 'someday' }])
  expect(takeOn(r.md, DAY, taken).count).toBe(0) // taken already
})

test('Clawd answers in Chinese when what it is about is Chinese', () => {
  expect(langOf('等下要問 PM')).toBe('zh')
  expect(langOf('交报告')).toBe('zh')
  expect(langOf('ask PM')).toBe('en')
  const md = addLines('', DAY, TODO, ['- [ ] 寫測試'])
  expect(summary(md, DAY, 'zh')).toBe('今天：1. 寫測試')
})

test('notes taken on a plan are marked once and left out after', () => {
  const notes = addLines('', '2026-11-13', NOTES, ['- 09:00 ask PM', '- 09:05 a thought'])
  const cands = candidates('', notes, DAY)
  expect(cands).toEqual([{ from: '2026-11-13', text: 'ask PM', isNote: true }, { from: '2026-11-13', text: 'a thought', isNote: true }])
  const r = markNotes(notes, DAY, [cands[0]!])
  expect(r.marked.length).toBe(1)
  expect(r.md).toContain('- 09:00 ask PM → 11-14')
  expect(candidates('', r.md, DAY).map(c => c.text)).toEqual(['a thought'])
  expect(markNotes(r.md, DAY, [cands[0]!]).marked).toEqual([]) // marked already
  expect(takeOn('', DAY, r.marked).md).toBe(`# ${DAY}\n\n## ${TODO}\n- [ ] ask PM\n`)
  expect(listAll('note', '', '', DAY, 'en')).toContain('No notes waiting')
})

test('splitting a notebook with nothing but notes leaves no todo file', () => {
  const md = addLines('', DAY, NOTES, ['- 10:00 hi'])
  expect(splitNotebook(md)).toEqual({ notes: md, todo: '' })
  expect(splitNotebook('')).toEqual({ notes: '', todo: '' })
})

test('the summary counts the todos left from earlier days', () => {
  const md = addLines(addLines('', '2026-11-12', TODO, ['- [ ] a', '- [x] b']), '2026-11-13', TODO, ['- [ ] c'])
  expect(summary(md, DAY, 'en')).toBe('No todos today. · 2 left from earlier days (/clawd list todo)')
})

test('sweep drops only what is finished, in the inbox and before the cutoff, and the days left empty', () => {
  const todo = [
    '# Inbox', '', '## Todo', '- [ ] someday', '- [x] moved → 11-01', '',
    '# 2026-10-01', '', '## Todo', '- [x] done', '', '## Reminders', '- [x] 14:00 standup', '',
    '# 2026-10-02', '', 'my own line', '', '## Todo', '- [x] done', '- [ ] still open', '',
    `# ${DAY}`, '', '## Todo', '- [x] recent', '',
  ].join('\n')
  const r = sweep(todo, '2026-10-15')
  expect(r.count).toBe(4)
  expect(r.md).toBe(`# Inbox\n\n## Todo\n- [ ] someday\n\n# 2026-10-02\n\nmy own line\n\n## Todo\n- [ ] still open\n\n# ${DAY}\n\n## Todo\n- [x] recent\n`)
  expect(sweep(r.md, '2026-10-15').count).toBe(0)

  const notes = '# 2026-10-01\n\n## Notes\n- 09:00 taken → 10-01\n\n# 2026-10-02\n\n## Notes\n- 09:00 open idea\n- 10:00 taken → 10-03\n'
  expect(sweep(notes, '2026-10-15')).toEqual({ md: '# 2026-10-02\n\n## Notes\n- 09:00 open idea\n', count: 2 })
})

test('settings take whole numbers in range, else their defaults', () => {
  expect(readConfig()).toEqual({ keepDays: 30, cleanHint: 20, remindAhead: 5, nudgeMinutes: 30, bookLanguage: 'en', animate: true })
  expect(readConfig({ keepDays: 7, cleanHint: 0, remindAhead: 10, nudgeMinutes: 0 })).toEqual({ keepDays: 7, cleanHint: 0, remindAhead: 10, nudgeMinutes: 0, bookLanguage: 'en', animate: true })
  expect(readConfig({ keepDays: 0, remindAhead: -1, nudgeMinutes: 2.5, cleanHint: 'x', bookLanguage: 'fr' })).toEqual(readConfig())
  expect(readConfig({ bookLanguage: 'zh' }).bookLanguage).toBe('zh')
  expect(readConfig({ animate: false }).animate).toBe(false)
  expect(readConfig({ animate: 'false' }).animate).toBe(false)
  expect(dueReminders(addLines('', DAY, REMINDERS, ['- [ ] 14:00 standup']), DAY, 13 * 60 + 50, 10)[0]?.isNow).toBe(false)
})
