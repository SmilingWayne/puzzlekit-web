import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SLITHER_CUSTOM_GRID_MAX,
  SLITHER_CUSTOM_GRID_MIN,
} from '../domain/ir/slither'
import { puzzleRegistry } from '../domain/plugins/registry'
import { BoardLegendButton } from '../features/board/BoardLegendButton'
import { MasyuEditorBoard } from '../features/editor/MasyuEditorBoard'
import { SlitherlinkEditorBoard } from '../features/editor/SlitherlinkEditorBoard'
import { useEditorStore, type MasyuPearlDraft } from '../features/editor/editorStore'
import { PuzzleInfoButton } from '../features/puzzleInfo/PuzzleInfoButton'
import { useSolverStore } from '../features/solver/solverStore'
import { WorkspaceHeader } from './WorkspaceHeader'
import './workspace.css'

type ActivePuzzlePopover = 'rules' | 'legend' | null

export const EditorPage = () => {
  const navigate = useNavigate()
  const {
    pluginId,
    puzzle,
    sourceUrl,
    importError,
    setPluginId,
    createBlankPuzzle,
    importFromUrl,
    setSlitherCellClue,
    setSlitherEdgeMark,
    setMasyuCellPearl,
    cycleMasyuCellPearl,
  } = useEditorStore()
  const loadPuzzle = useSolverStore((state) => state.loadPuzzle)
  const [localUrl, setLocalUrl] = useState(sourceUrl)
  const [rows, setRows] = useState(String(puzzle.rows))
  const [cols, setCols] = useState(String(puzzle.cols))
  const [activePuzzlePopover, setActivePuzzlePopover] = useState<ActivePuzzlePopover>(null)
  const [masyuPearlTool, setMasyuPearlTool] = useState<MasyuPearlDraft>(null)

  useEffect(() => {
    setRows(String(puzzle.rows))
    setCols(String(puzzle.cols))
  }, [puzzle.rows, puzzle.cols])

  useEffect(() => {
    setLocalUrl(sourceUrl)
  }, [sourceUrl])

  useEffect(() => {
    if (pluginId !== 'masyu') {
      setMasyuPearlTool(null)
    }
  }, [pluginId])

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
          <WorkspaceHeader
            title="PuzzleKit Editor"
            description="Create a puzzle, then hand it to the explainable solver."
            activePage="editor"
          />
          {pluginId === 'masyu' ? (
            <MasyuEditorBoard
              puzzle={puzzle}
              pluginId={pluginId}
              pearlTool={masyuPearlTool}
              onCellPearlChange={setMasyuCellPearl}
              onCellPearlCycle={cycleMasyuCellPearl}
            />
          ) : (
            <SlitherlinkEditorBoard
              puzzle={puzzle}
              pluginId={pluginId}
              onCellClueChange={setSlitherCellClue}
              onEdgeMarkChange={setSlitherEdgeMark}
            />
          )}
        </div>
        <div className="right-column">
          <section className="panel-card control-panel-card">
            <header className="panel-header">
              <h2>Puzzle Builder</h2>
            </header>
            <div className="label-row type-row-wrap">
              <span className="type-row-label">Puzzle Type</span>
              <div className="type-row-controls">
                <select
                  value={pluginId}
                  onChange={(event) => {
                    setActivePuzzlePopover(null)
                    setMasyuPearlTool(null)
                    setPluginId(event.target.value)
                  }}
                >
                  {puzzleRegistry.all().map((plugin) => (
                    <option
                      key={plugin.id}
                      value={plugin.id}
                      disabled={plugin.id === 'nonogram'}
                    >
                      {plugin.id === 'nonogram' ? 'Nonogram (planned)' : plugin.displayName}
                    </option>
                  ))}
                </select>
                <PuzzleInfoButton
                  pluginId={pluginId}
                  isOpen={activePuzzlePopover === 'rules'}
                  onToggle={() =>
                    setActivePuzzlePopover((current) => (current === 'rules' ? null : 'rules'))
                  }
                  onClose={() => setActivePuzzlePopover(null)}
                />
                <BoardLegendButton
                  pluginId={pluginId}
                  isOpen={activePuzzlePopover === 'legend'}
                  onToggle={() =>
                    setActivePuzzlePopover((current) => (current === 'legend' ? null : 'legend'))
                  }
                  onClose={() => setActivePuzzlePopover(null)}
                />
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
                    createBlankPuzzle(Number(rows), Number(cols))
                  }}
                >
                  New Grid
                </button>
              </div>
            </div>
            {pluginId === 'masyu' ? (
              <div className="control-group compact-control-group editor-pearl-group">
                <span className="control-group-title">Pearls</span>
                <div className="editor-pearl-tool-row">
                  <button
                    type="button"
                    aria-pressed={masyuPearlTool === 'black'}
                    data-active={masyuPearlTool === 'black'}
                    onClick={() =>
                      setMasyuPearlTool((current) => (current === 'black' ? null : 'black'))
                    }
                  >
                    Set Black Pearl
                  </button>
                  <button
                    type="button"
                    aria-pressed={masyuPearlTool === 'white'}
                    data-active={masyuPearlTool === 'white'}
                    onClick={() =>
                      setMasyuPearlTool((current) => (current === 'white' ? null : 'white'))
                    }
                  >
                    Set White Pearl
                  </button>
                </div>
              </div>
            ) : null}
            <label className="label-row editor-url-field">
              {pluginId === 'masyu'
                ? 'URL (puzz.link, pzplus, pzv, or Penpa+ Masyu)'
                : 'URL (puzz.link, pzplus, pzv, or Penpa+ Slitherlink)'}
              <textarea
                rows={3}
                value={localUrl}
                onChange={(event) => setLocalUrl(event.target.value)}
                placeholder={
                  pluginId === 'masyu'
                    ? 'Paste puzz.link, pzplus, pzv, or Penpa+ Masyu URL'
                    : 'Paste puzz.link, pzplus, pzv, or Penpa+ Slitherlink URL'
                }
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
        </div>
      </section>
    </main>
  )
}
