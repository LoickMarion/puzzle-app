import { useEffect, useState } from 'react'
import { API_URL } from '../config'
import { scatterPieces, shapeFromCells } from '../game/logic'
import PuzzleBoard from './PuzzleBoard'

const MARGIN = 5

interface RawDailyPiece {
  id: number
  color: string
  cells: [number, number][]
}

interface DailyPuzzleData {
  date: string
  board: { width: number; height: number }
  pieces: RawDailyPiece[]
}

interface DailyPuzzlePlayerProps {
  date: string
  title: string
}

// If `date` can change across renders (e.g. the archive picker), render this
// with `key={date}` so switching dates remounts a fresh instance instead of
// showing stale data while the new fetch is in flight.
export default function DailyPuzzlePlayer({ date, title }: DailyPuzzlePlayerProps) {
  const [data, setData] = useState<DailyPuzzleData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(`${API_URL}/api/daily-puzzle?date=${date}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? `Request failed: ${res.status}`)
        if (!cancelled) setData(json)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Something went wrong')
      })

    return () => {
      cancelled = true
    }
  }, [date])

  if (error) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-red-500 dark:text-red-400">{error}</p>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-neutral-500 dark:text-neutral-400">Loading...</p>
      </main>
    )
  }

  const { width, height } = data.board
  const basePieces = data.pieces.map((p) => ({ id: p.id, color: p.color, shape: shapeFromCells(p.cells) }))
  const makePieces = () => scatterPieces(basePieces, width, height, MARGIN)
  const solution = data.pieces.map((p) => {
    const shape = shapeFromCells(p.cells)
    const x = Math.min(...p.cells.map(([, c]) => c))
    const y = Math.min(...p.cells.map(([r]) => r))
    return { id: p.id, color: p.color, shape, x, y }
  })

  return (
    <PuzzleBoard
      boardWidth={width}
      boardHeight={height}
      margin={MARGIN}
      createInitialPieces={makePieces}
      onReset={makePieces}
      solution={solution}
      title={title}
      subtitle={`Puzzle for ${date}. Drag every piece onto the board so it's fully covered with no overlaps.`}
      resetLabel="Reset"
    />
  )
}
