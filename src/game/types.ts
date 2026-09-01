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
}
