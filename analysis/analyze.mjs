// Reads analysis/data/puzzles.json and computes:
//  1. board-dimension distribution (orientation-normalized: 5x7 and 7x5 merge)
//  2. piece-size distribution, overall and broken down per dimension
//  3. a tiling-similarity metric to find exact/near-duplicate puzzles
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const puzzles = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'puzzles.json'), 'utf8'))

function normalizedDimKey(width, height) {
  const [a, b] = [width, height].sort((x, y) => x - y)
  return `${a}x${b}`
}

// --- 1. Dimension distribution ---
const dimensionCounts = new Map()
for (const p of puzzles) {
  const key = normalizedDimKey(p.board.width, p.board.height)
  dimensionCounts.set(key, (dimensionCounts.get(key) || 0) + 1)
}

// --- 2. Piece-size distribution (overall + per dimension) ---
const pieceSizeCountsOverall = new Map()
const pieceSizeCountsByDim = new Map() // dimKey -> Map(size -> count)
const pieceCountPerPuzzle = new Map() // number of pieces -> number of puzzles

for (const p of puzzles) {
  const dimKey = normalizedDimKey(p.board.width, p.board.height)
  if (!pieceSizeCountsByDim.has(dimKey)) pieceSizeCountsByDim.set(dimKey, new Map())
  const byDim = pieceSizeCountsByDim.get(dimKey)

  pieceCountPerPuzzle.set(p.pieces.length, (pieceCountPerPuzzle.get(p.pieces.length) || 0) + 1)

  for (const piece of p.pieces) {
    const size = piece.cells.length
    pieceSizeCountsOverall.set(size, (pieceSizeCountsOverall.get(size) || 0) + 1)
    byDim.set(size, (byDim.get(size) || 0) + 1)
  }
}

// --- 3. Similarity metric ---
// Fingerprint a tiling by which internal cell-adjacency edges are a piece
// boundary (a "cut"). This is invariant to piece id/color and uniquely
// determines the partition of the board - two puzzles with identical cut-sets
// have the exact same tiling. Comparisons only happen within puzzles sharing
// the same EXACT (width, height) - edge positions aren't meaningfully
// comparable across different orientations without transposing, which is
// intentionally out of scope here.
function edgeBitmask(board, pieces) {
  const { width, height } = board
  const grid = Array.from({ length: height }, () => new Array(width).fill(-1))
  for (const piece of pieces) for (const [r, c] of piece.cells) grid[r][c] = piece.id

  let mask = 0n
  let bit = 0n
  // horizontal edges: (r,c)-(r,c+1)
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width - 1; c++) {
      if (grid[r][c] !== grid[r][c + 1]) mask |= 1n << bit
      bit += 1n
    }
  }
  // vertical edges: (r,c)-(r+1,c)
  for (let r = 0; r < height - 1; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r][c] !== grid[r + 1][c]) mask |= 1n << bit
      bit += 1n
    }
  }
  return { mask, totalEdges: bit }
}

function popcount(x) {
  let count = 0
  while (x > 0n) {
    count += Number(x & 1n)
    x >>= 1n
  }
  return count
}

const byExactDim = new Map() // "WxH" (exact, not normalized) -> [{date, mask, totalEdges}]
for (const p of puzzles) {
  const key = `${p.board.width}x${p.board.height}`
  const { mask, totalEdges } = edgeBitmask(p.board, p.pieces)
  if (!byExactDim.has(key)) byExactDim.set(key, [])
  byExactDim.get(key).push({ date: p.date, mask, totalEdges })
}

const similarityHistogramBins = [
  { label: '<0.80', min: 0, max: 0.8 },
  { label: '0.80-0.90', min: 0.8, max: 0.9 },
  { label: '0.90-0.95', min: 0.9, max: 0.95 },
  { label: '0.95-0.99', min: 0.95, max: 0.99 },
  { label: '0.99-1.00 (near-dup)', min: 0.99, max: 1 },
  { label: '1.00 (exact dup)', min: 1, max: Infinity },
]
const similarityHistogram = Object.fromEntries(similarityHistogramBins.map((b) => [b.label, 0]))

let totalPairsCompared = 0
let maxSimilarityFound = 0
let maxSimilarityPair = null
const exactDuplicatePairs = []
const nearDuplicatePairs = [] // similarity >= 0.99, < 1.0

for (const [dimKey, entries] of byExactDim) {
  const n = entries.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = entries[i]
      const b = entries[j]
      const totalEdges = Number(a.totalEdges)
      const matching = totalEdges - popcount(a.mask ^ b.mask)
      const similarity = matching / totalEdges
      totalPairsCompared++

      if (similarity > maxSimilarityFound) {
        maxSimilarityFound = similarity
        maxSimilarityPair = { dimKey, dateA: a.date, dateB: b.date, similarity }
      }
      if (similarity >= 1) exactDuplicatePairs.push({ dimKey, dateA: a.date, dateB: b.date })
      else if (similarity >= 0.99) nearDuplicatePairs.push({ dimKey, dateA: a.date, dateB: b.date, similarity })

      for (const binDef of similarityHistogramBins) {
        if (similarity >= binDef.min && similarity < binDef.max) {
          similarityHistogram[binDef.label]++
          break
        }
        if (binDef.max === Infinity && similarity >= binDef.min) {
          similarityHistogram[binDef.label]++
          break
        }
      }
    }
  }
}

const results = {
  puzzleCount: puzzles.length,
  dimensionCounts: Object.fromEntries([...dimensionCounts.entries()].sort()),
  pieceSizeCountsOverall: Object.fromEntries([...pieceSizeCountsOverall.entries()].sort((a, b) => a[0] - b[0])),
  pieceSizeCountsByDim: Object.fromEntries(
    [...pieceSizeCountsByDim.entries()]
      .sort()
      .map(([dim, m]) => [dim, Object.fromEntries([...m.entries()].sort((a, b) => a[0] - b[0]))]),
  ),
  pieceCountPerPuzzle: Object.fromEntries([...pieceCountPerPuzzle.entries()].sort((a, b) => a[0] - b[0])),
  similarity: {
    totalPairsCompared,
    maxSimilarityFound,
    maxSimilarityPair,
    exactDuplicateCount: exactDuplicatePairs.length,
    nearDuplicateCount: nearDuplicatePairs.length,
    exactDuplicatePairs: exactDuplicatePairs.slice(0, 20),
    nearDuplicatePairs: nearDuplicatePairs.slice(0, 20),
    histogram: similarityHistogram,
  },
}

const outPath = path.join(__dirname, 'data', 'results.json')
fs.writeFileSync(outPath, JSON.stringify(results, null, 2))
console.log(`Wrote analysis results to ${outPath}`)
console.log(`\nTotal pairs compared (within same exact dimensions): ${totalPairsCompared.toLocaleString()}`)
console.log(`Exact duplicates: ${exactDuplicatePairs.length}`)
console.log(`Near-duplicates (>=0.99, <1.0): ${nearDuplicatePairs.length}`)
console.log(`Max similarity found: ${(maxSimilarityFound * 100).toFixed(2)}%`, maxSimilarityPair)
console.log('Similarity histogram:', similarityHistogram)
