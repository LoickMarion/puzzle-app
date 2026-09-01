import { useMemo } from 'react'
import { generateDailyPuzzle } from '../game/dailyGenerator'
import { scatterPieces, shapeFromCells } from '../game/logic'
import { isValidDailyDate } from '../lib/date'
import PuzzleBoard from './PuzzleBoard'

const MARGIN = 5

interface DailyPuzzlePlayerProps {
  date: string
  title: string
}

export default function DailyPuzzlePlayer({ date, title }: DailyPuzzlePlayerProps) {
  const result = useMemo(() => {
    if (!isValidDailyDate(date)) return { error: 'A valid date (YYYY-MM-DD) is required' }
    try {
      return { data: generateDailyPuzzle(date) }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Something went wrong' }
    }
  }, [date])

  if ('error' in result) {
    return (
      <main className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-red-500 dark:text-red-400">{result.error}</p>
      </main>
    )
  }

  const { width, height } = result.data.board
  const basePieces = result.data.pieces.map((p) => ({ id: p.id, color: p.color, shape: shapeFromCells(p.cells) }))
  const makePieces = () => scatterPieces(basePieces, width, height, MARGIN)
  const solution = result.data.pieces.map((p) => {
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
