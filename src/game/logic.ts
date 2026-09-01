import { PIECE_DEFS } from './shapes'
import type { PieceState, Shape } from './types'

export const BOARD_SIZE = 8
// How far outside the board pieces may sit while scattered, so there's room
// to lay all 13 of them out before the player drags them into place.
export const MARGIN = 4

// Works on any rows x cols grid (not just square ones) - rotating swaps the
// dimensions, so the result is cols x rows.
export function rotateCW(shape: Shape): Shape {
  const rows = shape.length
  const cols = shape[0].length
  const result: Shape = Array.from({ length: cols }, () => Array(rows).fill(0))
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      result[i][j] = shape[rows - 1 - j][i]
    }
  }
  return result
}

export function rotateCCW(shape: Shape): Shape {
  const rows = shape.length
  const cols = shape[0].length
  const result: Shape = Array.from({ length: cols }, () => Array(rows).fill(0))
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      result[i][j] = shape[j][cols - 1 - i]
    }
  }
  return result
}

// Crops a shape to the smallest square that contains its filled cells (the
// larger of its trimmed width/height on both sides), so a piece never carries
// dead space beyond what its own shape actually needs. This size is rotation-
// invariant - rotating swaps width and height, but max(width, height) doesn't
// change - so it only needs to run once, before any rotations are applied.
export function toMinimalSquareShape(shape: Shape): Shape {
  const rows = shape.length
  const cols = shape[0].length
  let minRow = rows
  let maxRow = -1
  let minCol = cols
  let maxCol = -1
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!shape[r][c]) continue
      minRow = Math.min(minRow, r)
      maxRow = Math.max(maxRow, r)
      minCol = Math.min(minCol, c)
      maxCol = Math.max(maxCol, c)
    }
  }

  const n = Math.max(maxRow - minRow + 1, maxCol - minCol + 1)
  const result: Shape = Array.from({ length: n }, () => Array(n).fill(0))
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      if (shape[r][c]) result[r - minRow][c - minCol] = 1
    }
  }
  return result
}

export function clampCoord(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export interface GridPoint {
  row: number
  col: number
}

// The piece's true outline as a single closed loop of grid-corner points, in
// clockwise order, ready to stroke as one SVG polygon. Drawing borders per
// cell (independent straight sides) is what caused the concave-corner
// problems - two unrelated cells' borders meeting edge-to-edge, or a patch
// bolted on to cover the seam. Tracing one continuous line and letting SVG's
// default miter join close each corner is the actual fix: every join, convex
// or concave, is just the two adjoining sides extended until they meet - not
// a special case, not a separate patch.
//
// Standard boundary-tracing technique: every filled cell contributes a
// clockwise edge for each side that isn't shared with another filled cell
// (shared - internal - edges are never emitted, so they can't appear twice
// and cancel out). What's left is exactly the outer boundary, and chaining
// each edge's end to the next edge's start walks it as one loop. Assumes the
// shape is simply connected (true for every piece this app generates) - a
// shape with a hole would need a second loop this doesn't handle.
export function getPieceOutline(shape: Shape): GridPoint[] {
  const rows = shape.length
  const cols = shape[0].length
  const filledAt = (row: number, col: number) =>
    row >= 0 && row < rows && col >= 0 && col < cols && shape[row][col] === 1

  const key = (p: GridPoint) => `${p.row},${p.col}`
  const nextFrom = new Map<string, GridPoint>()
  const addEdge = (from: GridPoint, to: GridPoint) => nextFrom.set(key(from), to)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!filledAt(row, col)) continue
      if (!filledAt(row - 1, col)) addEdge({ row, col }, { row, col: col + 1 }) // top
      if (!filledAt(row, col + 1)) addEdge({ row, col: col + 1 }, { row: row + 1, col: col + 1 }) // right
      if (!filledAt(row + 1, col)) addEdge({ row: row + 1, col: col + 1 }, { row: row + 1, col }) // bottom
      if (!filledAt(row, col - 1)) addEdge({ row: row + 1, col }, { row, col }) // left
    }
  }
  if (nextFrom.size === 0) return []

  const start = nextFrom.keys().next().value!
  const [startRow, startCol] = start.split(',').map(Number)
  const loop: GridPoint[] = [{ row: startRow, col: startCol }]
  for (let i = 0; i < nextFrom.size; i++) {
    const point = nextFrom.get(key(loop[loop.length - 1]))!
    if (point.row === startRow && point.col === startCol) break
    loop.push(point)
  }
  return loop
}

// Relative luminance of a #rrggbb color, used to pick a border tone that
// actually shows up against that piece's own fill.
export function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function createShuffledPieces(): PieceState[] {
  return scatterPieces(
    PIECE_DEFS.map((def) => ({ id: def.id, color: def.color, shape: toMinimalSquareShape(def.shape) })),
    BOARD_SIZE,
    BOARD_SIZE,
    MARGIN,
  )
}

