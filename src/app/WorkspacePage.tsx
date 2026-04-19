import { useEffect, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { CanvasBoard } from '../features/board/CanvasBoard'
import { ExplanationPanel } from '../features/explanation/ExplanationPanel'
import { ControlPanel } from '../features/solver/ControlPanel'
import { buildDifficultySnapshot, useSolverStore } from '../features/solver/solverStore'
import { StatsPanel } from '../features/stats/StatsPanel'
import './workspace.css'

const isTypingInField = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true
  }
  return target.isContentEditable
}

export const WorkspacePage = () => {
  const {
    currentPuzzle,
    steps,
    pointer,
    highlightedCells,
    highlightedEdges,
    includeVertexNumbers,
    pluginId,
    selectedCellKey,
    setSelectedCellKey,
    setSlitherCellClue,
  } = useSolverStore()
  const boardFocusRef = useRef<HTMLDivElement>(null)
  const activeSteps = useMemo(() => steps.slice(0, pointer), [steps, pointer])
  const difficulty = useMemo(() => buildDifficultySnapshot(activeSteps), [activeSteps])

  useEffect(() => {
    if (pluginId === 'slitherlink' && selectedCellKey && boardFocusRef.current) {
      boardFocusRef.current.focus()
    }
  }, [pluginId, selectedCellKey])

  const onBoardKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (pluginId !== 'slitherlink' || !selectedCellKey) {
      return
    }
    if (isTypingInField(event.target)) {
      return
    }

    if (event.key >= '0' && event.key <= '3') {
      event.preventDefault()
      setSlitherCellClue(selectedCellKey, Number(event.key) as 0 | 1 | 2 | 3)
      return
    }
    if (event.key === '?') {
      event.preventDefault()
      setSlitherCellClue(selectedCellKey, '?')
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      setSlitherCellClue(selectedCellKey, null)
    }
  }

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
          <div
            ref={boardFocusRef}
            className="board-focus-shell"
            tabIndex={-1}
            onKeyDown={onBoardKeyDown}
          >
            <CanvasBoard
              puzzle={currentPuzzle}
              highlightedCells={highlightedCells}
              highlightedEdges={highlightedEdges}
              showVertexNumbers={includeVertexNumbers}
              selectedCellKey={pluginId === 'slitherlink' ? selectedCellKey : null}
              onCellSelect={
                pluginId === 'slitherlink' ? (key) => setSelectedCellKey(key) : undefined
              }
            />
          </div>
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
