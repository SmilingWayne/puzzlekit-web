import { useEffect, useMemo, useRef, useState } from 'react'
import { cellKey, edgeKey, parseCellKey, parseEdgeKey } from '../../domain/ir/keys'
import type { EdgeMark, NumberClueValue, PuzzleIR } from '../../domain/ir/types'
import type { SlitherClueDraft } from './editorStore'

type Props = {
  puzzle: PuzzleIR
  onCellClueChange: (key: string, value: SlitherClueDraft) => void
  onEdgeMarkChange: (key: string, mark: EdgeMark) => void
}

const CELL_SIZE = 52
const PADDING = 48
const EDGE_HIT_RADIUS = 5
const EDGE_CLICK_HIT_RADIUS = 4
const EDGE_DRAG_START_DISTANCE = 6
const MIN_ZOOM = 10
const MAX_ZOOM = 200
const ZOOM_STEP = 5

type EdgeOrientation = 'horizontal' | 'vertical'
type EdgeTarget = { kind: 'edge'; key: string; orientation: EdgeOrientation }

type PickTarget =
  | { kind: 'cell'; key: string }
  | EdgeTarget
  | null

type DragMode = 'line' | 'blank'

type DragSession = {
  mode: DragMode
  startClientX: number
  startClientY: number
  lastClientX: number
  lastClientY: number
  startEdge: EdgeTarget | null
  active: boolean
  visitedEdges: Set<string>
}

const midpoint = (a: [number, number], b: [number, number]): [number, number] => [
  (a[0] + b[0]) / 2,
  (a[1] + b[1]) / 2,
]

const clueFromKey = (key: string): NumberClueValue | null => {
  if (key === '?') {
    return '?'
  }
  if (/^[0-3]$/.test(key)) {
    return Number(key)
  }
  return null
}

const isCellKeyInPuzzle = (key: string, puzzle: PuzzleIR): boolean => {
  const [row, col] = parseCellKey(key)
  return row >= 0 && col >= 0 && row < puzzle.rows && col < puzzle.cols
}

