import { Link } from 'react-router-dom'

const cardClass =
  'flex flex-col gap-1 rounded-xl bg-neutral-100 px-5 py-4 text-left transition active:bg-neutral-200 dark:bg-neutral-900 dark:active:bg-neutral-800'

export default function Landing() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 overflow-auto px-4 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Polyomino Puzzle</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Tile the board with all the pieces, no gaps or overlaps.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link to="/classic" className={cardClass}>
          <span className="font-medium">Classic</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            See how many solutions you can find!
          </span>
        </Link>
        <Link to="/daily" className={cardClass}>
          <span className="font-medium">Daily</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            One puzzle, shared by everyone, based on today's date.
          </span>
        </Link>
        <Link to="/archive" className={cardClass}>
          <span className="font-medium">Daily Archive</span>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            Pick a date and replay any past daily puzzle.
          </span>
        </Link>
      </div>
    </main>
  )
}
