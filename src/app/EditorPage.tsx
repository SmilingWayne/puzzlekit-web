import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { parseCellKey, parseEdgeKey } from '../domain/ir/keys'
import {
  SLITHER_CUSTOM_GRID_MAX,
  SLITHER_CUSTOM_GRID_MIN,
} from '../domain/ir/slither'
import type { PuzzleIR } from '../domain/ir/types'
import { puzzleRegistry } from '../domain/plugins/registry'
import { SlitherlinkEditorBoard } from '../features/editor/SlitherlinkEditorBoard'
import { useEditorStore } from '../features/editor/editorStore'
import { puzzlePresets, type PuzzlePreset } from '../features/editor/presets'
import { useSolverStore } from '../features/solver/solverStore'
import './workspace.css'

const PRESET_PREVIEW_WIDTH = 320
const PRESET_PREVIEW_HEIGHT = 180
const PRESET_PREVIEW_PADDING = 18

const parsePresetPuzzle = (preset: PuzzlePreset): PuzzleIR | null => {
  if (preset.puzzle) {
    return preset.puzzle
  }
  if (!preset.sourceUrl) {
    return null
  }
  const plugin = puzzleRegistry.get(preset.puzzleType)
  if (!plugin) {
    return null
  }
  try {
    return plugin.parse(preset.sourceUrl)
  } catch {
    return null
  }
}

