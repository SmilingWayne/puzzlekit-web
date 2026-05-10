import { useEffect, useMemo, useRef, useState } from 'react'
import { puzzleRegistry } from '../../domain/plugins/registry'
import type {
  PuzzleHelpExampleEdge,
  PuzzleLegendExample,
  PuzzleLegendSectorMarker,
} from '../../domain/plugins/types'

type Props = {
  pluginId: string
}

const LEGEND_WIDTH = 132
const LEGEND_HEIGHT = 112
const LEGEND_PADDING = 16

const edgeKey = (edge: PuzzleHelpExampleEdge['edge']): string => {
  const [a, b] = edge
  return `${a[0]},${a[1]}-${b[0]},${b[1]}`
}

const getSectorArcAngles = (corner: PuzzleLegendSectorMarker['corner']): [number, number] => {
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

const getSectorStyle = (
  kind: PuzzleLegendSectorMarker['kind'],
): { color: string; dash: number[]; lineWidth: number; radiusScale: number } => {
  if (kind === 'onlyOne') {
    return { color: '#ef4444', dash: [], lineWidth: 2.4, radiusScale: 0.34 }
  }
  if (kind === 'notOne') {
    return { color: '#3b82f6', dash: [], lineWidth: 2, radiusScale: 0.24 }
  }
  if (kind === 'notZero') {
    return { color: '#22c55e', dash: [4, 3], lineWidth: 2, radiusScale: 0.19 }
  }
  return { color: '#f59e0b', dash: [4, 3], lineWidth: 2, radiusScale: 0.29 }
}

const BoardLegendCanvas = ({ example, label }: { example: PuzzleLegendExample; label: string }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const edgeMarks = useMemo(
    () => new Map((example.edges ?? []).map((edge) => [edgeKey(edge.edge), edge.mark])),
    [example.edges],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      return
    }

    canvas.width = LEGEND_WIDTH
    canvas.height = LEGEND_HEIGHT
    const boardWidth = LEGEND_WIDTH - LEGEND_PADDING * 2
    const boardHeight = LEGEND_HEIGHT - LEGEND_PADDING * 2
    const cellSize = Math.min(boardWidth / example.cols, boardHeight / example.rows)
    const gridWidth = cellSize * example.cols
    const gridHeight = cellSize * example.rows
    const offsetX = (LEGEND_WIDTH - gridWidth) / 2
    const offsetY = (LEGEND_HEIGHT - gridHeight) / 2

    ctx.clearRect(0, 0, LEGEND_WIDTH, LEGEND_HEIGHT)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, LEGEND_WIDTH, LEGEND_HEIGHT)

    for (const cell of example.filledCells ?? []) {
      ctx.fillStyle =
        cell.fill === 'green' ? 'rgba(34, 197, 94, 0.24)' : 'rgba(245, 158, 11, 0.24)'
      ctx.fillRect(offsetX + cell.col * cellSize, offsetY + cell.row * cellSize, cellSize, cellSize)
    }

    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1
    ctx.setLineDash([])
    for (let row = 0; row <= example.rows; row += 1) {
      const y = offsetY + row * cellSize
      ctx.beginPath()
      ctx.moveTo(offsetX, y)
      ctx.lineTo(offsetX + gridWidth, y)
      ctx.stroke()
    }
    for (let col = 0; col <= example.cols; col += 1) {
      const x = offsetX + col * cellSize
      ctx.beginPath()
      ctx.moveTo(x, offsetY)
      ctx.lineTo(x, offsetY + gridHeight)
      ctx.stroke()
    }

    for (const marker of example.sectors ?? []) {
      const baseX = offsetX + marker.col * cellSize
      const baseY = offsetY + marker.row * cellSize
      const cornerX = marker.corner === 'ne' || marker.corner === 'se' ? baseX + cellSize : baseX
      const cornerY = marker.corner === 'sw' || marker.corner === 'se' ? baseY + cellSize : baseY
      const [start, end] = getSectorArcAngles(marker.corner)
      const style = getSectorStyle(marker.kind)

      ctx.strokeStyle = style.color
      ctx.lineWidth = style.lineWidth
      ctx.setLineDash(style.dash)
      ctx.beginPath()
      ctx.arc(cornerX, cornerY, cellSize * style.radiusScale, start, end)
      ctx.stroke()
    }
    ctx.setLineDash([])

    for (const [key, mark] of edgeMarks) {
      const [start, end] = key.split('-')
      const [rowA, colA] = start.split(',').map(Number)
      const [rowB, colB] = end.split(',').map(Number)
      const x1 = offsetX + colA * cellSize
      const y1 = offsetY + rowA * cellSize
      const x2 = offsetX + colB * cellSize
      const y2 = offsetY + rowB * cellSize

      if (mark === 'line') {
        ctx.strokeStyle = '#0284c7'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      } else {
        const midX = (x1 + x2) / 2
        const midY = (y1 + y2) / 2
        const crossSize = 4
        ctx.strokeStyle = '#94a3b8'
        ctx.lineWidth = 1.8
        ctx.beginPath()
        ctx.moveTo(midX - crossSize, midY - crossSize)
        ctx.lineTo(midX + crossSize, midY + crossSize)
        ctx.moveTo(midX + crossSize, midY - crossSize)
        ctx.lineTo(midX - crossSize, midY + crossSize)
        ctx.stroke()
      }
    }

    ctx.fillStyle = '#111827'
    ctx.font = `700 ${Math.max(13, cellSize * 0.42)}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const clue of example.clues ?? []) {
      ctx.fillText(
        String(clue.value),
        offsetX + clue.col * cellSize + cellSize / 2,
        offsetY + clue.row * cellSize + cellSize / 2,
      )
    }

    ctx.fillStyle = '#111827'
    for (let row = 0; row <= example.rows; row += 1) {
      for (let col = 0; col <= example.cols; col += 1) {
        ctx.beginPath()
        ctx.arc(offsetX + col * cellSize, offsetY + row * cellSize, 1.7, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [edgeMarks, example])

  return <canvas ref={canvasRef} width={LEGEND_WIDTH} height={LEGEND_HEIGHT} aria-label={`${label} legend canvas`} />
}

export const BoardLegendButton = ({ pluginId }: Props) => {
  const [openPluginId, setOpenPluginId] = useState<string | null>(null)
  const plugin = puzzleRegistry.get(pluginId)
  const legend = plugin?.legend
  const isOpen = openPluginId === pluginId
  const titleId = `${pluginId}-board-legend-title`

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenPluginId(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (!plugin || !legend) {
    return null
  }

  return (
    <div className="board-legend-anchor">
      <button
        type="button"
        className="puzzle-info-button board-legend-button"
        aria-label={`Show ${plugin.displayName} legend`}
        aria-expanded={isOpen}
        data-active={isOpen}
        onClick={() => setOpenPluginId((current) => (current === pluginId ? null : pluginId))}
      >
        i
      </button>
      {isOpen ? (
        <section
          className="board-legend-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <header className="puzzle-info-panel-header">
            <h2 id={titleId}>{legend.title}</h2>
            <button
              type="button"
              className="panel-icon-close"
              aria-label={`Close ${plugin.displayName} legend`}
              onClick={() => setOpenPluginId(null)}
            >
              ×
            </button>
          </header>
          <div className="board-legend-list">
            {legend.items.map((item) => (
              <article key={item.label} className="board-legend-item">
                <BoardLegendCanvas example={item.example} label={item.label} />
                <div>
                  <h3>{item.label}</h3>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
