import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getCellEdgeKeys,
  getCornerEdgeKeys,
  parseCellKey,
  parseEdgeKey,
  parseSectorKey,
} from '../../domain/ir/keys'
import {
  SECTOR_MASK_ALL,
  sectorMaskAllows,
  sectorMaskIsSingle,
  type SectorCorner,
} from '../../domain/ir/types'
import type { PuzzleIR } from '../../domain/ir/types'

type Props = {
  puzzle: PuzzleIR
  highlightedEdges: string[]
  highlightedCells: string[]
  showVertexNumbers: boolean
}

const CELL_SIZE = 54
const PADDING = 48

const midpoint = (a: [number, number], b: [number, number]): [number, number] => [
  (a[0] + b[0]) / 2,
  (a[1] + b[1]) / 2,
]

const getSectorArcAngles = (corner: SectorCorner): [number, number] => {
  if (corner === 'nw') {
    return [0, Math.PI / 2]
  }
  if (corner === 'ne') {
    return [Math.PI / 2, Math.PI]
  }
  if (corner === 'sw') {
    return [Math.PI * 1.5, Math.PI * 2]
  }
  return [Math.PI, Math.PI * 1.5]
}

export const CanvasBoard = ({
  puzzle,
  highlightedEdges,
  highlightedCells,
  showVertexNumbers,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

  const width = useMemo(() => puzzle.cols * CELL_SIZE + PADDING * 2, [puzzle.cols])
  const height = useMemo(() => puzzle.rows * CELL_SIZE + PADDING * 2, [puzzle.rows])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(offset.x, offset.y)
    ctx.scale(scale, scale)

    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, width, height)

    for (const cell of highlightedCells) {
      const [r, c] = parseCellKey(cell)
      ctx.fillStyle = 'rgba(99, 102, 241, 0.25)'
      ctx.fillRect(PADDING + c * CELL_SIZE, PADDING + r * CELL_SIZE, CELL_SIZE, CELL_SIZE)
    }

    ctx.strokeStyle = '#334155'
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
      ctx.fillStyle = '#f8fafc'
      ctx.font = 'bold 22px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(
        String(cell.clue.value),
        PADDING + c * CELL_SIZE + CELL_SIZE / 2,
        PADDING + r * CELL_SIZE + CELL_SIZE / 2,
      )
    }

    const sectorRadii = {
      notZero: CELL_SIZE * 0.19,
      notOne: CELL_SIZE * 0.24,
      notTwo: CELL_SIZE * 0.29,
      single: CELL_SIZE * 0.34,
    }
    for (const [key, sector] of Object.entries(puzzle.sectors)) {
      const mask = sector.constraintsMask ?? SECTOR_MASK_ALL
      if (mask === SECTOR_MASK_ALL) {
        continue
      }
      const [r, c, corner] = parseSectorKey(key)
      const cornerEdges = getCornerEdgeKeys(r, c, corner)
      const isCornerResolved = cornerEdges.every(
        (edge) => (puzzle.edges[edge]?.mark ?? 'unknown') !== 'unknown',
      )
      if (isCornerResolved) {
        continue
      }
      const baseX = PADDING + c * CELL_SIZE
      const baseY = PADDING + r * CELL_SIZE
      const cornerX = corner === 'ne' || corner === 'se' ? baseX + CELL_SIZE : baseX
      const cornerY = corner === 'sw' || corner === 'se' ? baseY + CELL_SIZE : baseY
      const [start, end] = getSectorArcAngles(corner)

      ctx.save()
      const drawArc = (
        radius: number,
        strokeStyle: string,
        lineWidth: number,
        lineDash: number[] = [],
      ): void => {
        ctx.strokeStyle = strokeStyle
        ctx.lineWidth = lineWidth
        ctx.setLineDash(lineDash)
        ctx.beginPath()
        ctx.arc(cornerX, cornerY, radius, start, end)
        ctx.stroke()
      }

      if (!sectorMaskAllows(mask, 0)) {
        drawArc(sectorRadii.notZero, '#22c55e', 1.8, [4, 3])
      }
      if (!sectorMaskAllows(mask, 1)) {
        drawArc(sectorRadii.notOne, '#3b82f6', 1.8)
      }
      if (!sectorMaskAllows(mask, 2)) {
        drawArc(sectorRadii.notTwo, '#f59e0b', 1.8, [4, 3])
      }

      if (sectorMaskIsSingle(mask)) {
        // Emphasize sectors that have been reduced to a single exact count.
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 2.4
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.arc(cornerX, cornerY, sectorRadii.single, start, end)
        ctx.stroke()
      }
      ctx.restore()
    }

    for (const [edge, state] of Object.entries(puzzle.edges)) {
      const [v1, v2] = parseEdgeKey(edge)
      const x1 = PADDING + v1[1] * CELL_SIZE
      const y1 = PADDING + v1[0] * CELL_SIZE
      const x2 = PADDING + v2[1] * CELL_SIZE
      const y2 = PADDING + v2[0] * CELL_SIZE

      if (state.mark === 'line') {
        ctx.strokeStyle = highlightedEdges.includes(edge) ? '#22d3ee' : '#38bdf8'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      } else if (state.mark === 'blank') {
        const [mx, my] = midpoint([x1, y1], [x2, y2])
        ctx.strokeStyle = highlightedEdges.includes(edge) ? '#f472b6' : '#94a3b8'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(mx - 6, my - 6)
        ctx.lineTo(mx + 6, my + 6)
        ctx.moveTo(mx + 6, my - 6)
        ctx.lineTo(mx - 6, my + 6)
        ctx.stroke()
      }
    }

    ctx.fillStyle = '#f8fafc'
    for (let r = 0; r <= puzzle.rows; r += 1) {
      for (let c = 0; c <= puzzle.cols; c += 1) {
        const vertex = PADDING + c * CELL_SIZE
        const vertY = PADDING + r * CELL_SIZE
        ctx.beginPath()
        ctx.arc(vertex, vertY, 2.3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    if (showVertexNumbers) {
      ctx.fillStyle = '#64748b'
      ctx.font = '10px ui-monospace, monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      for (let r = 0; r <= puzzle.rows; r += 1) {
        for (let c = 0; c <= puzzle.cols; c += 1) {
          ctx.fillText(
            `${r},${c}`,
            PADDING + c * CELL_SIZE + 4,
            PADDING + r * CELL_SIZE + 4,
          )
        }
      }
    }

    ctx.restore()
  }, [height, highlightedCells, highlightedEdges, offset.x, offset.y, puzzle, scale, showVertexNumbers, width])

  const status = useMemo(() => {
    let lineCount = 0
    let blankCount = 0
    let unknownCount = 0
    Object.values(puzzle.edges).forEach((edge) => {
      if (edge.mark === 'line') lineCount += 1
      else if (edge.mark === 'blank') blankCount += 1
      else unknownCount += 1
    })
    return { lineCount, blankCount, unknownCount }
  }, [puzzle.edges])

  return (
    <section className="board-card">
      <header className="panel-header">
        <h2>Puzzle Board</h2>
        <small>
          line {status.lineCount} / blank {status.blankCount} / unknown {status.unknownCount}
        </small>
      </header>
      <canvas
        ref={canvasRef}
        className="board-canvas"
        onWheel={(event) => {
          event.preventDefault()
          setScale((prev) => Math.max(0.5, Math.min(2.5, prev + (event.deltaY < 0 ? 0.1 : -0.1))))
        }}
        onMouseDown={(event) => {
          setDragging(true)
          dragStart.current = { x: event.clientX - offset.x, y: event.clientY - offset.y }
        }}
        onMouseMove={(event) => {
          if (!dragging) return
          setOffset({
            x: event.clientX - dragStart.current.x,
            y: event.clientY - dragStart.current.y,
          })
        }}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
      />
      <p className="board-hint">
        Scroll to zoom, drag to pan. Highlight syncs with selected reasoning steps.
      </p>
      <details>
        <summary>Cell to edge mapping helper</summary>
        <pre>
          {Object.keys(puzzle.cells)
            .slice(0, 5)
            .map((key) => {
              const [r, c] = parseCellKey(key)
              return `${key} -> ${getCellEdgeKeys(r, c).join(' | ')}`
            })
            .join('\n')}
        </pre>
      </details>
    </section>
  )
}