const drawPresetPreview = (ctx: CanvasRenderingContext2D, puzzle: PuzzleIR): void => {
  const boardWidth = PRESET_PREVIEW_WIDTH - PRESET_PREVIEW_PADDING * 2
  const boardHeight = PRESET_PREVIEW_HEIGHT - PRESET_PREVIEW_PADDING * 2
  const cellSize = Math.min(boardWidth / puzzle.cols, boardHeight / puzzle.rows)
  const gridWidth = cellSize * puzzle.cols
  const gridHeight = cellSize * puzzle.rows
  const offsetX = (PRESET_PREVIEW_WIDTH - gridWidth) / 2
  const offsetY = (PRESET_PREVIEW_HEIGHT - gridHeight) / 2

  ctx.clearRect(0, 0, PRESET_PREVIEW_WIDTH, PRESET_PREVIEW_HEIGHT)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PRESET_PREVIEW_WIDTH, PRESET_PREVIEW_HEIGHT)

  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 1
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

  ctx.fillStyle = '#111827'
  ctx.font = `700 ${Math.max(12, Math.min(22, cellSize * 0.5))}px Inter, sans-serif`
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

  for (const [edge, state] of Object.entries(puzzle.edges)) {
    const [v1, v2] = parseEdgeKey(edge)
    const x1 = offsetX + v1[1] * cellSize
    const y1 = offsetY + v1[0] * cellSize
    const x2 = offsetX + v2[1] * cellSize
    const y2 = offsetY + v2[0] * cellSize

    if (state.mark === 'line') {
      ctx.strokeStyle = '#0284c7'
      ctx.lineWidth = Math.max(2, cellSize * 0.08)
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    } else if (state.mark === 'blank') {
      const midX = (x1 + x2) / 2
      const midY = (y1 + y2) / 2
      const crossSize = Math.max(3, cellSize * 0.18)
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = Math.max(1.5, cellSize * 0.05)
      ctx.beginPath()
      ctx.moveTo(midX - crossSize, midY - crossSize)
      ctx.lineTo(midX + crossSize, midY + crossSize)
      ctx.moveTo(midX + crossSize, midY - crossSize)
      ctx.lineTo(midX - crossSize, midY + crossSize)
      ctx.stroke()
    }
  }

  ctx.fillStyle = '#111827'
  const vertexRadius = Math.max(1.3, Math.min(2.2, cellSize * 0.08))
  for (let row = 0; row <= puzzle.rows; row += 1) {
    for (let col = 0; col <= puzzle.cols; col += 1) {
      ctx.beginPath()
      ctx.arc(offsetX + col * cellSize, offsetY + row * cellSize, vertexRadius, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

const PresetPreviewBoard = ({ preset }: { preset: PuzzlePreset }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const puzzle = useMemo(() => parsePresetPuzzle(preset), [preset])

  useEffect(() => {
    if (preset.previewImageUrl || !puzzle) {
      return
    }
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      return
    }
    canvas.width = PRESET_PREVIEW_WIDTH
    canvas.height = PRESET_PREVIEW_HEIGHT
    drawPresetPreview(ctx, puzzle)
  }, [preset.previewImageUrl, puzzle])

  if (preset.previewImageUrl) {
    return <img src={preset.previewImageUrl} alt="" loading="lazy" />
  }

  if (!puzzle) {
    return <span>{preset.rows} × {preset.cols}</span>
  }

  return (
    <canvas
      ref={canvasRef}
      className="preset-preview-canvas"
      aria-label={`${preset.name} preset preview`}
      width={PRESET_PREVIEW_WIDTH}
      height={PRESET_PREVIEW_HEIGHT}
    />
  )
}

type PresetLibraryDialogProps = {
  presets: PuzzlePreset[]
  selectedPresetId: string | null
  onClose: () => void
  onOpenUrl: (preset: PuzzlePreset) => void
  onLoadToEdit: (preset: PuzzlePreset) => void
  onLoadToSolve: (preset: PuzzlePreset) => void
  actionError: string
}

const PresetLibraryDialog = ({
  presets,
  selectedPresetId,
  onClose,
  onOpenUrl,
  onLoadToEdit,
  onLoadToSolve,
  actionError,
}: PresetLibraryDialogProps) => {
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const tags = useMemo(
    () => Array.from(new Set(presets.flatMap((preset) => preset.tags))).sort(),
    [presets],
  )
  const filteredPresets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return presets.filter((preset) => {
      const searchableText = [
        preset.name,
        preset.description,
        preset.sourceUrl,
        preset.puzzleType,
        preset.rows,
        preset.cols,
        ...preset.tags,
      ]
        .filter((value) => value !== undefined)
        .join(' ')
        .toLowerCase()
      const matchesQuery = normalizedQuery.length === 0 || searchableText.includes(normalizedQuery)
      const matchesTag = activeTag === null || preset.tags.includes(activeTag)
      return matchesQuery && matchesTag
    })
  }, [activeTag, presets, query])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="preset-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="preset-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preset-library-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="preset-modal-header">
          <div>
            <h2 id="preset-library-title">Load Preset</h2>
            {/* <p>Select a puzzle to open, solve, or continue editing.</p> */}
          </div>
          <button type="button" className="preset-modal-close" onClick={onClose} aria-label="Close preset library">
            Close
          </button>
        </header>
        <div className="preset-modal-tools">
          <label className="label-row preset-search-field">
            Search presets
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, tag, description, or URL"
            />
          </label>
          <div className="preset-filter-row" aria-label="Preset tag filters">
            <button type="button" data-active={activeTag === null} onClick={() => setActiveTag(null)}>
              All
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                data-active={activeTag === tag}
                onClick={() => setActiveTag((current) => (current === tag ? null : tag))}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
        {actionError ? <p className="error-text preset-action-error">{actionError}</p> : null}
        <div className="preset-grid-scroll">
          <div className="preset-grid">
            {filteredPresets.map((preset) => (
              <article
                key={preset.id}
                className="preset-library-card"
                data-active={selectedPresetId === preset.id}
              >
                <div className="preset-preview">
                  <PresetPreviewBoard preset={preset} />
                </div>
                <div className="preset-card-body">
                  <h3>{preset.name}</h3>
                  <span className="preset-card-meta">
                    {preset.rows} × {preset.cols} · {preset.puzzleType}
                  </span>
                  <div className="preset-tags">
                    {preset.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  {preset.description ? (
                    <p className="preset-description">{preset.description}</p>
                  ) : null}
                </div>
                <div className="preset-card-actions">
                  <button type="button" disabled={!preset.sourceUrl} onClick={() => onOpenUrl(preset)}>
                    URL
                  </button>
                  <button type="button" onClick={() => onLoadToSolve(preset)}>
                    To Solve
                  </button>
                  <button type="button" className="primary-action" onClick={() => onLoadToEdit(preset)}>
                    To Edit
                  </button>
                </div>
              </article>
            ))}
          </div>
          {filteredPresets.length === 0 ? <p className="preset-empty">No presets match the current filters.</p> : null}
        </div>
      </section>
    </div>
  )
}

