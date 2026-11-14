import { frameRows } from '../hooks/scenes.ts'
import { bubble } from '../hooks/chat.ts'
import { say } from '../hooks/say.ts'
import { cheer, BADGES } from '../hooks/badges.ts'
// The notebook and badges, for assets/notebook.gif: a todo saved, a plan Clawd suggests and you
// take, a reminder, a todo ticked off, the day's list, and the Marathon badge with its costume.
// Every line is the mod's own (hooks/say.ts, hooks/badges.ts); Haiku's pick is an example.
const WIDTH = 48
const WORD = 'Sautéing'
const s = say('en')
const out: any[] = []
let t = 0
const show = (n: number, scene: string, extra: { say?: string; prompt?: string; perks?: Set<string> } = {}) => {
  const from = scene === 'cook' ? 0 : t // a /clawd reaction plays from its own first frame, as in hooks/register.tsx
  for (let i = 0; i < n; i++, t++)
    out.push({ word: WORD, note: '', prompt: extra.prompt ?? '', bubble: extra.say ? bubble(extra.say, WIDTH) : [], rows: frameRows(WORD, 'thinking', t - from, WIDTH, scene, true, extra.perks) })
}
const type = (text: string) => {
  for (let k = 1; k <= text.length; k += 2) show(1, 'cook', { prompt: text.slice(0, k) }) // two keys a frame
  show(3, 'cook', { prompt: text })
}
show(8, 'cook')
type('/clawd todo write the weekly report')
show(22, 'sketch', { say: s.savedLater })
type('/clawd plan')
show(8, 'ponder', { say: '· · ·' })
show(30, 'chalk', { say: s.offer('1. write the weekly report 2. fix the flaky test', 'both were left from yesterday') })
type('/clawd plan ok')
show(20, 'chalk', { say: s.taken(2) })
type('/clawd remind 30m standup')
show(22, 'type', { say: s.remindSet('10:30', 'standup') })
type('/clawd done')
show(22, 'dance', { say: s.doneLeft('write the weekly report', 1) })
type('/clawd list')
show(30, 'think', { say: `${s.today('1.✓ write the weekly report, 2. fix the flaky test')} · ${s.later('10:30 standup')}` })
const marathon = BADGES.filter(b => b.id === 'marathon')
show(36, 'run', { say: cheer(marathon, 'en'), perks: new Set(['marathon']) })
show(6, 'cook')
console.log(JSON.stringify({ width: WIDTH, frames: out }))
