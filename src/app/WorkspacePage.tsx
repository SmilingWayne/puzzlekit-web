import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CanvasBoard } from '../features/board/CanvasBoard'
import { ExplanationPanel } from '../features/explanation/ExplanationPanel'
import { ControlPanel } from '../features/solver/ControlPanel'
import { useSolverStore } from '../features/solver/solverStore'
import { StatsPanel } from '../features/stats/StatsPanel'
import './workspace.css'

export const WorkspacePage = () => {
  const {
    pluginId,
    initialPuzzle,
    currentPuzzle,
    steps,
    pointer,
    highlightedCells,
    highlightedColorCells,
    highlightedEdges,
    includeVertexNumbers,
    solveProgress,
    goToStep,
    isRunning,
  } = useSolverStore()
  const activeSteps = useMemo(() => steps.slice(0, pointer), [steps, pointer])

  return (
    <main className="workspace">
      <section className="workspace-grid">
        <div className="left-column">
          <header className="workspace-title">
            <div>
              <h1>PuzzleKit Web</h1>
              <p>A Step-wise and Explainable Inference Solver for Slitherlink.</p>
            </div>
            <nav className="workspace-nav" aria-label="Workspace navigation">
              <Link aria-current="page" to="/">
                Solver
              </Link>
              <Link to="/dataset">Dataset</Link>
              <Link to="/editor">Editor</Link>
            </nav>
          </header>
          <CanvasBoard
            puzzle={currentPuzzle}
            pluginId={pluginId}
            highlightedCells={highlightedCells}
            highlightedColorCells={highlightedColorCells}
            highlightedEdges={highlightedEdges}
            showVertexNumbers={includeVertexNumbers}
          />
          <StatsPanel
            initialPuzzle={initialPuzzle}
            steps={steps}
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
