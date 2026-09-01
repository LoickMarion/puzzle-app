import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import {
  BOARD_SIZE,
  GRID_SIZE,
  MARGIN,
  clampCoord,
  createShuffledPieces,
  evaluateBoard,
  getCellEdges,
  relativeLuminance,
  rotateCCW,
  rotateCW,
} from '../game/logic'
import type { PieceState } from '../game/types'
import Controls from './Controls'

const MIN_CELL = 14
const MAX_CELL = 46

export default function PuzzleGame() {
  const [pieces, setPieces] = useState<PieceState[]>(() => createShuffledPieces())
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [cellSize, setCellSize] = useState(0)

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
      const size = Math.floor(Math.min(width, height) / GRID_SIZE)
      setCellSize(Math.max(MIN_CELL, Math.min(MAX_CELL, size)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { occupancy, overflowIds, solved } = evaluateBoard(pieces)

  const movePiece = useCallback((id: number, dx: number, dy: number) => {
    setPieces((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, x: clampCoord(p.x + dx), y: clampCoord(p.y + dy) } : p,
      ),
    )
  }, [])

  const rotatePiece = useCallback((id: number, direction: 'cw' | 'ccw') => {
    setPieces((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, shape: direction === 'cw' ? rotateCW(p.shape) : rotateCCW(p.shape) } : p,
      ),
    )
  }, [])

  const shuffle = useCallback(() => {
    setPieces(createShuffledPieces())
    setSelectedId(null)
  }, [])

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
      e.stopPropagation()
      setSelectedId(piece.id)

      const pointerId = e.pointerId
      const startClientX = e.clientX
      const startClientY = e.clientY
      const originX = piece.x
      const originY = piece.y

      const onMove = (ev: globalThis.PointerEvent) => {
        if (ev.pointerId !== pointerId) return
        const size = cellSizeRef.current
        if (!size) return
        const dx = Math.round((ev.clientX - startClientX) / size)
        const dy = Math.round((ev.clientY - startClientY) / size)
        const nextX = clampCoord(originX + dx)
        const nextY = clampCoord(originY + dy)
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
    [],
  )

  const selectedPiece = pieces.find((p) => p.id === selectedId) ?? null
  const canvasSize = cellSize * GRID_SIZE

  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Polyomino Puzzle</h1>
          <p className="text-xs text-neutral-400">
            Drag every piece onto the board so it's fully covered with no overlaps.
          </p>
        </div>
        <button
          type="button"
          onClick={shuffle}
          className="shrink-0 rounded-lg bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-100 active:bg-neutral-700"
        >
          New puzzle
        </button>
      </header>

      <main
        ref={containerRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-neutral-900 px-2"
        onPointerDown={() => setSelectedId(null)}
      >
        {solved && (
          <div className="absolute top-3 z-30 rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 shadow-lg">
            🎉 Solved!
          </div>
        )}

        {cellSize > 0 && (
          <div className="relative touch-none select-none" style={{ width: canvasSize, height: canvasSize }}>
            <div
              className="absolute grid overflow-hidden rounded-md shadow-[0_0_0_3px_rgba(0,0,0,0.4)] ring-2 ring-slate-400"
              style={{
                left: MARGIN * cellSize,
                top: MARGIN * cellSize,
                width: BOARD_SIZE * cellSize,
                height: BOARD_SIZE * cellSize,
                // A shared CSS Grid (rather than each cell absolutely positioned and
                // sized on its own) keeps every boundary pixel-aligned even under
                // fractional display scaling - independently-rounded absolute boxes
                // can end up a physical pixel off from their neighbors.
                gridTemplateColumns: `repeat(${BOARD_SIZE}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${BOARD_SIZE}, ${cellSize}px)`,
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
              // reads clearly whether the piece is pale or near-black.
              const borderColor = isSelected
                ? '#ffffff'
                : hasOverflow
                  ? '#f87171'
                  : relativeLuminance(piece.color) > 0.5
                    ? 'rgba(0,0,0,0.6)'
                    : 'rgba(255,255,255,0.7)'
              const borderWidth = isSelected ? 3 : 2
              return (
                <div
                  key={piece.id}
                  className="absolute grid"
                  style={{
                    left: (piece.x + MARGIN) * cellSize,
                    top: (piece.y + MARGIN) * cellSize,
                    width: cellSize * 4,
                    height: cellSize * 4,
                    gridTemplateColumns: `repeat(4, ${cellSize}px)`,
                    gridTemplateRows: `repeat(4, ${cellSize}px)`,
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
                          className="cursor-grab touch-none active:cursor-grabbing"
                          style={{
                            backgroundColor: piece.color,
                            pointerEvents: 'auto',
                            boxSizing: 'border-box',
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
                left: MARGIN * cellSize,
                top: MARGIN * cellSize,
                width: BOARD_SIZE * cellSize,
                height: BOARD_SIZE * cellSize,
                gridTemplateColumns: `repeat(${BOARD_SIZE}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${BOARD_SIZE}, ${cellSize}px)`,
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