export const EditorPage = () => {
  const navigate = useNavigate()
  const {
    pluginId,
    puzzle,
    sourceUrl,
    importError,
    selectedPresetId,
    setPluginId,
    createBlankSlither,
    importFromUrl,
    loadPreset,
    setSlitherCellClue,
    setSlitherEdgeMark,
  } = useEditorStore()
  const loadPuzzle = useSolverStore((state) => state.loadPuzzle)
  const [localUrl, setLocalUrl] = useState(sourceUrl)
  const [rows, setRows] = useState(String(puzzle.rows))
  const [cols, setCols] = useState(String(puzzle.cols))
  const [showPresetLibrary, setShowPresetLibrary] = useState(false)
  const [presetActionError, setPresetActionError] = useState('')

  useEffect(() => {
    setRows(String(puzzle.rows))
    setCols(String(puzzle.cols))
  }, [puzzle.rows, puzzle.cols])

  useEffect(() => {
    setLocalUrl(sourceUrl)
  }, [sourceUrl])

  const solveCurrentPuzzle = () => {
    loadPuzzle(puzzle, {
      pluginId: puzzle.puzzleType,
      sourceUrl,
    })
    navigate('/')
  }

  const openPresetUrl = (preset: PuzzlePreset) => {
    if (!preset.sourceUrl) {
      return
    }
    window.open(preset.sourceUrl, '_blank', 'noopener,noreferrer')
  }

  const loadPresetToEdit = (preset: PuzzlePreset) => {
    loadPreset(preset)
    setRows(String(preset.rows))
    setCols(String(preset.cols))
    setLocalUrl(preset.sourceUrl ?? '')
    setPresetActionError('')
    setShowPresetLibrary(false)
    navigate('/editor')
  }

  const loadPresetToSolve = (preset: PuzzlePreset) => {
    try {
      if (preset.puzzle) {
        loadPuzzle(preset.puzzle, {
          pluginId: preset.puzzleType,
          sourceUrl: preset.sourceUrl ?? '',
        })
      } else if (preset.sourceUrl) {
        const plugin = puzzleRegistry.get(preset.puzzleType)
        if (!plugin) {
          throw new Error(`Plugin "${preset.puzzleType}" not found.`)
        }
        const parsed = plugin.parse(preset.sourceUrl)
        loadPuzzle(parsed, {
          pluginId: preset.puzzleType,
          sourceUrl: preset.sourceUrl,
        })
      } else {
        throw new Error(`Preset "${preset.name}" does not include puzzle data.`)
      }
      setPresetActionError('')
      setShowPresetLibrary(false)
      navigate('/')
    } catch (error) {
      setPresetActionError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <main className="workspace">
      <section className="workspace-grid editor-workspace-grid">
        <div className="left-column">
          <header className="workspace-title">
            <div>
              <h1>PuzzleKit Editor</h1>
              <p>Create a puzzle, then hand it to the explainable solver.</p>
            </div>
            <nav className="workspace-nav" aria-label="Workspace navigation">
              <Link to="/">Solver</Link>
              <Link aria-current="page" to="/editor">
                Editor
              </Link>
            </nav>
          </header>
          <SlitherlinkEditorBoard
            puzzle={puzzle}
            onCellClueChange={setSlitherCellClue}
            onEdgeMarkChange={setSlitherEdgeMark}
          />
        </div>
        <div className="right-column">
          <section className="panel-card control-panel-card">
            <header className="panel-header">
              <h2>Puzzle Builder</h2>
            </header>
            <label className="label-row">
              Puzzle Type
              <select value={pluginId} onChange={(event) => setPluginId(event.target.value)}>
                {puzzleRegistry.all().map((plugin) => (
                  <option
                    key={plugin.id}
                    value={plugin.id}
                    disabled={plugin.id !== 'slitherlink'}
                  >
                    {plugin.id === 'nonogram' ? 'Nonogram (planned)' : plugin.displayName}
                  </option>
                ))}
              </select>
            </label>
            <div className="control-group compact-control-group">
              <span className="control-group-title">Grid</span>
              <div className="editor-size-row">
                <label className="control-number-field">
                  Rows
                  <input
                    type="number"
                    min={SLITHER_CUSTOM_GRID_MIN}
                    max={SLITHER_CUSTOM_GRID_MAX}
                    value={rows}
                    onChange={(event) => setRows(event.target.value)}
                  />
                </label>
                <label className="control-number-field">
                  Cols
                  <input
                    type="number"
                    min={SLITHER_CUSTOM_GRID_MIN}
                    max={SLITHER_CUSTOM_GRID_MAX}
                    value={cols}
                    onChange={(event) => setCols(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    createBlankSlither(Number(rows), Number(cols))
                  }}
                >
                  New Grid
                </button>
              </div>
            </div>
            <label className="label-row editor-url-field">
              URL (puzz.link, pzplus, pzv, or Penpa+ Slitherlink)
              <textarea
                rows={3}
                value={localUrl}
                onChange={(event) => setLocalUrl(event.target.value)}
                placeholder="Paste puzz.link, pzplus, pzv, or penpa URL"
              />
            </label>
            <div className="button-row">
              <button type="button" onClick={() => importFromUrl(localUrl)}>
                Import URL
              </button>
              <button type="button" onClick={() => setShowPresetLibrary(true)}>
                Load Preset
              </button>
              <button type="button" className="primary-action" onClick={solveCurrentPuzzle}>
                Solve It
              </button>
            </div>
            {importError ? <p className="error-text">{importError}</p> : null}
          </section>
        </div>
      </section>
      {showPresetLibrary ? (
        <PresetLibraryDialog
          presets={puzzlePresets}
          selectedPresetId={selectedPresetId}
          onClose={() => {
            setPresetActionError('')
            setShowPresetLibrary(false)
          }}
          onOpenUrl={openPresetUrl}
          onLoadToEdit={loadPresetToEdit}
          onLoadToSolve={loadPresetToSolve}
          actionError={presetActionError}
        />
      ) : null}
    </main>
  )
}
