import { PIECE_DEFS } from './shapes'
import type { PieceState, Shape } from './types'

export const BOARD_SIZE = 8
// How far outside the board pieces may sit while scattered, so there's room
// to lay all 13 of them out before the player drags them into place.
export const MARGIN = 4
export const GRID_SIZE = BOARD_SIZE + MARGIN * 2
export const MIN_COORD = -MARGIN
export const MAX_COORD = BOARD_SIZE - 1 + MARGIN

export function rotateCW(shape: Shape): Shape {
  const n = 4
  const result: Shape = Array.from({ length: n }, () => Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      result[i][j] = shape[n - 1 - j][i]
    }
  }
  return result
}

export function rotateCCW(shape: Shape): Shape {
  const n = 4
  const result: Shape = Array.from({ length: n }, () => Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      result[i][j] = shape[j][n - 1 - i]
    }
  }
  return result
}

export function clampCoord(value: number): number {
  return Math.min(MAX_COORD, Math.max(MIN_COORD, value))
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
  const filledAt = (row: number, col: number) =>
    row >= 0 && row < 4 && col >= 0 && col < 4 && shape[row][col] === 1
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
  return PIECE_DEFS.map((def) => {
    let shape = def.shape
    const rotations = Math.floor(Math.random() * 4)
    for (let r = 0; r < rotations; r++) shape = rotateCW(shape)

    return {
      id: def.id,
      color: def.color,
      shape,
      x: Math.floor(Math.random() * GRID_SIZE) - MARGIN,
      y: Math.floor(Math.random() * GRID_SIZE) - MARGIN,
    }
  })
}

export interface BoardEvaluation {
  occupancy: number[][]
  overflowIds: Set<number>
  solved: boolean
}

// Recomputed fresh from piece positions each time, rather than incrementally
// adding/subtracting into a shared grid (the original Java approach) - simpler
// to keep correct under React state updates.
export function evaluateBoard(pieces: PieceState[]): BoardEvaluation {
  const occupancy = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0))
  const overflowIds = new Set<number>()

  for (const piece of pieces) {
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        if (!piece.shape[j][i]) continue
        const boardX = piece.x + i
        const boardY = piece.y + j
        if (boardX < 0 || boardX >= BOARD_SIZE || boardY < 0 || boardY >= BOARD_SIZE) {
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
