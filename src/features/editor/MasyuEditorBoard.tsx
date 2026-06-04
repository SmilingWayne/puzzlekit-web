import { useEffect, useMemo, useRef, useState } from 'react'
import { cellKey, parseCellKey } from '../../domain/ir/keys'
import type { PuzzleIR } from '../../domain/ir/types'
import { PuzzleStatsInfoButton } from '../puzzleStats/PuzzleStatsInfoButton'
import type { MasyuPearlDraft } from './editorStore'

type Props = {
  puzzle: PuzzleIR
  pluginId: string
  pearlTool: MasyuPearlDraft
  onCellPearlChange: (key: string, color: MasyuPearlDraft) => void
  onCellPearlCycle: (key: string) => void
}

const CELL_SIZE = 52
const PADDING = 48
const MIN_ZOOM = 20
const MAX_ZOOM = 200
const ZOOM_STEP = 5
const CELL_DRAG_SAMPLE_DISTANCE = 16

type DragSession = {
  mode: 'paint' | 'cycle'
  tool: Exclude<MasyuPearlDraft, null> | null
  startClientX: number
  startClientY: number
  lastClientX: number
  lastClientY: number
  visitedCells: Set<string>
  initialPearls: Map<string, Exclude<MasyuPearlDraft, null>>
}

const isCellKeyInPuzzle = (key: string, puzzle: PuzzleIR): boolean => {
  const [row, col] = parseCellKey(key)
  return row >= 0 && col >= 0 && row < puzzle.rows && col < puzzle.cols
}

