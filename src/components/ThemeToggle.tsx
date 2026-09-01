import { useTheme } from '../theme/useTheme'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-200 text-lg active:bg-neutral-300 dark:bg-neutral-800 dark:active:bg-neutral-700"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
