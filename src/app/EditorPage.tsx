import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  SLITHER_CUSTOM_GRID_MAX,
  SLITHER_CUSTOM_GRID_MIN,
} from '../domain/ir/slither'
import { puzzleRegistry } from '../domain/plugins/registry'
import { SlitherlinkEditorBoard } from '../features/editor/SlitherlinkEditorBoard'
import { useEditorStore } from '../features/editor/editorStore'
import { puzzlePresets } from '../features/editor/presets'
import { useSolverStore } from '../features/solver/solverStore'
import './workspace.css'

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
              <button type="button" className="primary-action" onClick={solveCurrentPuzzle}>
                Solve It
              </button>
            </div>
            {importError ? <p className="error-text">{importError}</p> : null}
          </section>
          <section className="panel-card">
            <header className="panel-header">
              <h2>Quick Presets</h2>
            </header>
            <div className="preset-list">
              {puzzlePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="preset-card"
                  data-active={selectedPresetId === preset.id}
                  onClick={() => {
                    loadPreset(preset)
                    setRows(String(preset.rows))
                    setCols(String(preset.cols))
                    setLocalUrl(preset.sourceUrl ?? '')
                  }}
                >
                  <span className="preset-card-title">{preset.name}</span>
                  <span className="preset-card-meta">
                    {preset.rows} × {preset.cols} · {preset.puzzleType}
                  </span>
                  <span className="preset-tags">
                    {preset.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </span>
                  {preset.description ? (
                    <span className="preset-description">{preset.description}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
