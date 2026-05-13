import { useEffect, useMemo, useRef, useState } from 'react'
import { puzzleRegistry } from '../../domain/plugins/registry'
import type { PuzzleHelpExample, PuzzleHelpExampleEdge } from '../../domain/plugins/types'

type Props = {
  pluginId: string
}

const EXAMPLE_WIDTH = 142
const EXAMPLE_HEIGHT = 116
const EXAMPLE_PADDING = 18

const edgeKey = (edge: PuzzleHelpExampleEdge['edge']): string => {
  const [a, b] = edge
  return `${a[0]},${a[1]}-${b[0]},${b[1]}`
}

const PuzzleInfoExampleCanvas = ({ example }: { example: PuzzleHelpExample }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const edgeMarks = useMemo(
    () => new Map(example.edges.map((edge) => [edgeKey(edge.edge), edge.mark])),
    [example.edges],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      return
    }

    canvas.width = EXAMPLE_WIDTH
    canvas.height = EXAMPLE_HEIGHT
    const boardWidth = EXAMPLE_WIDTH - EXAMPLE_PADDING * 2
    const boardHeight = EXAMPLE_HEIGHT - EXAMPLE_PADDING * 2
    const cellSize = Math.min(boardWidth / example.cols, boardHeight / example.rows)
    const gridWidth = cellSize * example.cols
    const gridHeight = cellSize * example.rows
    const offsetX = (EXAMPLE_WIDTH - gridWidth) / 2
    const offsetY = (EXAMPLE_HEIGHT - gridHeight) / 2

    ctx.clearRect(0, 0, EXAMPLE_WIDTH, EXAMPLE_HEIGHT)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, EXAMPLE_WIDTH, EXAMPLE_HEIGHT)

    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1
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
        ctx.lineWidth = 1.7
        ctx.beginPath()
        ctx.moveTo(midX - crossSize, midY - crossSize)
        ctx.lineTo(midX + crossSize, midY + crossSize)
        ctx.moveTo(midX + crossSize, midY - crossSize)
        ctx.lineTo(midX - crossSize, midY + crossSize)
        ctx.stroke()
      }
    }

    ctx.fillStyle = '#111827'
    ctx.font = `700 ${Math.max(14, cellSize * 0.48)}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const clue of example.clues) {
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
        ctx.arc(offsetX + col * cellSize, offsetY + row * cellSize, 1.8, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [edgeMarks, example])

  return (
    <figure className="puzzle-info-example-card">
      <canvas
        ref={canvasRef}
        width={EXAMPLE_WIDTH}
        height={EXAMPLE_HEIGHT}
        aria-label={`${example.label} example canvas`}
      />
      <figcaption>
        <strong>{example.label}</strong>
        <span>{example.description}</span>
      </figcaption>
    </figure>
  )
}

export const PuzzleInfoButton = ({ pluginId }: Props) => {
  const [openPluginId, setOpenPluginId] = useState<string | null>(null)
  const plugin = puzzleRegistry.get(pluginId)
  const help = plugin?.help
  const titleId = `${pluginId}-puzzle-info-title`
  const isOpen = openPluginId === pluginId

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

  if (!plugin || !help) {
    return null
  }

  return (
    <div className="puzzle-info-anchor">
      <button
        type="button"
        className="puzzle-info-button"
        aria-label={`Show ${plugin.displayName} rules`}
        aria-expanded={isOpen}
        data-active={isOpen}
        onClick={() => setOpenPluginId((current) => (current === pluginId ? null : pluginId))}
      >
        ?
      </button>
      {isOpen ? (
        <section
          className="puzzle-info-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <header className="puzzle-info-panel-header">
            <h2 id={titleId}>{help.title}</h2>
            <button
              type="button"
              className="panel-icon-close"
              aria-label={`Close ${plugin.displayName} rules`}
              onClick={() => setOpenPluginId(null)}
            >
              ×
            </button>
          </header>
          <p className="puzzle-info-summary">{help.summary}</p>
          <div className="puzzle-info-section">
            <h3>Core Rules</h3>
            <ul>
              {help.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
          {help.notes && help.notes.length > 0 ? (
            <div className="puzzle-info-section">
              <h3>In PuzzleKit</h3>
              <ul>
                {help.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {help.example ? (
            <div className="puzzle-info-section">
              <h3>{help.example.title}</h3>
              <div className="puzzle-info-example-grid">
                <PuzzleInfoExampleCanvas example={help.example.before} />
                <PuzzleInfoExampleCanvas example={help.example.after} />
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
