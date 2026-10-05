import { frameRows } from '../hooks/scenes.ts'
// One long turn: each act is [spinner word, scene, frames, note shown beside the spinner]
const ACTS: [string, string, number, string][] = [
  ['Pondering', 'think', 36, ''],
  ['Sautéing', 'cook', 34, ''],
  ['Juggling', 'juggle', 30, ''],
  ['Conjuring', 'magic', 30, ''],
  ['Hatching', 'hatch', 30, ''],
  ['Vibing', 'dance', 28, ''],
  ['Herding', 'herd', 36, ''],
  ['Pondering', 'type', 30, 'Bash(git status)'],
]
const WIDTH = 48
const out: any[] = []
let t = 0
for (const [word, scene, n, note] of ACTS)
  for (let i = 0; i < n; i++, t++)
    out.push({ word, note, rows: frameRows(word, 'thinking', t, WIDTH, scene) })
console.log(JSON.stringify({ width: WIDTH, frames: out }))
