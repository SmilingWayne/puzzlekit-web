import { describe, expect, it } from 'vitest'
import { runNextRule } from '../../engine'
import { masyuPlugin } from '../../../plugins/masyuPlugin'

describe('Masyu rule registration', () => {
  it('registers Masyu rules in pearl-then-completion order', () => {
    expect(masyuPlugin.getRules().map((rule) => rule.name)).toEqual([
      'White Pearl Rule',
      'Black Pearl Rule',
      'Black Facing Consecutive Whites',
      'Black Diagonal White Pinch',
      'Consecutive White Pearls Straight',
      'White Corridor',
      'Double Black Squeeze',
      'Masyu Tile Color Propagation',
      'Masyu Color-Pearl Propagation',
      'Masyu Color-Line Propagation',
      'Masyu Tile Connectivity Cut Coloring',
      'Masyu Candidate Bridge Line',
      'Prevent Premature Loop',
      'Masyu Empty Cell Premature Loop',
      'Black Pearl Candidate Pruning',
      'White Pearl Candidate Pruning',
      'Adjacent White Pearls LookAhead',
      'Cell Exit Completion',
      'Black Pearl Strong Inference',
      'Masyu Line Component Endpoint Strong Inference',
      'White Pearl Strong Inference',
    ])
  })

  it('applies a line diff on the sample Masyu puzzle', () => {
    const puzzle = masyuPlugin.parse('https://puzz.link/p?mashu/5/5/001390360')
    const { step } = runNextRule(puzzle, masyuPlugin.getRules(), 1)

    expect(step?.ruleName).toBe('White Pearl Rule')
    expect(step?.diffs.some((diff) => diff.kind === 'line')).toBe(true)
  })

  it('registers Masyu color propagation before premature loop prevention', () => {
    const rules = masyuPlugin.getRules().map((rule) => rule.id)

    expect(rules).toContain('masyu-tile-color-propagation')
    expect(rules).toContain('masyu-color-pearl-propagation')
    expect(rules).toContain('masyu-color-line-propagation')
    expect(rules).toContain('masyu-tile-connectivity-cut-coloring')
    expect(rules).toContain('masyu-candidate-bridge-line')
    expect(rules.indexOf('masyu-color-pearl-propagation')).toBe(
      rules.indexOf('masyu-tile-color-propagation') + 1,
    )
    expect(rules.indexOf('masyu-color-line-propagation')).toBe(
      rules.indexOf('masyu-color-pearl-propagation') + 1,
    )
    expect(rules.indexOf('masyu-tile-connectivity-cut-coloring')).toBe(
      rules.indexOf('masyu-color-line-propagation') + 1,
    )
    expect(rules.indexOf('masyu-candidate-bridge-line')).toBe(
      rules.indexOf('masyu-tile-connectivity-cut-coloring') + 1,
    )
    expect(rules.indexOf('masyu-candidate-bridge-line')).toBeLessThan(
      rules.indexOf('masyu-prevent-premature-loop'),
    )
    expect(rules.indexOf('masyu-empty-cell-premature-loop')).toBe(
      rules.indexOf('masyu-prevent-premature-loop') + 1,
    )
    expect(rules.indexOf('masyu-empty-cell-premature-loop')).toBeLessThan(
      rules.indexOf('masyu-black-pearl-candidate-pruning'),
    )
    expect(rules.indexOf('masyu-white-pearl-candidate-pruning')).toBe(
      rules.indexOf('masyu-black-pearl-candidate-pruning') + 1,
    )
    expect(rules.indexOf('masyu-adjacent-white-pearls-lookahead')).toBe(
      rules.indexOf('masyu-white-pearl-candidate-pruning') + 1,
    )
    expect(rules.indexOf('masyu-adjacent-white-pearls-lookahead')).toBeLessThan(
      rules.indexOf('cell-exit-completion'),
    )
  })

  it('registers bounded strong inference in black-endpoint-white order', () => {
    expect(masyuPlugin.getRules().slice(-3).map((rule) => rule.id)).toEqual([
      'masyu-black-pearl-strong-inference',
      'masyu-line-component-endpoint-strong-inference',
      'masyu-white-pearl-strong-inference',
    ])
  })
})
