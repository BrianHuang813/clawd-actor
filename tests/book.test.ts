import { test, expect } from 'claude-code/testing'
import { pageOf, paper, PAPER, MARGIN_COL } from '../hooks/book.ts'

const TODO_MD = '# 2026-11-14\n\n## Todo\n- [x] write tests\n- [ ] ship it\n\n## Reminders\n- [ ] 15:00 standup\n'
const NOTES_MD = '# 2026-11-14\n\n## Notes\n- 10:00 ask PM\n'

test('a page has Todo (todos, then reminders), Notes and Plan, each heading counting its lines', () => {
  const todoMd = '# Inbox\n\n## Todo\n- [ ] read the RFC\n\n# 2026-11-13\n\n## Todo\n- [ ] fix the build\n\n' + TODO_MD
  expect(pageOf(todoMd, NOTES_MD, '2026-11-14')).toEqual([
    { kind: 'date', text: '2026-11-14' },
    { kind: 'head', section: 'todo', text: 'Todo 1/3', isOpen: true },
    { kind: 'item', section: 'Todo', n: 0, isDone: true, text: 'write tests' },
    { kind: 'item', section: 'Todo', n: 1, isDone: false, text: 'ship it' },
    { kind: 'item', section: 'Reminders', n: 0, isDone: false, text: '15:00 standup' },
    { kind: 'head', section: 'note', text: 'Notes 1', isOpen: true },
    { kind: 'note', text: '10:00 ask PM' },
    { kind: 'head', section: 'plan', text: 'Plan 2', isOpen: true },
    { kind: 'plan', cand: { from: '2026-11-13', text: 'fix the build' }, text: '11-13 fix the build' },
    { kind: 'plan', cand: { from: 'Inbox', text: 'read the RFC' }, text: 'read the RFC' },
  ])
})

test('a folded part shows its heading only; an empty day has its three headings', () => {
  const page = pageOf(TODO_MD, NOTES_MD, '2026-11-14', ['todo', 'plan'])
  expect(page.map(l => l.text)).toEqual(['2026-11-14', 'Todo 1/3', 'Notes 1', '10:00 ask PM', 'Plan'])
  expect(page[1]).toMatchObject({ kind: 'head', isOpen: false })
  expect(pageOf('', '', '2026-11-15').map(l => l.text)).toEqual(['2026-11-15', 'Todo', 'Notes', 'Plan'])
})

test('the paper rules the odd rows and draws the margin, all on cream', () => {
  const cells = paper(10, 3)
  const at = (r: number, c: number) => Array.from(cells.slice((r * 10 + c) * 3, (r * 10 + c) * 3 + 3))
  expect(cells.length).toBe(10 * 3 * 3)
  expect(at(1, 6)[0]).toBe(0x2500) // a rule between the lines of words
  expect(at(0, 6)[0]).toBe(0x20) // a line for words
  expect(at(2, MARGIN_COL)[0]).toBe(0x2502)
  expect(at(0, 1)[0]).toBe(0x25cf)
  expect([...Array(30).keys()].every(i => cells[i * 3 + 2] === PAPER)).toBe(true)
})
