import { frameRows } from '../hooks/scenes.ts'
// One long turn: each act is [spinner word, scene, frames, note shown beside the spinner]
const ACTS: [string, string, number, string][] = [
  ['Pondering', 'think', 44, ''], // the detective
  ['Beaming', 'shift', 44, ''], // starts on t = 44, the top of its cycle
  ['Sautéing', 'cook', 28, ''], // the homemaker
]
const WIDTH = 48
const out: any[] = []
let t = 0
for (const [word, scene, n, note] of ACTS)
  for (let i = 0; i < n; i++, t++)
    out.push({ word, note, rows: frameRows(word, 'thinking', t, WIDTH, scene) })
console.log(JSON.stringify({ width: WIDTH, frames: out }))
