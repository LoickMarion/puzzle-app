import { useEffect, useState } from 'react'
import PuzzleBoard from '../components/PuzzleBoard'
import { API_URL } from '../config'
import { scatterPieces, shapeFromCells } from '../game/logic'

const DAILY_MARGIN = 5

function getEasternDateString(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d)
}

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

export default function DailyPage() {
  const [data, setData] = useState<DailyPuzzleData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const date = getEasternDateString()

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
        <h1 className="text-xl font-semibold tracking-tight">Daily Puzzle</h1>
        <p className="text-red-500 dark:text-red-400">{error}</p>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Daily Puzzle</h1>
        <p className="text-neutral-500 dark:text-neutral-400">Loading...</p>
      </main>
    )
  }

  const { width, height } = data.board
  const basePieces = data.pieces.map((p) => ({ id: p.id, color: p.color, shape: shapeFromCells(p.cells) }))
  const makePieces = () => scatterPieces(basePieces, width, height, DAILY_MARGIN)

  return (
    <PuzzleBoard
      boardWidth={width}
      boardHeight={height}
      margin={DAILY_MARGIN}
      createInitialPieces={makePieces}
      onReset={makePieces}
      title="Daily Puzzle"
      subtitle={`Today's puzzle — ${date}. Drag every piece onto the board so it's fully covered with no overlaps.`}
      resetLabel="Reset"
    />
  )
}
