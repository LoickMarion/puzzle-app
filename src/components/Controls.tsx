import type { PieceState } from '../game/types'

interface ControlsProps {
  selectedPiece: PieceState | null
  onMove: (dx: number, dy: number) => void
  onRotate: (direction: 'cw' | 'ccw') => void
}

const buttonClass =
  'flex h-11 w-11 items-center justify-center rounded-lg bg-neutral-200 text-xl font-bold text-neutral-900 disabled:opacity-30 active:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:active:bg-neutral-700'

export default function Controls({ selectedPiece, onMove, onRotate }: ControlsProps) {
  const disabled = selectedPiece == null

  return (
    <footer
      className="flex flex-wrap items-center justify-between gap-4 border-t border-neutral-200 bg-neutral-50/95 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/95"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
        <span
          className="h-6 w-6 rounded ring-1 ring-white/20"
          style={{ backgroundColor: selectedPiece?.color ?? 'transparent' }}
        />
        <span>{selectedPiece ? 'Piece selected' : 'Tap a piece to select it'}</span>
      </div>

      <div className="grid grid-cols-3 grid-rows-2 gap-1.5">
        <div />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onMove(0, -1)}
          className={buttonClass}
          aria-label="Move up"
        >
          ↑
        </button>
        <div />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onMove(-1, 0)}
          className={buttonClass}
          aria-label="Move left"
        >
          ←
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onMove(0, 1)}
          className={buttonClass}
          aria-label="Move down"
        >
          ↓
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onMove(1, 0)}
          className={buttonClass}
          aria-label="Move right"
        >
          →
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onRotate('ccw')}
          className={buttonClass}
          aria-label="Rotate left"
        >
          ↺
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onRotate('cw')}
          className={buttonClass}
          aria-label="Rotate right"
        >
          ↻
        </button>
      </div>
    </footer>
  )
}
