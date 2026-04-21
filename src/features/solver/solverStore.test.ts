import { beforeEach, describe, expect, it } from 'vitest'
import { cellKey } from '../../domain/ir/keys'
import { useSolverStore } from './solverStore'
import type { RuleStep } from '../../domain/rules/types'

const SAMPLE_URL = 'https://puzz.link/p?slither/3/3/g0h'

describe('solver timeline behavior', () => {
  beforeEach(() => {
    useSolverStore.getState().importFromUrl(SAMPLE_URL, 'slitherlink')
  })

  it('drops future branch after previous step and re-next', () => {
    const store = useSolverStore.getState()
    store.nextStep()
    expect(useSolverStore.getState().steps.length).toBe(1)
    expect(useSolverStore.getState().pointer).toBe(1)

    store.prevStep()
    expect(useSolverStore.getState().pointer).toBe(0)
    expect(useSolverStore.getState().steps.length).toBe(1)

    store.nextStep()
    expect(useSolverStore.getState().pointer).toBe(1)
    expect(useSolverStore.getState().steps.length).toBe(1)
  })
})

describe('custom slither grid and clue editing', () => {
  beforeEach(() => {
    useSolverStore.getState().importFromUrl(SAMPLE_URL, 'slitherlink')
  })

  it('applyCustomSlitherGrid clears steps and sourceUrl', () => {
    useSolverStore.getState().nextStep()
    expect(useSolverStore.getState().steps.length).toBeGreaterThan(0)
    useSolverStore.getState().applyCustomSlitherGrid(5, 7)
    const after = useSolverStore.getState()
    expect(after.steps.length).toBe(0)
    expect(after.pointer).toBe(0)
    expect(after.sourceUrl).toBe('')
    expect(after.currentPuzzle.rows).toBe(5)
    expect(after.currentPuzzle.cols).toBe(7)
  })

  it('applyCustomSlitherGrid clamps size to 3–100', () => {
    useSolverStore.getState().applyCustomSlitherGrid(1, 200)
    const after = useSolverStore.getState()
    expect(after.currentPuzzle.rows).toBe(3)
    expect(after.currentPuzzle.cols).toBe(100)
  })

  it('setSlitherCellClue resets timeline', () => {
    useSolverStore.getState().nextStep()
    expect(useSolverStore.getState().pointer).toBeGreaterThan(0)
    useSolverStore.getState().setSlitherCellClue(cellKey(0, 0), 2)
    const after = useSolverStore.getState()
    expect(after.pointer).toBe(0)
    expect(after.steps.length).toBe(0)
    expect(after.currentPuzzle.cells[cellKey(0, 0)]?.clue).toEqual({
      kind: 'number',
      value: 2,
    })
  })

  it('importFromUrl replaces a partial custom solve', () => {
    useSolverStore.getState().applyCustomSlitherGrid(4, 4)
    useSolverStore.getState().nextStep()
    expect(useSolverStore.getState().currentPuzzle.rows).toBe(4)
    useSolverStore.getState().importFromUrl(SAMPLE_URL, 'slitherlink')
    const after = useSolverStore.getState()
    expect(after.currentPuzzle.rows).toBe(3)
    expect(after.currentPuzzle.cols).toBe(3)
    expect(after.steps.length).toBe(0)
    expect(after.sourceUrl).toBe(SAMPLE_URL)
  })
})

describe('solver store cell color replay', () => {
  it('replays cell fill diffs and tracks highlightedColorCells', () => {
    const colorCell = cellKey(0, 0)
    const mockStep: RuleStep = {
      id: 'step-1',
      ruleId: 'color-edge-propagation',
      ruleName: 'Color-Edge Propagation',
      message: 'test',
      diffs: [
        {
          kind: 'cell',
          cellKey: colorCell,
          fromFill: null,
          toFill: 'green',
        },
      ],
      affectedCells: [colorCell],
      affectedEdges: [],
      affectedSectors: [],
      timestamp: Date.now(),
    }
    const state = useSolverStore.getState()
    const originalNextStep = state.nextStep
    useSolverStore.setState({
      ...state,
      steps: [],
      pointer: 0,
      highlightedCells: [],
      highlightedColorCells: [],
      highlightedEdges: [],
      nextStep: () => {
        const now = useSolverStore.getState()
        useSolverStore.setState({
          ...now,
          currentPuzzle: {
            ...now.currentPuzzle,
            cells: {
              ...now.currentPuzzle.cells,
              [colorCell]: {
                ...now.currentPuzzle.cells[colorCell],
                fill: 'green',
              },
            },
          },
          steps: [mockStep],
          pointer: 1,
          highlightedCells: mockStep.affectedCells,
          highlightedColorCells: [colorCell],
          highlightedEdges: [],
        })
      },
    })

    useSolverStore.getState().nextStep()

    expect(useSolverStore.getState().currentPuzzle.cells[colorCell]?.fill).toBe('green')
    expect(useSolverStore.getState().highlightedColorCells).toEqual([colorCell])

    useSolverStore.getState().prevStep()
    expect(useSolverStore.getState().currentPuzzle.cells[colorCell]?.fill).toBeUndefined()
    expect(useSolverStore.getState().highlightedColorCells).toEqual([])

    useSolverStore.getState().nextStep()
    expect(useSolverStore.getState().currentPuzzle.cells[colorCell]?.fill).toBe('green')
    expect(useSolverStore.getState().highlightedColorCells).toEqual([colorCell])

    useSolverStore.setState((prev) => ({ ...prev, nextStep: originalNextStep }))
  })
})
