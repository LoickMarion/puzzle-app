export type Shape = number[][]

export interface PieceDef {
  id: number
  color: string
  shape: Shape
}

export interface PieceState {
  id: number
  color: string
  shape: Shape
  x: number
  y: number
  // Set by a hint: the piece is shown in its correct spot and can no longer
  // be selected, dragged, or rotated until the board is reset.
  locked?: boolean
}
