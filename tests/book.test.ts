import { test, expect } from 'claude-code/testing'
import { pageOf, paper, PAPER, MARGIN_COL } from '../hooks/book.ts'

const TODO_MD = '# 2026-11-14\n\n## Todo\n- [x] write tests\n- [ ] ship it\n\n## Reminders\n- [ ] 15:00 standup\n'
const NOTES_MD = '# 2026-11-14\n\n## Notes\n- 10:00 ask PM\n'

test('a page lists the day: todos, reminders, then notes, each under its heading', () => {
  expect(pageOf(TODO_MD, NOTES_MD, '2026-11-14')).toEqual([
    { kind: 'date', text: '2026-11-14' },
    { kind: 'head', text: 'Todo' },
    { kind: 'item', section: 'Todo', n: 0, isDone: true, text: 'write tests' },
    { kind: 'item', section: 'Todo', n: 1, isDone: false, text: 'ship it' },
    { kind: 'head', text: 'Reminders' },
    { kind: 'item', section: 'Reminders', n: 0, isDone: false, text: '15:00 standup' },
    { kind: 'head', text: 'Notes' },
    { kind: 'note', text: '10:00 ask PM' },
  ])
})

test('an empty day still has its date and an empty Todo heading', () => {
  expect(pageOf('', '', '2026-11-15')).toEqual([
    { kind: 'date', text: '2026-11-15' },
    { kind: 'head', text: 'Todo' },
  ])
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
