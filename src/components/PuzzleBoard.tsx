import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { getFoundCount, recordSolution } from '../lib/foundSolutions'
import {
  clampCoord,
  evaluateBoard,
  findClearPosition,
  getCellEdges,
  getSolutionFingerprint,
  maxPieceX,
  maxPieceY,
  pieceCoveredCells,
  pieceCoveredCellsKey,
  relativeLuminance,
  rotateCCW,
  rotateCW,
} from '../game/logic'
import type { PieceState } from '../game/types'
import Controls from './Controls'

const MAX_CELL = 46

interface PuzzleBoardProps {
  boardWidth: number
  boardHeight: number
  margin: number
  title: string
  subtitle: string
  resetLabel: string
  createInitialPieces: () => PieceState[]
  onReset: () => PieceState[]
  // Classic-only "distinct solutions found" collection feature - only makes
  // sense against a fixed, stable piece set, so Daily's generated puzzles
  // just get a plain "solved" banner instead.
  trackSolutions?: boolean
  // Each piece's correct {shape, x, y}. When provided, a Hint button appears
  // that drops one not-yet-correct, unlocked piece into place and locks it.
  solution?: PieceState[]
}

export default function PuzzleBoard({
  boardWidth,
  boardHeight,
  margin,
  title,
  subtitle,
  resetLabel,
  createInitialPieces,
  onReset,
  trackSolutions = false,
  solution,
}: PuzzleBoardProps) {
  const [pieces, setPieces] = useState<PieceState[]>(createInitialPieces)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [cellSize, setCellSize] = useState(0)

  const gridWidth = boardWidth + margin * 2
  const gridHeight = boardHeight + margin * 2
  // Every piece is at most `margin` cells wide/tall, so anchoring a piece's
  // top-left corner at -margin always keeps its far edge within the canvas -
  // but the *max* a piece can sit at depends on that piece's own size (a
  // bigger piece needs a smaller max, or its far edge runs off the canvas).
  const minX = -margin
  const minY = -margin

  const containerRef = useRef<HTMLDivElement | null>(null)
  // Mirrors `cellSize` for the drag listeners below, which are set up once per
  // drag gesture and shouldn't close over a stale value from that moment.
  const cellSizeRef = useRef(cellSize)
  useEffect(() => {
    cellSizeRef.current = cellSize
  }, [cellSize])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      // Only cap the upper bound - never force cells bigger than what actually
      // fits, or the canvas overflows its container (and, on a short viewport,
      // can render behind the controls below it).
      const size = Math.floor(Math.min(width / gridWidth, height / gridHeight))
      setCellSize(Math.max(1, Math.min(MAX_CELL, size)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [gridWidth, gridHeight])

  const { occupancy, overflowIds, solved } = evaluateBoard(pieces, boardWidth, boardHeight)

  const [foundCount, setFoundCount] = useState(() => (trackSolutions ? getFoundCount() : 0))
  const [solveInfo, setSolveInfo] = useState<{ isNew: boolean; total: number } | null>(null)
  const wasSolvedRef = useRef(false)

  useEffect(() => {
    if (solved && !wasSolvedRef.current) {
      const result = trackSolutions
        ? recordSolution(getSolutionFingerprint(pieces, boardWidth))
        : { isNew: true, total: 0 }
      setSolveInfo(result)
      setFoundCount(result.total)
    } else if (!solved && wasSolvedRef.current) {
      setSolveInfo(null)
    }
    wasSolvedRef.current = solved
  }, [solved, pieces, trackSolutions, boardWidth])

  const movePiece = useCallback(
    (id: number, dx: number, dy: number) => {
      setPieces((prev) =>
        prev.map((p) => {
          if (p.id !== id || p.locked) return p
          const maxX = maxPieceX(p.shape[0].length, boardWidth, margin)
          const maxY = maxPieceY(p.shape.length, boardHeight, margin)
          return { ...p, x: clampCoord(p.x + dx, minX, maxX), y: clampCoord(p.y + dy, minY, maxY) }
        }),
      )
    },
    [minX, minY, boardWidth, boardHeight, margin],
  )

  const rotatePiece = useCallback((id: number, direction: 'cw' | 'ccw') => {
    setPieces((prev) =>
      prev.map((p) =>
        p.id === id && !p.locked ? { ...p, shape: direction === 'cw' ? rotateCW(p.shape) : rotateCCW(p.shape) } : p,
      ),
    )
  }, [])

  // Reveals one not-yet-correct, unlocked piece in its solved spot and locks
  // it there. Skips pieces the player has already gotten right themselves, so
  // every hint makes visible progress.
  const hintCandidateIds = useMemo(
    () =>
      solution
        ? pieces
            .filter((p) => !p.locked)
            .filter((p) => {
              const target = solution.find((s) => s.id === p.id)
              return (
                target != null &&
                pieceCoveredCellsKey(p, boardWidth, boardHeight) !== pieceCoveredCellsKey(target, boardWidth, boardHeight)
              )
            })
            .map((p) => p.id)
        : [],
    [pieces, solution, boardWidth, boardHeight],
  )

  const hint = useCallback(() => {
    if (hintCandidateIds.length === 0) return
    const pickId = hintCandidateIds[Math.floor(Math.random() * hintCandidateIds.length)]
    const target = solution?.find((s) => s.id === pickId)
    if (!target) return
    const targetCells = new Set(pieceCoveredCells(target, boardWidth, boardHeight))

    setPieces((prev) =>
      prev.map((p) => {
        if (p.id === pickId) return { ...p, shape: target.shape, x: target.x, y: target.y, locked: true }
        // Bump any other loose piece out of the way if it's sitting on the
        // cells this hint is about to occupy, so the two don't visibly overlap.
        if (p.locked) return p
        const inTheWay = pieceCoveredCells(p, boardWidth, boardHeight).some((cell) => targetCells.has(cell))
        if (!inTheWay) return p
        const others = prev
          .filter((o) => o.id !== p.id && o.id !== pickId)
          .map((o) => ({ x: o.x, y: o.y, shape: o.shape }))
        others.push({ x: target.x, y: target.y, shape: target.shape })
        const { x, y } = findClearPosition(p.shape[0].length, p.shape.length, boardWidth, boardHeight, margin, others)
        return { ...p, x, y }
      }),
    )
    setSelectedId((id) => (id === pickId ? null : id))
  }, [hintCandidateIds, solution, boardWidth, boardHeight, margin])

  const reset = useCallback(() => {
    setPieces(onReset())
    setSelectedId(null)
  }, [onReset])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (selectedId == null) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

      switch (e.key.toLowerCase()) {
        case 'a':
        case 'arrowleft':
          movePiece(selectedId, -1, 0)
          break
        case 'd':
        case 'arrowright':
          movePiece(selectedId, 1, 0)
          break
        case 'w':
        case 'arrowup':
          movePiece(selectedId, 0, -1)
          break
        case 's':
        case 'arrowdown':
          movePiece(selectedId, 0, 1)
          break
        case 'q':
          rotatePiece(selectedId, 'ccw')
          break
        case 'e':
          rotatePiece(selectedId, 'cw')
          break
        default:
          return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, movePiece, rotatePiece])

  // Rotating a piece mid-drag changes which grid cells are "filled", so the
  // specific sub-cell <div> under the pointer can unmount and remount elsewhere.
  // Tracking the drag via that div's own onPointerMove/onPointerUp (or relying on
  // setPointerCapture, which is silently released when its element unmounts)
  // leaves the drag orphaned - it then resumes from stray hover events later,
  // which looks exactly like the piece "desyncing" from the cursor. Window-level
  // listeners sidestep this: they don't care what DOM churn happens underneath.
  const handlePieceDown = useCallback(
    (piece: PieceState) => (e: PointerEvent<HTMLDivElement>) => {
      if (piece.locked) return
      e.stopPropagation()
      setSelectedId(piece.id)

      const pointerId = e.pointerId
      const startClientX = e.clientX
      const startClientY = e.clientY
      const originX = piece.x
      const originY = piece.y
      // A rotation keeps a piece's own bounding square the same size (only
      // its content shifts within it), so these stay valid for the whole
      // drag even if the piece gets rotated mid-gesture.
      const pieceMaxX = maxPieceX(piece.shape[0].length, boardWidth, margin)
      const pieceMaxY = maxPieceY(piece.shape.length, boardHeight, margin)

      const onMove = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId !== pointerId) return
        const size = cellSizeRef.current
        if (!size) return
        const dx = Math.round((ev.clientX - startClientX) / size)
        const dy = Math.round((ev.clientY - startClientY) / size)
        const nextX = clampCoord(originX + dx, minX, pieceMaxX)
        const nextY = clampCoord(originY + dy, minY, pieceMaxY)
        setPieces((prev) =>
          prev.map((p) =>
            p.id === piece.id && (p.x !== nextX || p.y !== nextY) ? { ...p, x: nextX, y: nextY } : p,
          ),
        )
      }

      const onUp = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId !== pointerId) return
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [minX, minY, boardWidth, boardHeight, margin],
  )

  const selectedPiece = pieces.find((p) => p.id === selectedId) ?? null
  const canvasWidth = cellSize * gridWidth
  const canvasHeight = cellSize * gridHeight

  return (
    <div className="flex h-full flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {trackSolutions && (
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              Solutions found: <span className="font-semibold text-neutral-900 dark:text-neutral-100">{foundCount}</span>
            </span>
          )}
          {solution && (
            <button
              type="button"
              onClick={hint}
              disabled={hintCandidateIds.length === 0}
              className="rounded-lg bg-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 disabled:opacity-30 active:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:active:bg-neutral-700"
            >
              {hintCandidateIds.length === 0 ? 'No hints left' : 'Hint'}
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 active:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:active:bg-neutral-700"
          >
            {resetLabel}
          </button>
        </div>
      </header>

      <main
        ref={containerRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-neutral-100 px-2 dark:bg-neutral-900"
        onPointerDown={() => setSelectedId(null)}
      >
        {solveInfo && (
          <div className="absolute top-3 z-30 rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 shadow-lg">
            {trackSolutions
              ? solveInfo.isNew
                ? `🎉 New solution! (${solveInfo.total} found)`
                : "✅ Solved — you've found this one before"
              : '🎉 Solved!'}
          </div>
        )}

        {cellSize > 0 && (
          <div className="relative touch-none select-none" style={{ width: canvasWidth, height: canvasHeight }}>
            <div
              className="absolute grid overflow-hidden rounded-md shadow-[0_0_0_3px_rgba(0,0,0,0.4)] ring-2 ring-slate-400"
              style={{
                left: margin * cellSize,
                top: margin * cellSize,
                width: boardWidth * cellSize,
                height: boardHeight * cellSize,
                // A shared CSS Grid (rather than each cell absolutely positioned and
                // sized on its own) keeps every boundary pixel-aligned even under
                // fractional display scaling - independently-rounded absolute boxes
                // can end up a physical pixel off from their neighbors.
                gridTemplateColumns: `repeat(${boardWidth}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${boardHeight}, ${cellSize}px)`,
              }}
            >
              {occupancy.map((row, y) =>
                row.map((_count, x) => {
                  const dark = (x + y) % 2 === 1
                  const bg = dark ? 'bg-slate-500' : 'bg-slate-600'
                  return <div key={`${x}-${y}`} className={bg} />
                }),
              )}
            </div>

            {pieces.map((piece) => {
              const isSelected = piece.id === selectedId
              const hasOverflow = overflowIds.has(piece.id)
              // A border that contrasts with the piece's own fill, so the outline
              // reads clearly whether the piece is pale or near-black. Locked
              // pieces always get the same gold ring, regardless of selection,
              // so "hinted and locked" reads as its own distinct state.
              const borderColor = piece.locked
                ? '#facc15'
                : isSelected
                  ? '#ffffff'
                  : hasOverflow
                    ? '#f87171'
                    : relativeLuminance(piece.color) > 0.5
                      ? 'rgba(0,0,0,0.6)'
                      : 'rgba(255,255,255,0.7)'
              const borderWidth = isSelected ? 3 : 2
              const pieceRows = piece.shape.length
              const pieceCols = piece.shape[0].length
              return (
                <div
                  key={piece.id}
                  className="absolute grid"
                  style={{
                    left: (piece.x + margin) * cellSize,
                    top: (piece.y + margin) * cellSize,
                    width: cellSize * pieceCols,
                    height: cellSize * pieceRows,
                    gridTemplateColumns: `repeat(${pieceCols}, ${cellSize}px)`,
                    gridTemplateRows: `repeat(${pieceRows}, ${cellSize}px)`,
                    zIndex: isSelected ? 20 : 10,
                    pointerEvents: 'none',
                  }}
                >
                  {piece.shape.map((row, j) =>
                    row.map((filled, i) => {
                      if (!filled) return <div key={`${i}-${j}`} />
                      const edges = getCellEdges(piece.shape, j, i)
                      const side = (visible: boolean) => (visible ? `${borderWidth}px solid ${borderColor}` : 'none')
                      return (
                        <div
                          key={`${i}-${j}`}
                          onPointerDown={handlePieceDown(piece)}
                          className={
                            piece.locked
                              ? 'cursor-default touch-none'
                              : 'cursor-grab touch-none active:cursor-grabbing'
                          }
                          style={{
                            backgroundColor: piece.color,
                            pointerEvents: 'auto',
                            boxSizing: 'border-box',
                            // Without this, a grid item's implicit auto min-size
                            // can keep it from shrinking below its own border
                            // width, letting cells (and the border) bleed past
                            // the intended box on a very constrained layout.
                            minWidth: 0,
                            minHeight: 0,
                            // Borders only appear on a cell's true outer edges (no filled
                            // neighbor on that side) so a piece reads as one solid shape
                            // instead of a grid of separately-outlined tiles.
                            borderTop: side(edges.top),
                            borderRight: side(edges.right),
                            borderBottom: side(edges.bottom),
                            borderLeft: side(edges.left),
                          }}
                        />
                      )
                    }),
                  )}
                </div>
              )
            })}

            {/* Overlap markers sit above every piece so a collision is always visible. */}
            <div
              className="pointer-events-none absolute grid"
              style={{
                left: margin * cellSize,
                top: margin * cellSize,
                width: boardWidth * cellSize,
                height: boardHeight * cellSize,
                gridTemplateColumns: `repeat(${boardWidth}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${boardHeight}, ${cellSize}px)`,
                zIndex: 30,
              }}
            >
              {occupancy.map((row, y) =>
                row.map((count, x) => (
                  <div key={`overlap-${x}-${y}`} className="flex items-center justify-center">
                    {count > 1 && <div className="h-2/3 w-2/3 rounded-full bg-rose-500/90 ring-2 ring-white/70" />}
                  </div>
                )),
              )}
            </div>
          </div>
        )}
      </main>

      <Controls
        selectedPiece={selectedPiece}
        onMove={(dx, dy) => selectedId != null && movePiece(selectedId, dx, dy)}
        onRotate={(dir) => selectedId != null && rotatePiece(selectedId, dir)}
      />
    </div>
  )
}
