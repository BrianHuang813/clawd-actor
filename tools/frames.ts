import { frameRows } from '../hooks/scenes.ts'
// One long turn: each act is [spinner word, scene, frames, note shown beside the spinner]
const ACTS: [string, string, number, string][] = [
  ['Hatching', 'hatch', 44, ''],
  ['Vibing', 'dance', 20, ''],
  ['Moseying', 'walk', 24, ''],
  ['Sautéing', 'cook', 20, ''],
]
const WIDTH = 48
const out: any[] = []
let t = 0
for (const [word, scene, n, note] of ACTS)
  for (let i = 0; i < n; i++, t++)
    out.push({ word, note, rows: frameRows(word, 'thinking', t, WIDTH, scene) })
console.log(JSON.stringify({ width: WIDTH, frames: out }))
