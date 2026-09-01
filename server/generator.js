import { mulberry32, seedFromString } from './rng.js'

const MIN_SIDE = 5
const MAX_SIDE = 10
const MIN_AREA = 35
const MAX_AREA = 50

const POISSON_LAMBDA = 1.25
const MIN_PIECE_SIZE = 4

const MAX_BOX = 5
const EXPAND_BIAS_THRESHOLD = 3
const EXPAND_WEIGHT = 1
const SAME_WEIGHT = 6

const SHAPE_ATTEMPTS_PER_SIZE = 6
const BACKTRACK_CALL_BUDGET = 50_000
const MAX_WHOLE_BOARD_RETRIES = 20

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1))
}

function weightedPick(rng, items, weightOf) {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0)
  let r = rng() * total
  for (const item of items) {
    r -= weightOf(item)
    if (r <= 0) return item
  }
  return items[items.length - 1]
}

function pickBoardSize(rng) {
  while (true) {
    const height = randInt(rng, MIN_SIDE, MAX_SIDE)
    const width = randInt(rng, MIN_SIDE, MAX_SIDE)
    const area = height * width
    if (area >= MIN_AREA && area <= MAX_AREA) return { height, width, area }
  }
}

function samplePoisson(rng, lambda) {
  const limit = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rng()
  } while (p > limit)
  return k - 1
}

function samplePieceSizes(rng, area) {
  let remaining = area
  const sizes = []
  while (remaining > 0) {
    if (remaining <= MIN_PIECE_SIZE) {
      sizes.push(remaining)
      break
    }
    let size = samplePoisson(rng, POISSON_LAMBDA) + MIN_PIECE_SIZE
    if (size > remaining) size = remaining
    sizes.push(size)
    remaining -= size
  }
  return sizes
}

function cellKey(row, col) {
  return row * 100 + col
}

function floodFillSize(grid, height, width, startRow, startCol) {
  const seen = new Set([cellKey(startRow, startCol)])
  const stack = [[startRow, startCol]]
  while (stack.length) {
    const [row, col] = stack.pop()
    for (const [dr, dc] of DIRS) {
      const nr = row + dr
      const nc = col + dc
      if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue
      if (grid[nr][nc] !== -1) continue
      const k = cellKey(nr, nc)
      if (!seen.has(k)) {
        seen.add(k)
        stack.push([nr, nc])
      }
    }
  }
  return seen.size
}

// Grows a random connected polyomino of `targetSize` from `seed` by
// repeatedly adding a weighted-random empty cell adjacent to the piece so
// far ("frontier growth"). This is far less prone to dead-ending than a
// single-threaded random walk. The bounding box is hard-capped at 5x5, and
// once it exceeds 3x3, candidates that would expand it further are
// weighted down so pieces stay compact rather than snaking outward.
function growPiece(rng, grid, height, width, seed, targetSize) {
  const cells = [seed]
  const inPiece = new Set([cellKey(seed[0], seed[1])])
  const frontier = new Set()
  let minRow = seed[0]
  let maxRow = seed[0]
  let minCol = seed[1]
  let maxCol = seed[1]

  const addFrontier = (row, col) => {
    for (const [dr, dc] of DIRS) {
      const nr = row + dr
      const nc = col + dc
      if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue
      if (grid[nr][nc] !== -1) continue
      const k = cellKey(nr, nc)
      if (!inPiece.has(k)) frontier.add(k)
    }
  }
  addFrontier(seed[0], seed[1])

  while (cells.length < targetSize) {
    if (frontier.size === 0) return null

    const curHeight = maxRow - minRow + 1
    const curWidth = maxCol - minCol + 1
    const biasActive = Math.max(curHeight, curWidth) > EXPAND_BIAS_THRESHOLD

    const candidates = []
    for (const k of frontier) {
      const row = Math.floor(k / 100)
      const col = k % 100
      const newMinRow = Math.min(minRow, row)
      const newMaxRow = Math.max(maxRow, row)
      const newMinCol = Math.min(minCol, col)
      const newMaxCol = Math.max(maxCol, col)
      const newHeight = newMaxRow - newMinRow + 1
      const newWidth = newMaxCol - newMinCol + 1
      if (newHeight > MAX_BOX || newWidth > MAX_BOX) continue

      const expands = newHeight > curHeight || newWidth > curWidth
      const weight = biasActive && expands ? EXPAND_WEIGHT : SAME_WEIGHT
      candidates.push({ key: k, row, col, newMinRow, newMaxRow, newMinCol, newMaxCol, weight })
    }
    if (candidates.length === 0) return null

    const chosen = weightedPick(rng, candidates, (c) => c.weight)
    frontier.delete(chosen.key)
    cells.push([chosen.row, chosen.col])
    inPiece.add(chosen.key)
    minRow = chosen.newMinRow
    maxRow = chosen.newMaxRow
    minCol = chosen.newMinCol
    maxCol = chosen.newMaxCol
    addFrontier(chosen.row, chosen.col)
  }
  return cells
}

