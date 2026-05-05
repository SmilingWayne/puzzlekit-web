import { useEffect, useMemo, useRef, useState } from 'react'
import { cellKey, edgeKey, parseCellKey, parseEdgeKey } from '../../domain/ir/keys'
import type { PuzzleIR } from '../../domain/ir/types'
import type { EditorTool } from './editorStore'

type Props = {
  puzzle: PuzzleIR
  tool: EditorTool
  onCellApply: (key: string) => void
  onEdgeApply: (key: string) => void
}

const CELL_SIZE = 64
const PADDING = 48
const EDGE_HIT_RADIUS = 9
const MIN_ZOOM = 10
const MAX_ZOOM = 200
const ZOOM_STEP = 10

type PickTarget =
  | { kind: 'cell'; key: string }
  | { kind: 'edge'; key: string }
  | null

const midpoint = (a: [number, number], b: [number, number]): [number, number] => [
  (a[0] + b[0]) / 2,
  (a[1] + b[1]) / 2,
]

const shouldPreferEdge = (tool: EditorTool): boolean => tool === 'line' || tool === 'blank' || tool === 'erase'

export const SlitherlinkEditorBoard = ({ puzzle, tool, onCellApply, onEdgeApply }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [zoomPercent, setZoomPercent] = useState(100)
  const dragRef = useRef<{
    startClientX: number
    startClientY: number
  } | null>(null)

  const width = useMemo(() => puzzle.cols * CELL_SIZE + PADDING * 2, [puzzle.cols])
  const height = useMemo(() => puzzle.rows * CELL_SIZE + PADDING * 2, [puzzle.rows])
  const zoom = zoomPercent / 100
  const displayWidth = Math.round(width * zoom)
  const displayHeight = Math.round(height * zoom)

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

    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1
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

    for (const [key, cell] of Object.entries(puzzle.cells)) {
      if (cell.clue?.kind !== 'number') {
        continue
      }
      const [r, c] = parseCellKey(key)
      ctx.fillStyle = '#111827'
      ctx.font = 'bold 26px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        String(cell.clue.value),
        PADDING + c * CELL_SIZE + CELL_SIZE / 2,
        PADDING + r * CELL_SIZE + CELL_SIZE / 2,
      )
    }

    for (const [edge, state] of Object.entries(puzzle.edges)) {
      const [v1, v2] = parseEdgeKey(edge)
      const x1 = PADDING + v1[1] * CELL_SIZE
      const y1 = PADDING + v1[0] * CELL_SIZE
      const x2 = PADDING + v2[1] * CELL_SIZE
      const y2 = PADDING + v2[0] * CELL_SIZE

      if (state.mark === 'line') {
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      } else if (state.mark === 'blank') {
        const [mx, my] = midpoint([x1, y1], [x2, y2])
        ctx.strokeStyle = '#f472b6'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(mx - 6, my - 6)
        ctx.lineTo(mx + 6, my + 6)
        ctx.moveTo(mx + 6, my - 6)
        ctx.lineTo(mx - 6, my + 6)
        ctx.stroke()
      }
    }

    ctx.fillStyle = '#111827'
    for (let r = 0; r <= puzzle.rows; r += 1) {
      for (let c = 0; c <= puzzle.cols; c += 1) {
        ctx.beginPath()
        ctx.arc(PADDING + c * CELL_SIZE, PADDING + r * CELL_SIZE, 2.3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.restore()
  }, [displayHeight, displayWidth, height, puzzle, width, zoom])

  const pickTargetAtClient = (clientX: number, clientY: number): PickTarget => {
    const canvas = canvasRef.current
    if (!canvas) {
      return null
    }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const mx = (clientX - rect.left) * scaleX
    const my = (clientY - rect.top) * scaleY
    const gx = mx / zoom
    const gy = my / zoom
    const localX = gx - PADDING
    const localY = gy - PADDING

    const horizontalRow = Math.round(localY / CELL_SIZE)
    const horizontalCol = Math.floor(localX / CELL_SIZE)
    const horizontalDistance = Math.abs(localY - horizontalRow * CELL_SIZE)
    const horizontal =
      horizontalDistance <= EDGE_HIT_RADIUS &&
      horizontalRow >= 0 &&
      horizontalRow <= puzzle.rows &&
      horizontalCol >= 0 &&
      horizontalCol < puzzle.cols
        ? edgeKey([horizontalRow, horizontalCol], [horizontalRow, horizontalCol + 1])
        : null

    const verticalCol = Math.round(localX / CELL_SIZE)
    const verticalRow = Math.floor(localY / CELL_SIZE)
    const verticalDistance = Math.abs(localX - verticalCol * CELL_SIZE)
    const vertical =
      verticalDistance <= EDGE_HIT_RADIUS &&
      verticalRow >= 0 &&
      verticalRow < puzzle.rows &&
      verticalCol >= 0 &&
      verticalCol <= puzzle.cols
        ? edgeKey([verticalRow, verticalCol], [verticalRow + 1, verticalCol])
        : null

    if (shouldPreferEdge(tool)) {
      if (horizontal && (!vertical || horizontalDistance <= verticalDistance)) {
        return { kind: 'edge', key: horizontal }
      }
      if (vertical) {
        return { kind: 'edge', key: vertical }
      }
    }

    const col = Math.floor(localX / CELL_SIZE)
    const row = Math.floor(localY / CELL_SIZE)
    if (row >= 0 && col >= 0 && row < puzzle.rows && col < puzzle.cols) {
      return { kind: 'cell', key: cellKey(row, col) }
    }

    if (horizontal && (!vertical || horizontalDistance <= verticalDistance)) {
      return { kind: 'edge', key: horizontal }
    }
    if (vertical) {
      return { kind: 'edge', key: vertical }
    }
    return null
  }

  return (
    <section className="board-card editor-board-card">
      <header className="panel-header board-panel-header">
        <h2>
          Editor Board{' '}
          <span className="board-dimensions">
            {puzzle.rows} × {puzzle.cols}
          </span>
        </h2>
        <div className="board-header-tools">
          <small>{tool} tool</small>
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
          aria-label="Slitherlink editor canvas"
          style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
          onMouseDown={(event) => {
            dragRef.current = {
              startClientX: event.clientX,
              startClientY: event.clientY,
            }
          }}
          onMouseUp={(event) => {
            const d = dragRef.current
            dragRef.current = null
            if (!d) {
              return
            }
            const dist = Math.hypot(event.clientX - d.startClientX, event.clientY - d.startClientY)
            if (dist > 5) {
              return
            }
            const target = pickTargetAtClient(event.clientX, event.clientY)
            if (target?.kind === 'cell') {
              onCellApply(target.key)
            } else if (target?.kind === 'edge') {
              onEdgeApply(target.key)
            }
          }}
          onMouseLeave={() => {
            dragRef.current = null
          }}
        />
      </div>
      <p className="board-hint">
        Use the slider to zoom. Scroll to move around large grids. Click cells or edges with the
        active tool.
      </p>
    </section>
  )
}
