import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  SLITHER_CUSTOM_GRID_MAX,
  SLITHER_CUSTOM_GRID_MIN,
} from '../domain/ir/slither'
import type { PuzzleIR } from '../domain/ir/types'
import { puzzleRegistry } from '../domain/plugins/registry'
import { BoardLegendButton } from '../features/board/BoardLegendButton'
import { SlitherlinkEditorBoard } from '../features/editor/SlitherlinkEditorBoard'
import { useEditorStore } from '../features/editor/editorStore'
import { puzzlePresets, type PuzzlePreset } from '../features/editor/presets'
import { PuzzlePreviewBoard } from '../features/puzzlePreview/PuzzlePreviewBoard'
import { PuzzleInfoButton } from '../features/puzzleInfo/PuzzleInfoButton'
import { useSolverStore } from '../features/solver/solverStore'
import './workspace.css'

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

const PresetPreviewBoard = ({ preset }: { preset: PuzzlePreset }) => {
  const puzzle = useMemo(() => parsePresetPuzzle(preset), [preset])

  if (preset.previewImageUrl) {
    return <img src={preset.previewImageUrl} alt="" loading="lazy" />
  }

  if (!puzzle) {
    return <span>{preset.rows} × {preset.cols}</span>
  }

  return <PuzzlePreviewBoard puzzle={puzzle} label={`${preset.name} preset preview`} />
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
              <Link to="/dataset">Dataset</Link>
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
            <div className="label-row type-row-wrap">
              <span className="type-row-label">Puzzle Type</span>
              <div className="type-row-controls">
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
                <PuzzleInfoButton pluginId={pluginId} />
                <BoardLegendButton pluginId={pluginId} />
              </div>
            </div>
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
