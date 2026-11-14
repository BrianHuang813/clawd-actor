// Prints a scene's frames side by side, as drawn and with badges' costumes on, to check a costume
// without starting Claude Code (colours left out):
//   node tools/peek.ts run marathon        # scene, then the badges earned
//   node tools/peek.ts walk marathon 8     # how many frames (default 4)
import { frameRows } from '../hooks/scenes.ts'

const [scene = 'run', perk = '', count = '4'] = process.argv.slice(2)
const perks = new Set(perk ? perk.split(',') : [])
const rows = (t: number, on: Set<string>) => frameRows('', 'requesting', t, 40, scene, true, on).map(r => r.map(x => x.text).join(''))
for (let t = 0; t < Number(count); t++) {
  console.log(`--- ${scene}, frame ${t}: as drawn │ with ${perk || 'no badges'}`)
  const [plain, dressed] = [rows(t, new Set()), rows(t, perks)]
  plain.forEach((r, i) => console.log(`${r} │ ${dressed[i]}`))
}