export const MasyuEditorBoard = ({
  puzzle,
  pluginId,
  pearlTool,
  onCellPearlChange,
  onCellPearlCycle,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [zoomPercent, setZoomPercent] = useState(100)
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null)
  const dragRef = useRef<DragSession | null>(null)

  const width = useMemo(() => puzzle.cols * CELL_SIZE + PADDING * 2, [puzzle.cols])
  const height = useMemo(() => puzzle.rows * CELL_SIZE + PADDING * 2, [puzzle.rows])
  const zoom = zoomPercent / 100
  const displayWidth = Math.round(width * zoom)
  const displayHeight = Math.round(height * zoom)
  const activeSelectedCellKey =
    selectedCellKey && isCellKeyInPuzzle(selectedCellKey, puzzle) ? selectedCellKey : null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    canvas.width = displayWidth
    canvas.height = displayHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(zoom, zoom)

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = '#64748b'
    ctx.font = '600 12px Inter, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let r = 0; r < puzzle.rows; r += 1) {
      ctx.fillText(`R${r + 1}`, PADDING - 12, PADDING + r * CELL_SIZE + CELL_SIZE / 2)
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    for (let c = 0; c < puzzle.cols; c += 1) {
      ctx.fillText(`C${c + 1}`, PADDING + c * CELL_SIZE + CELL_SIZE / 2, PADDING - 14)
    }

    if (activeSelectedCellKey) {
      const [r, c] = parseCellKey(activeSelectedCellKey)
      ctx.fillStyle = 'rgba(14, 165, 233, 0.18)'
      ctx.fillRect(PADDING + c * CELL_SIZE, PADDING + r * CELL_SIZE, CELL_SIZE, CELL_SIZE)
      ctx.strokeStyle = '#0284c7'
      ctx.lineWidth = 2
      ctx.strokeRect(
        PADDING + c * CELL_SIZE + 2,
        PADDING + r * CELL_SIZE + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4,
      )
    }

    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    for (let r = 0; r <= puzzle.rows; r += 1) {
      ctx.beginPath()
      ctx.moveTo(PADDING, PADDING + r * CELL_SIZE)
      ctx.lineTo(PADDING + puzzle.cols * CELL_SIZE, PADDING + r * CELL_SIZE)
      ctx.stroke()
    }
    for (let c = 0; c <= puzzle.cols; c += 1) {
      ctx.beginPath()
      ctx.moveTo(PADDING + c * CELL_SIZE, PADDING)
      ctx.lineTo(PADDING + c * CELL_SIZE, PADDING + puzzle.rows * CELL_SIZE)
      ctx.stroke()
    }
    ctx.setLineDash([])

    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 3
    ctx.strokeRect(PADDING, PADDING, puzzle.cols * CELL_SIZE, puzzle.rows * CELL_SIZE)

    for (const [key, cell] of Object.entries(puzzle.cells)) {
      if (cell.clue?.kind !== 'pearl') {
        continue
      }
      const [r, c] = parseCellKey(key)
      const centerX = PADDING + c * CELL_SIZE + CELL_SIZE / 2
      const centerY = PADDING + r * CELL_SIZE + CELL_SIZE / 2
      ctx.beginPath()
      ctx.arc(centerX, centerY, CELL_SIZE * 0.28, 0, Math.PI * 2)
      ctx.fillStyle = cell.clue.color === 'black' ? '#111827' : '#ffffff'
      ctx.fill()
      ctx.strokeStyle = '#111827'
      ctx.lineWidth = 2.4
      ctx.stroke()
    }

    ctx.restore()
  }, [activeSelectedCellKey, displayHeight, displayWidth, height, puzzle, width, zoom])

  const pickCellAtClient = (clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current
    if (!canvas) {
      return null
    }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const localX = ((clientX - rect.left) * scaleX) / zoom - PADDING
    const localY = ((clientY - rect.top) * scaleY) / zoom - PADDING
    const col = Math.floor(localX / CELL_SIZE)
    const row = Math.floor(localY / CELL_SIZE)
    if (row < 0 || col < 0 || row >= puzzle.rows || col >= puzzle.cols) {
      return null
    }
    return cellKey(row, col)
  }

  const getPearlMap = (): Map<string, Exclude<MasyuPearlDraft, null>> => {
    const pearls = new Map<string, Exclude<MasyuPearlDraft, null>>()
    for (const [key, cell] of Object.entries(puzzle.cells)) {
      if (cell.clue?.kind === 'pearl') {
        pearls.set(key, cell.clue.color)
      }
    }
    return pearls
  }

  const paintCellInSession = (key: string, session: DragSession): void => {
    if (session.visitedCells.has(key) || session.tool === null) {
      return
    }
    session.visitedCells.add(key)
    const initialColor = session.initialPearls.get(key) ?? null
    onCellPearlChange(key, initialColor === session.tool ? null : session.tool)
    setSelectedCellKey(key)
  }

  const paintCellsAlongPath = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    session: DragSession,
  ): void => {
    const distance = Math.hypot(toX - fromX, toY - fromY)
    const steps = Math.max(1, Math.ceil(distance / CELL_DRAG_SAMPLE_DISTANCE))
    for (let i = 0; i <= steps; i += 1) {
      const ratio = i / steps
      const key = pickCellAtClient(fromX + (toX - fromX) * ratio, fromY + (toY - fromY) * ratio)
      if (key) {
        paintCellInSession(key, session)
      }
    }
  }

  return (
    <section className="board-card editor-board-card">
      <header className="panel-header board-panel-header">
        <h2>
          Editor Board{' '}
          <span className="board-dimensions">
            {puzzle.rows} × {puzzle.cols}
          </span>
          <PuzzleStatsInfoButton pluginId={pluginId} puzzle={puzzle} />
        </h2>
        <div className="board-header-tools">
          <small>{pearlTool ? `Drag to paint ${pearlTool} pearls` : 'Click cells to cycle pearls'}</small>
          <label className="board-zoom-control">
            <span>Board zoom</span>
            <input
              aria-label="Board zoom"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={ZOOM_STEP}
              value={zoomPercent}
              onChange={(event) => setZoomPercent(Number(event.target.value))}
            />
            <output>{zoomPercent}%</output>
          </label>
        </div>
      </header>
      <div className="board-scroll-shell" aria-label="Editor board scroll area">
        <canvas
          ref={canvasRef}
          className="board-canvas editor-board-canvas"
          aria-label="Masyu editor canvas"
          tabIndex={0}
          style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
          onContextMenu={(event) => event.preventDefault()}
          onMouseDown={(event) => {
            if (event.button !== 0) {
              return
            }
            event.preventDefault()
            event.currentTarget.focus()
            const key = pickCellAtClient(event.clientX, event.clientY)
            dragRef.current = {
              mode: pearlTool ? 'paint' : 'cycle',
              startClientX: event.clientX,
              startClientY: event.clientY,
              lastClientX: event.clientX,
              lastClientY: event.clientY,
              visitedCells: new Set(),
              tool: pearlTool,
              initialPearls: getPearlMap(),
            }
            if (key && pearlTool) {
              paintCellInSession(key, dragRef.current)
            }
          }}
          onMouseMove={(event) => {
            const d = dragRef.current
            if (!d || d.mode !== 'paint') {
              return
            }
            event.preventDefault()
            paintCellsAlongPath(d.lastClientX, d.lastClientY, event.clientX, event.clientY, d)
            d.lastClientX = event.clientX
            d.lastClientY = event.clientY
          }}
          onMouseUp={(event) => {
            const d = dragRef.current
            dragRef.current = null
            if (!d || event.button !== 0) {
              return
            }
            if (d.mode === 'paint') {
              paintCellsAlongPath(d.lastClientX, d.lastClientY, event.clientX, event.clientY, d)
              return
            }
            const key = pickCellAtClient(event.clientX, event.clientY)
            if (key) {
              onCellPearlCycle(key)
              setSelectedCellKey(key)
            }
          }}
          onMouseLeave={() => {
            dragRef.current = null
          }}
        />
      </div>
      <p className="board-hint">
        Click a cell to cycle white, black, and empty. Select a pearl tool to paint by dragging.
      </p>
    </section>
  )
}
