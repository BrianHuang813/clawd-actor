import { frameRows } from '../hooks/scenes.ts'
import { bubble } from '../hooks/chat.ts'
// A mid-turn chat with Clawd, for assets/chat.gif: Claude cooks along while you type /clawd at the prompt.
// The answer is an example of what Haiku says; in a session it comes from the model.
const WIDTH = 48
const WORD = 'Sautéing'
const REPLY = "Great! Claude's sautéing your code and I'm on stirring duty. Smells like a clean build!"
const out: any[] = []
let t = 0
const show = (n: number, scene: string, extra: { say?: string; prompt?: string } = {}) => {
  const from = scene === 'cook' ? 0 : t // a /clawd reaction plays from its own first frame, as in hooks/register.tsx
  for (let i = 0; i < n; i++, t++)
    out.push({ word: WORD, note: '', prompt: extra.prompt ?? '', bubble: extra.say ? bubble(extra.say, WIDTH) : [], rows: frameRows(WORD, 'thinking', t - from, WIDTH, scene) })
}
const type = (text: string) => {
  for (let k = 1; k <= text.length; k++) show(1, 'cook', { prompt: text.slice(0, k) })
  show(3, 'cook', { prompt: text }) // a beat before Enter
}
show(10, 'cook')
type("/clawd how's it going?")
show(10, 'ponder', { say: '· · ·' })
show(32, 'say', { say: REPLY })
type('/clawd pet')
show(20, 'pet')
type('/clawd shift')
show(43, 'shift') // a /clawd action's 6 s: there and back
show(6, 'cook')
console.log(JSON.stringify({ width: WIDTH, frames: out }))
