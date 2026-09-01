import type { PieceDef } from './types'

// Ported from the original APCSA-Puzzle Java project (Pieces.java / Board.java setUp()).
// Each shape is a 4x4 grid of 0/1; all 13 shapes together cover exactly 64 cells,
// tiling the 8x8 board with no gaps or overlaps when solved.
export const PIECE_DEFS: PieceDef[] = [
  {
    id: 0,
    color: '#fa3c46',
    shape: [
      [1, 1, 1, 0],
      [1, 0, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  {
    id: 1,
    color: '#148c55',
    shape: [
      [1, 1, 1, 1],
      [0, 0, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  {
    id: 2,
    color: '#243e3e',
    shape: [
      [1, 0, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
    ],
  },
  {
    id: 3,
    color: '#c8d7e1',
    shape: [
      [1, 0, 1, 0],
      [1, 1, 1, 0],
      [1, 0, 1, 0],
      [0, 0, 0, 0],
    ],
  },
  {
    id: 4,
    color: '#642d8c',
    shape: [
      [0, 1, 0, 0],
      [1, 1, 1, 0],
      [1, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  {
    id: 5,
    color: '#234696',
    shape: [
      [1, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  {
    id: 6,
    color: '#b464c8',
    shape: [
      [1, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 0],
    ],
  },
  {
    id: 7,
    color: '#aac846',
    shape: [
      [1, 0, 0, 0],
      [1, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
    ],
  },
  {
    id: 8,
    color: '#32c8d2',
    shape: [
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  {
    id: 9,
    color: '#872891',
    shape: [
      [1, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  {
    id: 10,
    color: '#1e1e50',
    shape: [
      [1, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  {
    id: 11,
    color: '#8278bf',
    shape: [
      [1, 1, 1, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  {
    id: 12,
    color: '#6eb43c',
    shape: [
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  },
]
