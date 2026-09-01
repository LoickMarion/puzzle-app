import PuzzleBoard from '../components/PuzzleBoard'
import { BOARD_SIZE, MARGIN, createShuffledPieces } from '../game/logic'

export default function ClassicPage() {
  return (
    <PuzzleBoard
      boardWidth={BOARD_SIZE}
      boardHeight={BOARD_SIZE}
      margin={MARGIN}
      createInitialPieces={createShuffledPieces}
      onReset={createShuffledPieces}
      title="Polyomino Puzzle"
      subtitle="Drag every piece onto the board so it's fully covered with no overlaps. There's more than one way to do it. Find as many distinct solutions as you can!"
      resetLabel="Reset"
      trackSolutions
    />
  )
}
