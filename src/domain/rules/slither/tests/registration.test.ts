import { describe, expect, it } from 'vitest'
import { deterministicSlitherRules } from '../rules'

describe('slither deterministic rule order', () => {
  it('prioritizes exact sector edge propagation before color and sector inference rules', () => {
    const edgePropagationIdx = deterministicSlitherRules.findIndex(
      (rule) => rule.id === 'sector-constraint-edge-propagation',
    )
    const vertexDegreeIdx = deterministicSlitherRules.findIndex(
      (rule) => rule.id === 'vertex-degree',
    )
    const colorOutsideIdx = deterministicSlitherRules.findIndex(
      (rule) => rule.id === 'color-outside-seeding',
    )
    const sectorInferenceIdx = deterministicSlitherRules.findIndex(
      (rule) => rule.id === 'sector-inference',
    )

    expect(edgePropagationIdx).toBeGreaterThan(vertexDegreeIdx)
    expect(edgePropagationIdx).toBeLessThan(colorOutsideIdx)
    expect(edgePropagationIdx).toBeLessThan(sectorInferenceIdx)
  })
})
