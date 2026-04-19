import { beforeEach, describe, expect, it } from 'vitest'
import { cellKey } from '../../domain/ir/keys'
import { useSolverStore } from './solverStore'

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
