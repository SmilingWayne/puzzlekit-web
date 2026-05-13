import { useEffect, useRef } from 'react'
import { parseCellKey, parseEdgeKey } from '../../domain/ir/keys'
import type { PuzzleIR } from '../../domain/ir/types'

const DEFAULT_PREVIEW_WIDTH = 320
const DEFAULT_PREVIEW_HEIGHT = 180
const DEFAULT_PREVIEW_PADDING = 18
type PuzzlePreviewVariant = 'default' | 'compact'

const drawPuzzlePreview = (
  ctx: CanvasRenderingContext2D,
  puzzle: PuzzleIR,
  options: {
    width?: number
    height?: number
    padding?: number
    variant?: PuzzlePreviewVariant
  } = {},
): void => {
  const previewWidth = options.width ?? DEFAULT_PREVIEW_WIDTH
  const previewHeight = options.height ?? DEFAULT_PREVIEW_HEIGHT
  const padding = options.padding ?? DEFAULT_PREVIEW_PADDING
  const variant = options.variant ?? 'default'
  const isCompact = variant === 'compact'
  const boardWidth = previewWidth - padding * 2
  const boardHeight = previewHeight - padding * 2
  const cellSize = Math.min(boardWidth / puzzle.cols, boardHeight / puzzle.rows)
  const gridWidth = cellSize * puzzle.cols
  const gridHeight = cellSize * puzzle.rows
  const offsetX = (previewWidth - gridWidth) / 2
  const offsetY = (previewHeight - gridHeight) / 2

  ctx.clearRect(0, 0, previewWidth, previewHeight)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, previewWidth, previewHeight)

  ctx.strokeStyle = isCompact ? '#e2e8f0' : '#cbd5e1'
  ctx.lineWidth = isCompact ? 0.7 : 1
  for (let row = 0; row <= puzzle.rows; row += 1) {
    const y = offsetY + row * cellSize
    ctx.beginPath()
    ctx.moveTo(offsetX, y)
    ctx.lineTo(offsetX + gridWidth, y)
    ctx.stroke()
  }
  for (let col = 0; col <= puzzle.cols; col += 1) {
    const x = offsetX + col * cellSize
    ctx.beginPath()
    ctx.moveTo(x, offsetY)
    ctx.lineTo(x, offsetY + gridHeight)
    ctx.stroke()
  }

  const shouldDrawClues = !isCompact || cellSize >= 8
  if (shouldDrawClues) {
    ctx.fillStyle = isCompact ? '#334155' : '#111827'
    const clueFontSize = isCompact
      ? Math.min(12, Math.max(5, cellSize * 0.52))
      : Math.max(12, Math.min(22, cellSize * 0.5))
    const clueFontWeight = isCompact ? 500 : 700
    ctx.font = `${clueFontWeight} ${clueFontSize}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const [key, cell] of Object.entries(puzzle.cells)) {
      if (cell.clue?.kind !== 'number') {
        continue
      }
      const [row, col] = parseCellKey(key)
      ctx.fillText(
        String(cell.clue.value),
        offsetX + col * cellSize + cellSize / 2,
        offsetY + row * cellSize + cellSize / 2,
      )
    }
  }

  for (const [edge, state] of Object.entries(puzzle.edges)) {
    const [v1, v2] = parseEdgeKey(edge)
    const x1 = offsetX + v1[1] * cellSize
    const y1 = offsetY + v1[0] * cellSize
    const x2 = offsetX + v2[1] * cellSize
    const y2 = offsetY + v2[0] * cellSize

    if (state.mark === 'line') {
      ctx.strokeStyle = '#0284c7'
      ctx.lineWidth = isCompact ? Math.max(1.2, cellSize * 0.08) : Math.max(2, cellSize * 0.08)
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    } else if (state.mark === 'blank') {
      const midX = (x1 + x2) / 2
      const midY = (y1 + y2) / 2
      const crossSize = isCompact ? Math.max(1.8, cellSize * 0.16) : Math.max(3, cellSize * 0.18)
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = isCompact ? Math.max(1, cellSize * 0.05) : Math.max(1.5, cellSize * 0.05)
      ctx.beginPath()
      ctx.moveTo(midX - crossSize, midY - crossSize)
      ctx.lineTo(midX + crossSize, midY + crossSize)
      ctx.moveTo(midX + crossSize, midY - crossSize)
      ctx.lineTo(midX - crossSize, midY + crossSize)
      ctx.stroke()
    }
  }

  const shouldDrawVertices = !isCompact || cellSize >= 7
  if (shouldDrawVertices) {
    ctx.fillStyle = isCompact ? '#475569' : '#111827'
    const vertexRadius = isCompact
      ? Math.max(0.7, Math.min(1.5, cellSize * 0.055))
      : Math.max(1.3, Math.min(2.2, cellSize * 0.08))
    for (let row = 0; row <= puzzle.rows; row += 1) {
      for (let col = 0; col <= puzzle.cols; col += 1) {
        ctx.beginPath()
        ctx.arc(offsetX + col * cellSize, offsetY + row * cellSize, vertexRadius, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

type PuzzlePreviewBoardProps = {
  puzzle: PuzzleIR
  label: string
  className?: string
  width?: number
  height?: number
  padding?: number
  variant?: PuzzlePreviewVariant
}

export const PuzzlePreviewBoard = ({
  puzzle,
  label,
  className = 'preset-preview-canvas',
  width = DEFAULT_PREVIEW_WIDTH,
  height = DEFAULT_PREVIEW_HEIGHT,
  padding = DEFAULT_PREVIEW_PADDING,
  variant = 'default',
}: PuzzlePreviewBoardProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      return
    }
    canvas.width = width
    canvas.height = height
    drawPuzzlePreview(ctx, puzzle, { width, height, padding, variant })
  }, [height, padding, puzzle, variant, width])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-label={label}
      width={width}
      height={height}
    />
  )
}