// The largest x/y a piece's own top-left corner may sit at and still keep its
// *far* edge (which depends on the piece's own width/height) within the
// margin-extended canvas. minX/minY don't need a piece-size-aware equivalent:
// every piece is at most `margin` cells wide/tall, so anchoring its top-left
// corner at -margin already keeps its far edge within the board's own edge.
export function maxPieceX(pieceWidth: number, boardWidth: number, margin: number): number {
  return boardWidth + margin - pieceWidth
}

export function maxPieceY(pieceHeight: number, boardHeight: number, margin: number): number {
  return boardHeight + margin - pieceHeight
}

// A random position (within `margin` cells of the board) for a piece of the
// given size, resampled until its bounding box doesn't overlap the board at
// all.
function randomOffBoardPosition(
  pieceWidth: number,
  pieceHeight: number,
  boardWidth: number,
  boardHeight: number,
  margin: number,
): { x: number; y: number } {
  // +1: Math.random()*range gives [0, range), so this is an inclusive max.
  const rangeX = maxPieceX(pieceWidth, boardWidth, margin) - -margin + 1
  const rangeY = maxPieceY(pieceHeight, boardHeight, margin) - -margin + 1

  let x = -margin
  let y = -margin
  for (let attempt = 0; attempt < 200; attempt++) {
    x = Math.floor(Math.random() * rangeX) - margin
    y = Math.floor(Math.random() * rangeY) - margin
    const overlapsBoard = x < boardWidth && x + pieceWidth > 0 && y < boardHeight && y + pieceHeight > 0
    if (!overlapsBoard) break
  }
  return { x, y }
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

// A position for a piece of the given size that avoids both the board and
// every rectangle in `others` (already-placed pieces) - used for the initial
// scatter, and for bumping a piece that's in a hint's way somewhere clear.
// Tries random positions first; if none land free, slides the piece straight
// away from the board's center (along whichever axis it's already more
// offset on); if that line is still blocked, scans the whole scatter band for
// any fully clear spot. That last step finds one whenever one exists - only a
// scatter band too small/full to fit every piece without overlap can still
// return an overlapping position.
export function findClearPosition(
  pieceWidth: number,
  pieceHeight: number,
  boardWidth: number,
  boardHeight: number,
  margin: number,
  others: { x: number; y: number; shape: Shape }[],
): { x: number; y: number } {
  const overlapsBoard = (x: number, y: number) =>
    x < boardWidth && x + pieceWidth > 0 && y < boardHeight && y + pieceHeight > 0
  const overlapsOthers = (x: number, y: number) =>
    others.some((o) => rectsOverlap(x, y, pieceWidth, pieceHeight, o.x, o.y, o.shape[0].length, o.shape.length))
  const overlapsAny = (x: number, y: number) => overlapsBoard(x, y) || overlapsOthers(x, y)

  let { x, y } = randomOffBoardPosition(pieceWidth, pieceHeight, boardWidth, boardHeight, margin)
  for (let attempt = 0; attempt < 200 && overlapsAny(x, y); attempt++) {
    ;({ x, y } = randomOffBoardPosition(pieceWidth, pieceHeight, boardWidth, boardHeight, margin))
  }

  const maxX = maxPieceX(pieceWidth, boardWidth, margin)
  const maxY = maxPieceY(pieceHeight, boardHeight, margin)

  if (overlapsAny(x, y)) {
    const dx = x + pieceWidth / 2 - boardWidth / 2
    const dy = y + pieceHeight / 2 - boardHeight / 2
    const horizontal = Math.abs(dx) >= Math.abs(dy)
    const stepX = horizontal ? Math.sign(dx) || 1 : 0
    const stepY = horizontal ? 0 : Math.sign(dy) || 1
    const maxSteps = boardWidth + boardHeight + margin * 2
    for (let i = 0; i < maxSteps && overlapsAny(x, y); i++) {
      x = clampCoord(x + stepX, -margin, maxX)
      y = clampCoord(y + stepY, -margin, maxY)
    }
  }

  // Sliding along one axis can still land in another piece's way. Fall back
  // to scanning the whole scatter band for any fully clear spot - guaranteed
  // to find one if one exists anywhere, not just along that one line.
  if (overlapsAny(x, y)) {
    outer: for (let ty = -margin; ty <= maxY; ty++) {
      for (let tx = -margin; tx <= maxX; tx++) {
        if (!overlapsAny(tx, ty)) {
          x = tx
          y = ty
          break outer
        }
      }
    }
  }

  return { x, y }
}

// Applies a random rotation and a scattered, mutually non-overlapping
// position to each piece (best effort - see findClearPosition) - shared by
// Classic's fixed set and Daily's generated set alike.
export function scatterPieces(
  pieces: { id: number; color: string; shape: Shape }[],
  boardWidth: number,
  boardHeight: number,
  margin: number,
): PieceState[] {
  const placed: { x: number; y: number; shape: Shape }[] = []
  return pieces.map((piece) => {
    let shape = piece.shape
    const rotations = Math.floor(Math.random() * 4)
    for (let r = 0; r < rotations; r++) shape = rotateCW(shape)

    const { x, y } = findClearPosition(shape[0].length, shape.length, boardWidth, boardHeight, margin, placed)
    placed.push({ x, y, shape })

    return {
      id: piece.id,
      color: piece.color,
      shape,
      x,
      y,
    }
  })
}

// Builds a piece's shape from its absolute solved-board cells (as produced by
// the daily generator), by cropping to the tight bounding box and then to its
// minimal square, exactly like a Classic piece.
export function shapeFromCells(cells: [number, number][]): Shape {
  const minRow = Math.min(...cells.map(([r]) => r))
  const minCol = Math.min(...cells.map(([, c]) => c))
  const maxRow = Math.max(...cells.map(([r]) => r))
  const maxCol = Math.max(...cells.map(([, c]) => c))
  const tight: Shape = Array.from({ length: maxRow - minRow + 1 }, () =>
    Array(maxCol - minCol + 1).fill(0),
  )
  for (const [r, c] of cells) tight[r - minRow][c - minCol] = 1
  return toMinimalSquareShape(tight)
}

export interface BoardEvaluation {
  occupancy: number[][]
  overflowIds: Set<number>
  solved: boolean
}

// Recomputed fresh from piece positions each time, rather than incrementally
// adding/subtracting into a shared grid (the original Java approach) - simpler
// to keep correct under React state updates.
export function evaluateBoard(pieces: PieceState[], boardWidth: number, boardHeight: number): BoardEvaluation {
  const occupancy = Array.from({ length: boardHeight }, () => Array(boardWidth).fill(0))
  const overflowIds = new Set<number>()

  for (const piece of pieces) {
    for (let j = 0; j < piece.shape.length; j++) {
      for (let i = 0; i < piece.shape[j].length; i++) {
        if (!piece.shape[j][i]) continue
        const boardX = piece.x + i
        const boardY = piece.y + j
        if (boardX < 0 || boardX >= boardWidth || boardY < 0 || boardY >= boardHeight) {
          overflowIds.add(piece.id)
          continue
        }
        occupancy[boardY][boardX] += 1
      }
    }
  }

  const solved =
    overflowIds.size === 0 && occupancy.every((row) => row.every((cell) => cell === 1))

  return { occupancy, overflowIds, solved }
}

// Identifies a *tiling* (which cells each piece covers), not the moves used to
// reach it - only meaningful when the board is solved. Two solves that used
// different rotation counts but ended with the same pieces on the same cells
// produce the same fingerprint.
export function getSolutionFingerprint(pieces: PieceState[], boardWidth: number): string {
  return pieces
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((piece) => {
      const cells: number[] = []
      for (let j = 0; j < piece.shape.length; j++) {
        for (let i = 0; i < piece.shape[j].length; i++) {
          if (piece.shape[j][i]) cells.push((piece.y + j) * boardWidth + (piece.x + i))
        }
      }
      return `${piece.id}:${cells.sort((a, b) => a - b).join(',')}`
    })
    .join('|')
}

// Absolute board cells a piece currently covers - cells that fall outside the
// board (scattered pieces, or an in-progress drag) are excluded, since a
// piece hanging off the edge covers nothing ON the board. Used both to check
// whether a piece already sits in its correct (hint-target) spot, and to
// detect when some other piece is in the way of a hint about to land.
export function pieceCoveredCells(
  piece: { shape: Shape; x: number; y: number },
  boardWidth: number,
  boardHeight: number,
): number[] {
  const cells: number[] = []
  for (let j = 0; j < piece.shape.length; j++) {
    for (let i = 0; i < piece.shape[j].length; i++) {
      if (!piece.shape[j][i]) continue
      const boardX = piece.x + i
      const boardY = piece.y + j
      if (boardX < 0 || boardX >= boardWidth || boardY < 0 || boardY >= boardHeight) continue
      cells.push(boardY * boardWidth + boardX)
    }
  }
  return cells.sort((a, b) => a - b)
}

export function pieceCoveredCellsKey(
  piece: { shape: Shape; x: number; y: number },
  boardWidth: number,
  boardHeight: number,
): string {
  return pieceCoveredCells(piece, boardWidth, boardHeight).join(',')
}
