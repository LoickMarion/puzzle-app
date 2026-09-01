// Generates N daily puzzles across consecutive real dates (matching how they're
// actually seeded in production) and dumps the raw data for offline analysis.
// Not part of the deployed app - this folder is dev-only tooling.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateDailyPuzzle } from '../server/generator.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COUNT = 10_000
const START_DATE = '2026-01-01'

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const start = Date.now()
const puzzles = []
for (let i = 0; i < COUNT; i++) {
  const date = addDays(START_DATE, i)
  const puzzle = generateDailyPuzzle(date)
  puzzles.push({
    date,
    board: puzzle.board,
    pieces: puzzle.pieces.map((p) => ({ id: p.id, cells: p.cells })),
  })
  if ((i + 1) % 1000 === 0) console.log(`generated ${i + 1}/${COUNT}`)
}
const elapsed = Date.now() - start

const outPath = path.join(__dirname, 'data', 'puzzles.json')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(puzzles))

console.log(`\nWrote ${puzzles.length} puzzles to ${outPath}`)
console.log(`Generation took ${elapsed}ms (${(elapsed / COUNT).toFixed(2)}ms/puzzle)`)
console.log(`File size: ${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB`)
