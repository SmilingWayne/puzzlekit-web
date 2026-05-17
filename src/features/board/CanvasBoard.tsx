import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getCellEdgeKeys,
  getCornerEdgeKeys,
  parseCellKey,
  parseEdgeKey,
  parseLineKey,
  parseSectorKey,
  parseTileKey,
} from '../../domain/ir/keys'
import {
  SECTOR_MASK_ALL,
  SECTOR_MASK_ONLY_1,
  sectorMaskAllows,
  type SectorCorner,
} from '../../domain/ir/types'
import type { PuzzleIR } from '../../domain/ir/types'
import { PuzzleStatsInfoButton } from '../puzzleStats/PuzzleStatsInfoButton'

type Props = {
  puzzle: PuzzleIR
  pluginId: string
  highlightedEdges: string[]
  highlightedLines?: string[]
  highlightedCells: string[]
  highlightedColorCells: string[]
  highlightedColorTiles?: string[]
  showVertexNumbers: boolean
}

const CELL_SIZE = 52
const PADDING = 48
const MIN_ZOOM = 20
const MAX_ZOOM = 200
const ZOOM_STEP = 5

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

const drawDecisionMark = (
  ctx: CanvasRenderingContext2D,
  mark: 'unknown' | 'line' | 'blank',
  highlighted: boolean,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void => {
  if (mark === 'line') {
    ctx.strokeStyle = highlighted ? '#22d3ee' : '#38bdf8'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    return
  }
  if (mark === 'blank') {
    const [mx, my] = midpoint([x1, y1], [x2, y2])
    ctx.strokeStyle = highlighted ? '#f472b6' : '#94a3b8'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(mx - 6, my - 6)
    ctx.lineTo(mx + 6, my + 6)
    ctx.moveTo(mx + 6, my - 6)
    ctx.lineTo(mx - 6, my + 6)
    ctx.stroke()
  }
}

const getColorFillStyle = (fill: string | undefined, alpha: number): string | null => {
  if (fill === 'green') {
    return `rgba(34, 197, 94, ${alpha})`
  }
  if (fill === 'yellow') {
    return `rgba(245, 158, 11, ${alpha})`
  }
  return null
}

export const CanvasBoard = ({
  puzzle,
  pluginId,
  highlightedEdges,
  highlightedLines = [],
  highlightedCells,
  highlightedColorCells,
  highlightedColorTiles = [],
  showVertexNumbers,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [zoomPercent, setZoomPercent] = useState(100)

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
    const isMasyu = puzzle.puzzleType === 'masyu'

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

    if (!isMasyu) {
      for (const [key, cell] of Object.entries(puzzle.cells)) {
        const fill = cell.fill
        const fillStyle = getColorFillStyle(fill, 0.24)
        if (!fillStyle) {
          continue
        }
        const [r, c] = parseCellKey(key)
        ctx.fillStyle = fillStyle
        ctx.fillRect(PADDING + c * CELL_SIZE, PADDING + r * CELL_SIZE, CELL_SIZE, CELL_SIZE)
      }
    } else {
      const tileSize = CELL_SIZE
      for (const [key, tile] of Object.entries(puzzle.tiles ?? {})) {
        const fillStyle = getColorFillStyle(tile.fill, 0.24)
        if (!fillStyle) {
          continue
        }
        const [r, c] = parseTileKey(key)
        ctx.fillStyle = fillStyle
        ctx.fillRect(
          PADDING + c * CELL_SIZE - tileSize / 2,
          PADDING + r * CELL_SIZE - tileSize / 2,
          tileSize,
          tileSize,
        )
      }
    }

    for (const cell of highlightedCells) {
      const [r, c] = parseCellKey(cell)
      ctx.fillStyle = 'rgba(99, 102, 241, 0.25)'
      ctx.fillRect(PADDING + c * CELL_SIZE, PADDING + r * CELL_SIZE, CELL_SIZE, CELL_SIZE)
    }

    if (!isMasyu) {
      for (const cell of highlightedColorCells) {
        const fill = puzzle.cells[cell]?.fill
        const [r, c] = parseCellKey(cell)
        ctx.fillStyle = getColorFillStyle(fill, 0.44) ?? 'rgba(99, 102, 241, 0.2)'
        ctx.fillRect(PADDING + c * CELL_SIZE, PADDING + r * CELL_SIZE, CELL_SIZE, CELL_SIZE)
      }
    } else {
      const tileSize = CELL_SIZE
      for (const tile of highlightedColorTiles) {
        const fill = puzzle.tiles[tile]?.fill
        const [r, c] = parseTileKey(tile)
        ctx.fillStyle = getColorFillStyle(fill, 0.44) ?? 'rgba(99, 102, 241, 0.2)'
        ctx.fillRect(
          PADDING + c * CELL_SIZE - tileSize / 2,
          PADDING + r * CELL_SIZE - tileSize / 2,
          tileSize,
          tileSize,
        )
      }
    }

    ctx.strokeStyle = isMasyu ? '#94a3b8' : '#cbd5e1'
    ctx.lineWidth = 1
    ctx.setLineDash(isMasyu ? [4, 4] : [])
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

    if (isMasyu) {
      ctx.strokeStyle = '#111827'
      ctx.lineWidth = 3
      ctx.strokeRect(PADDING, PADDING, puzzle.cols * CELL_SIZE, puzzle.rows * CELL_SIZE)
    }

    for (const [key, cell] of Object.entries(puzzle.cells)) {
      if (isMasyu && cell.clue?.kind !== 'pearl') {
        continue
      }
      if (!isMasyu && cell.clue?.kind !== 'number') {
        continue
      }
      const [r, c] = parseCellKey(key)
      const centerX = PADDING + c * CELL_SIZE + CELL_SIZE / 2
      const centerY = PADDING + r * CELL_SIZE + CELL_SIZE / 2
      if (cell.clue?.kind === 'pearl') {
        const radius = CELL_SIZE * 0.28
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
        ctx.fillStyle = cell.clue.color === 'black' ? '#111827' : '#ffffff'
        ctx.fill()
        ctx.strokeStyle = '#111827'
        ctx.lineWidth = 2.4
        ctx.stroke()
      } else if (cell.clue?.kind === 'number') {
        ctx.fillStyle = '#111827'
        ctx.font = 'bold 26px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(cell.clue.value), centerX, centerY)
      }
    }

    if (!isMasyu) {
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

      if (mask === SECTOR_MASK_ONLY_1) {
        drawArc(sectorRadii.single, '#ef4444', 2.4)
      }
      ctx.restore()
    }
    }

    if (isMasyu) {
      for (const [line, state] of Object.entries(puzzle.lines ?? {})) {
        const [v1, v2] = parseLineKey(line)
        const x1 = PADDING + v1[1] * CELL_SIZE + CELL_SIZE / 2
        const y1 = PADDING + v1[0] * CELL_SIZE + CELL_SIZE / 2
        const x2 = PADDING + v2[1] * CELL_SIZE + CELL_SIZE / 2
        const y2 = PADDING + v2[0] * CELL_SIZE + CELL_SIZE / 2
        drawDecisionMark(ctx, state.mark, highlightedLines.includes(line), x1, y1, x2, y2)
      }
    } else {
      for (const [edge, state] of Object.entries(puzzle.edges)) {
        const [v1, v2] = parseEdgeKey(edge)
        const x1 = PADDING + v1[1] * CELL_SIZE
        const y1 = PADDING + v1[0] * CELL_SIZE
        const x2 = PADDING + v2[1] * CELL_SIZE
        const y2 = PADDING + v2[0] * CELL_SIZE
        drawDecisionMark(ctx, state.mark, highlightedEdges.includes(edge), x1, y1, x2, y2)
      }
    }

    if (!isMasyu) {
    ctx.fillStyle = '#111827'
    for (let r = 0; r <= puzzle.rows; r += 1) {
      for (let c = 0; c <= puzzle.cols; c += 1) {
        const vertex = PADDING + c * CELL_SIZE
        const vertY = PADDING + r * CELL_SIZE
        ctx.beginPath()
        ctx.arc(vertex, vertY, 2.3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    }

    if (showVertexNumbers && !isMasyu) {
      ctx.fillStyle = '#64748b'
      ctx.font = '12px ui-monospace, monospace'
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
  }, [
    displayHeight,
    displayWidth,
    height,
    highlightedCells,
    highlightedColorCells,
    highlightedColorTiles,
    highlightedEdges,
    highlightedLines,
    puzzle,
    showVertexNumbers,
    width,
    zoom,
  ])

  const status = useMemo(() => {
    let lineCount = 0
    let blankCount = 0
    let unknownCount = 0
    const decisions = puzzle.puzzleType === 'masyu' ? Object.values(puzzle.lines ?? {}) : Object.values(puzzle.edges)
    decisions.forEach((decision) => {
      if (decision.mark === 'line') lineCount += 1
      else if (decision.mark === 'blank') blankCount += 1
      else unknownCount += 1
    })
    return { lineCount, blankCount, unknownCount }
  }, [puzzle.edges, puzzle.lines, puzzle.puzzleType])

  return (
    <section className="board-card">
      <header className="panel-header board-panel-header">
        <h2>
          Puzzle Board{' '}
          <span className="board-dimensions">
            {puzzle.rows} × {puzzle.cols}
          </span>
          <PuzzleStatsInfoButton pluginId={pluginId} puzzle={puzzle} />
        </h2>
        <div className="board-header-tools">
          <small>
            line {status.lineCount} / blank {status.blankCount} / unknown {status.unknownCount}
          </small>
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
      <div className="board-scroll-shell" aria-label="Solver board scroll area">
        <canvas
          ref={canvasRef}
          className="board-canvas scroll-board-canvas"
          aria-label={`${puzzle.puzzleType === 'masyu' ? 'Masyu' : 'Slitherlink'} solver canvas`}
          style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
        />
      </div>
      <p className="board-hint">
        Use the slider to zoom. Scroll to move around large grids. Highlight syncs with reasoning
        steps.
      </p>
      {puzzle.puzzleType !== 'masyu' ? (
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
      ) : null}
    </section>
  )
}
