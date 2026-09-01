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

export interface CellEdges {
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
}

// A cell's edge is part of the piece's true outline only when there's no filled
// neighbor on that side - an edge shared with another filled cell of the same
// piece isn't drawn, so the piece reads as one solid shape instead of a grid of
// separately-outlined tiles.
export function getCellEdges(shape: Shape, j: number, i: number): CellEdges {
  const rows = shape.length
  const cols = shape[0].length
  const filledAt = (row: number, col: number) =>
    row >= 0 && row < rows && col >= 0 && col < cols && shape[row][col] === 1
  return {
    top: !filledAt(j - 1, i),
    right: !filledAt(j, i + 1),
    bottom: !filledAt(j + 1, i),
    left: !filledAt(j, i - 1),
  }
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

// Applies a random rotation and a random scattered position (within `margin`
// cells of the board on every side) to each piece - shared by Classic's fixed
// set and Daily's generated set alike.
export function scatterPieces(
  pieces: { id: number; color: string; shape: Shape }[],
  boardWidth: number,
  boardHeight: number,
  margin: number,
): PieceState[] {
  const gridWidth = boardWidth + margin * 2
  const gridHeight = boardHeight + margin * 2
  return pieces.map((piece) => {
    let shape = piece.shape
    const rotations = Math.floor(Math.random() * 4)
    for (let r = 0; r < rotations; r++) shape = rotateCW(shape)

    return {
      id: piece.id,
      color: piece.color,
      shape,
      x: Math.floor(Math.random() * gridWidth) - margin,
      y: Math.floor(Math.random() * gridHeight) - margin,
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
