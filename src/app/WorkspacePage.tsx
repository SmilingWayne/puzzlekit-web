import { useMemo } from 'react'
import { CanvasBoard } from '../features/board/CanvasBoard'
import { ExplanationPanel } from '../features/explanation/ExplanationPanel'
import { ControlPanel } from '../features/solver/ControlPanel'
import { buildDifficultySnapshot, useSolverStore } from '../features/solver/solverStore'
import { StatsPanel } from '../features/stats/StatsPanel'
import './workspace.css'

export const WorkspacePage = () => {
  const { currentPuzzle, steps, pointer, highlightedCells, highlightedEdges, includeVertexNumbers } =
    useSolverStore()
  const activeSteps = useMemo(() => steps.slice(0, pointer), [steps, pointer])
  const difficulty = useMemo(() => buildDifficultySnapshot(activeSteps), [activeSteps])

  return (
    <main className="workspace">
      <header className="workspace-title">
        <h1>PuzzleKit Web - Logical Solver Workspace</h1>
        <p>
          Incremental and explainable deduction flow for Slitherlink, with extension slots for
          Masyu and Nonogram.
        </p>
      </header>

      <section className="workspace-grid">
        <div className="left-column">
          <CanvasBoard
            puzzle={currentPuzzle}
            highlightedCells={highlightedCells}
            highlightedEdges={highlightedEdges}
            showVertexNumbers={includeVertexNumbers}
          />
          <StatsPanel steps={activeSteps} difficulty={difficulty} />
        </div>
        <div className="right-column">
          <ControlPanel />
          <ExplanationPanel steps={activeSteps} />
        </div>
      </section>
    </main>
  )
}
