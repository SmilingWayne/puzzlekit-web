import { useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { parsePuzzlinkDeepLink } from '../domain/deepLink/puzzlinkDeepLink'
import { CanvasBoard } from '../features/board/CanvasBoard'
import { ExplanationPanel } from '../features/explanation/ExplanationPanel'
import { ControlPanel } from '../features/solver/ControlPanel'
import { useSolverStore } from '../features/solver/solverStore'
import { StatsPanel } from '../features/stats/StatsPanel'
import { WorkspaceHeader } from './WorkspaceHeader'
import './workspace.css'

export const WorkspacePage = () => {
  const location = useLocation()
  const didHandleDeepLink = useRef(false)
  const {
    pluginId,
    currentPuzzle,
    steps,
    traceStatsCache,
    pointer,
    highlightedCells,
    highlightedColorCells,
    highlightedColorTiles,
    highlightedEdges,
    highlightedLines,
    displaySettings,
    setDisplayOption,
    solveProgress,
    goToStep,
    isRunning,
    loadPuzzle,
    loadDefaultPuzzle,
  } = useSolverStore()
  const activeSteps = useMemo(() => steps.slice(0, pointer), [steps, pointer])

  useEffect(() => {
    if (didHandleDeepLink.current) {
      return
    }
    didHandleDeepLink.current = true

    const result = parsePuzzlinkDeepLink(location.search)
    if (result.status === 'valid') {
      loadPuzzle(result.puzzle, {
        pluginId: result.pluginId,
        sourceUrl: result.sourceUrl,
      })
    } else if (result.status === 'invalid') {
      loadDefaultPuzzle(`${result.message} The default puzzle has been loaded instead.`)
    }
  }, [loadDefaultPuzzle, loadPuzzle, location.search])

  return (
    <main className="workspace">
      <section className="workspace-grid">
        <div className="left-column">
          <WorkspaceHeader
            title="PuzzleKit Web"
            description="A Step-wise and Explainable Inference Solver for Logic Puzzles."
            activePage="solver"
          />
          <CanvasBoard
            puzzle={currentPuzzle}
            pluginId={pluginId}
            highlightedCells={highlightedCells}
            highlightedColorCells={highlightedColorCells}
            highlightedColorTiles={highlightedColorTiles}
            highlightedEdges={highlightedEdges}
            highlightedLines={highlightedLines}
            displaySettings={displaySettings}
            onSetDisplayOption={setDisplayOption}
          />
          <StatsPanel
            pluginId={pluginId}
            traceStatsCache={traceStatsCache}
            pointer={pointer}
            isRunning={isRunning}
            onGoToStep={goToStep}
          />
        </div>
        <div className="right-column">
          <ControlPanel />
          <ExplanationPanel steps={activeSteps} />
        </div>
      </section>
      {solveProgress ? (
        <div className="solve-progress-overlay" role="dialog" aria-modal="true" aria-labelledby="solve-progress-title">
          <div className="solve-progress-modal">
            <h2 id="solve-progress-title">Solving to End</h2>
            <p className="solve-progress-count">
              Step {solveProgress.current} / {solveProgress.total}
            </p>
            <div
              className="solve-progress-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={solveProgress.total}
              aria-valuenow={solveProgress.current}
            >
              <span
                style={{
                  width: `${Math.min(100, (solveProgress.current / solveProgress.total) * 100)}%`,
                }}
              />
            </div>
            <p className="solve-progress-message">Reasoning in progress...</p>
          </div>
        </div>
      ) : null}
    </main>
  )
}
