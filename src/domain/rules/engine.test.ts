import { describe, expect, it } from 'vitest'
import { decodeSlitherFromPuzzlink } from '../parsers/puzzlink'
import { runNextRule } from './engine'
import { slitherRules } from './slither/rules'

describe('rule engine', () => {
  it('finds at least one step for simple zero clue puzzle', () => {
    const puzzle = decodeSlitherFromPuzzlink('https://puzz.link/p?slither/3/3/g0h')
    const result = runNextRule(puzzle, slitherRules, 1)
    expect(result.step).not.toBeNull()
    expect(result.step?.diffs.length).toBeGreaterThan(0)
  })
})
