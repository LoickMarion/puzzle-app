import { Link, Outlet } from 'react-router-dom'
import { GAMES_HUB_URL } from '../config'
import ThemeToggle from './ThemeToggle'

export default function Layout() {
  return (
    <div className="flex h-dvh flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2 text-sm dark:border-neutral-800">
        <div className="flex items-center gap-4">
          <a href={GAMES_HUB_URL} className="text-neutral-500 hover:underline dark:text-neutral-400">
            ← All games
          </a>
          <Link to="/" className="font-semibold tracking-tight">
            Polyomino Puzzle
          </Link>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