function normalizeShape(cells) {
  const minRow = Math.min(...cells.map((p) => p[0]))
  const minCol = Math.min(...cells.map((p) => p[1]))
  return cells.map(([r, c]) => [r - minRow, c - minCol]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

function rotateCells90(cells) {
  const maxRow = Math.max(...cells.map((p) => p[0]))
  return normalizeShape(cells.map(([r, c]) => [c, maxRow - r]))
}

function shapeKey(cells) {
  return normalizeShape(cells)
    .map(([r, c]) => `${r}:${c}`)
    .join('|')
}

// Canonical form under rotation only (no reflections), so a piece and any of
// its 4 rotations map to the same key for the duplicate-shape check.
function canonicalShapeKey(cells) {
  let variant = cells
  const keys = []
  for (let i = 0; i < 4; i++) {
    keys.push(shapeKey(variant))
    variant = rotateCells90(variant)
  }
  keys.sort()
  return keys[0]
}

function boundingBox(cells) {
  const rows = cells.map((p) => p[0])
  const cols = cells.map((p) => p[1])
  return { height: Math.max(...rows) - Math.min(...rows) + 1, width: Math.max(...cols) - Math.min(...cols) + 1 }
}

function firstEmptyCell(grid, height, width) {
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r][c] === -1) return [r, c]
    }
  }
  return null
}

// Backtracking placer: always grows the next piece to cover the first
// (row-major) empty cell, restricting candidate sizes to ones that fit that
// cell's connected empty region. On failure it undoes the most recent
// placement and tries the next alternative, bounded by a call budget.
function generateLayout(rng, height, width, sizes) {
  const grid = Array.from({ length: height }, () => Array(width).fill(-1))
  const remainingSizes = sizes.slice()
  const placed = []
  const usedShapeKeys = new Map()
  const budget = { calls: BACKTRACK_CALL_BUDGET }

  function place(size4DupUsed) {
    if (budget.calls-- <= 0) return false
    if (remainingSizes.length === 0) return true

    const empty = firstEmptyCell(grid, height, width)
    if (!empty) return false

    const pocketSize = floodFillSize(grid, height, width, empty[0], empty[1])
    const candidateSizes = Array.from(new Set(remainingSizes))
      .filter((s) => s <= pocketSize)
      .sort((a, b) => b * b - a * a)
    if (candidateSizes.length === 0) return false

    for (const size of candidateSizes) {
      const triedShapes = new Set()
      for (let attempt = 0; attempt < SHAPE_ATTEMPTS_PER_SIZE; attempt++) {
        const cells = growPiece(rng, grid, height, width, empty, size)
        if (!cells) continue
        const ck = canonicalShapeKey(cells)
        if (triedShapes.has(ck)) continue
        triedShapes.add(ck)

        const dupCount = usedShapeKeys.get(ck) || 0
        let newDupUsed = size4DupUsed
        if (dupCount > 0) {
          if (size === MIN_PIECE_SIZE && !size4DupUsed && dupCount === 1) {
            newDupUsed = true
          } else {
            continue
          }
        }

        const pieceId = placed.length
        for (const [r, c] of cells) grid[r][c] = pieceId
        placed.push({ id: pieceId, size, cells })
        usedShapeKeys.set(ck, dupCount + 1)
        const idx = remainingSizes.indexOf(size)
        const removed = remainingSizes.splice(idx, 1)[0]

        if (place(newDupUsed)) return true

        remainingSizes.splice(idx, 0, removed)
        usedShapeKeys.set(ck, dupCount)
        placed.pop()
        for (const [r, c] of cells) grid[r][c] = -1
        if (budget.calls <= 0) return false
      }
    }
    return false
  }

  const ok = place(false)
  return ok ? placed : null
}

// Evenly spaced hues (golden-angle spacing) stay visually distinct no matter
// how many pieces a given puzzle has, unlike a small fixed color pool.
function assignColors(rng, count) {
  const GOLDEN_ANGLE = 137.508
  const startHue = rng() * 360
  const colors = []
  for (let i = 0; i < count; i++) {
    const hue = (startHue + i * GOLDEN_ANGLE) % 360
    colors.push(hslToHex(hue, 65, 55))
  }
  return colors
}

function hslToHex(h, s, l) {
  s /= 100
  l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const toHex = (n) =>
    Math.round(255 * f(n))
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`
}

export function generateDailyPuzzle(dateString) {
  const rng = mulberry32(seedFromString(dateString))

  for (let attempt = 0; attempt < MAX_WHOLE_BOARD_RETRIES; attempt++) {
    const { height, width, area } = pickBoardSize(rng)
    const sizes = samplePieceSizes(rng, area)
    const placed = generateLayout(rng, height, width, sizes)
    if (placed) {
      const colors = assignColors(rng, placed.length)
      return {
        date: dateString,
        board: { width, height },
        pieces: placed.map((p, i) => ({ id: p.id, color: colors[i], cells: p.cells })),
      }
    }
  }

  throw new Error(`Could not generate a puzzle for ${dateString} within retry budget`)
}

export { boundingBox }