export const SlitherlinkEditorBoard = ({
  puzzle,
  onCellClueChange,
  onEdgeMarkChange,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const puzzleRef = useRef(puzzle)
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
    puzzleRef.current = puzzle
  }, [puzzle])

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
  }, [activeSelectedCellKey, displayHeight, displayWidth, height, puzzle, width, zoom])

  const getLocalPointAtClient = (
    clientX: number,
    clientY: number,
  ): { localX: number; localY: number } | null => {
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
    return {
      localX: gx - PADDING,
      localY: gy - PADDING,
    }
  }

  const pickEdgeAtClient = (
    clientX: number,
    clientY: number,
    preferredOrientation?: EdgeOrientation,
    hitRadius = EDGE_HIT_RADIUS,
  ): PickTarget => {
    const point = getLocalPointAtClient(clientX, clientY)
    if (!point) {
      return null
    }
    const { localX, localY } = point

    const horizontalRow = Math.round(localY / CELL_SIZE)
    const horizontalCol = Math.floor(localX / CELL_SIZE)
    const horizontalDistance = Math.abs(localY - horizontalRow * CELL_SIZE)
    const horizontal: EdgeTarget | null =
      horizontalDistance <= hitRadius &&
      horizontalRow >= 0 &&
      horizontalRow <= puzzle.rows &&
      horizontalCol >= 0 &&
      horizontalCol < puzzle.cols
        ? {
            kind: 'edge',
            key: edgeKey([horizontalRow, horizontalCol], [horizontalRow, horizontalCol + 1]),
            orientation: 'horizontal' as const,
          }
        : null

    const verticalCol = Math.round(localX / CELL_SIZE)
    const verticalRow = Math.floor(localY / CELL_SIZE)
    const verticalDistance = Math.abs(localX - verticalCol * CELL_SIZE)
    const vertical: EdgeTarget | null =
      verticalDistance <= hitRadius &&
      verticalRow >= 0 &&
      verticalRow < puzzle.rows &&
      verticalCol >= 0 &&
      verticalCol <= puzzle.cols
        ? {
            kind: 'edge',
            key: edgeKey([verticalRow, verticalCol], [verticalRow + 1, verticalCol]),
            orientation: 'vertical' as const,
          }
        : null

    if (preferredOrientation === 'horizontal') {
      return horizontal
    }
    if (preferredOrientation === 'vertical') {
      return vertical
    }

    if (horizontal && (!vertical || horizontalDistance <= verticalDistance)) {
      return horizontal
    }
    if (vertical) {
      return vertical
    }
    return null
  }

  const getPreferredOrientation = (dx: number, dy: number): EdgeOrientation | undefined => {
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    if (absX > absY * 1.25) {
      return 'horizontal'
    }
    if (absY > absX * 1.25) {
      return 'vertical'
    }
    return undefined
  }

  const pickTargetAtClient = (clientX: number, clientY: number): PickTarget => {
    const point = getLocalPointAtClient(clientX, clientY)
    if (!point) {
      return null
    }
    const { localX, localY } = point
    const col = Math.floor(localX / CELL_SIZE)
    const row = Math.floor(localY / CELL_SIZE)
    if (row >= 0 && col >= 0 && row < puzzle.rows && col < puzzle.cols) {
      return { kind: 'cell', key: cellKey(row, col) }
    }

    return pickEdgeAtClient(clientX, clientY)
  }

  const applyEdgeInSession = (edge: string, session: DragSession): void => {
    if (session.visitedEdges.has(edge)) {
      return
    }
    session.visitedEdges.add(edge)
    if (session.mode === 'blank') {
      onEdgeMarkChange(edge, 'blank')
      return
    }
    const currentMark = puzzleRef.current.edges[edge]?.mark ?? 'unknown'
    onEdgeMarkChange(edge, currentMark === 'line' ? 'unknown' : 'line')
  }

  const applyEdgesAlongPath = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    session: DragSession,
  ): void => {
    const distance = Math.hypot(toX - fromX, toY - fromY)
    const steps = Math.max(1, Math.ceil(distance / EDGE_HIT_RADIUS))
    const preferredOrientation = getPreferredOrientation(toX - fromX, toY - fromY)
    const nudgeX = distance > 0 ? ((toX - fromX) / distance) * 0.75 : 0
    const nudgeY = distance > 0 ? ((toY - fromY) / distance) * 0.75 : 0
    for (let i = 0; i <= steps; i += 1) {
      const ratio = i / steps
      const sampleX = fromX + (toX - fromX) * ratio
      const sampleY = fromY + (toY - fromY) * ratio
      const endpointDirection = i === 0 ? 1 : -1
      const target = pickEdgeAtClient(
        sampleX + nudgeX * endpointDirection,
        sampleY + nudgeY * endpointDirection,
        preferredOrientation,
      )
      if (target?.kind === 'edge') {
        applyEdgeInSession(target.key, session)
      }
    }
  }

  const activateDragSession = (
    session: DragSession,
    currentClientX: number,
    currentClientY: number,
  ): void => {
    if (!session.startEdge) {
      return
    }
    session.active = true
    session.lastClientX = session.startClientX
    session.lastClientY = session.startClientY
    applyEdgesAlongPath(
      session.startClientX,
      session.startClientY,
      currentClientX,
      currentClientY,
      session,
    )
    session.lastClientX = currentClientX
    session.lastClientY = currentClientY
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
          <small>Click cells, type clues, drag edges</small>
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
          tabIndex={0}
          style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (!activeSelectedCellKey) {
              return
            }
            if (event.key === 'Backspace' || event.key === 'Delete') {
              event.preventDefault()
              onCellClueChange(activeSelectedCellKey, null)
              return
            }
            const clue = clueFromKey(event.key)
            if (clue !== null) {
              event.preventDefault()
              onCellClueChange(activeSelectedCellKey, clue)
            }
          }}
          onMouseDown={(event) => {
            if (event.button !== 0 && event.button !== 2) {
              return
            }
            event.preventDefault()
            event.currentTarget.focus()
            dragRef.current = {
              mode: event.button === 2 ? 'blank' : 'line',
              startClientX: event.clientX,
              startClientY: event.clientY,
              lastClientX: event.clientX,
              lastClientY: event.clientY,
              startEdge: pickEdgeAtClient(event.clientX, event.clientY) as EdgeTarget | null,
              active: false,
              visitedEdges: new Set(),
            }
          }}
          onMouseMove={(event) => {
            const d = dragRef.current
            if (!d) {
              return
            }
            event.preventDefault()
            const dragDistance = Math.hypot(
              event.clientX - d.startClientX,
              event.clientY - d.startClientY,
            )
            if (!d.active) {
              if (dragDistance < EDGE_DRAG_START_DISTANCE) {
                return
              }
              activateDragSession(d, event.clientX, event.clientY)
              return
            }
            applyEdgesAlongPath(d.lastClientX, d.lastClientY, event.clientX, event.clientY, d)
            d.lastClientX = event.clientX
            d.lastClientY = event.clientY
          }}
          onMouseUp={(event) => {
            const d = dragRef.current
            dragRef.current = null
            if (!d) {
              return
            }
            const dist = Math.hypot(event.clientX - d.startClientX, event.clientY - d.startClientY)
            if (d.active) {
              applyEdgesAlongPath(d.lastClientX, d.lastClientY, event.clientX, event.clientY, d)
              return
            }
            if (dist > EDGE_DRAG_START_DISTANCE) {
              return
            }
            if (d.mode === 'blank') {
              const target = pickEdgeAtClient(event.clientX, event.clientY, undefined, EDGE_CLICK_HIT_RADIUS)
              if (target?.kind === 'edge') {
                onEdgeMarkChange(target.key, 'blank')
              }
              return
            }
            if (d.mode !== 'line') {
              return
            }
            const target = pickTargetAtClient(event.clientX, event.clientY)
            if (target?.kind === 'cell') {
              setSelectedCellKey(target.key)
            }
          }}
          onMouseLeave={() => {
            dragRef.current = null
          }}
        />
      </div>
      <p className="board-hint">
        Click a cell and type 0-3 or ?. Delete and Backspace clear clues. Drag with left mouse for
        lines, right mouse for crosses.
      </p>
    </section>
  )
}
