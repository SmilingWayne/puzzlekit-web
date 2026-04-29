import type { Rule } from '../types'
import {
  createColorCluePropagationRule,
  createColorEdgePropagationRule,
  createInsideReachabilityColoringRule,
  createColorOrthogonalConsensusPropagationRule,
  createColorOutsideSeedingRule,
  createColorSectorMaskPropagationRule,
} from './rules/color'
import { createCellCountRule, createPreventPrematureLoopRule, createVertexDegreeRule } from './rules/core'
import {
  createContiguousThreeRunBoundariesRule,
  createDiagonalAdjacentThreeOuterCornersRule,
} from './rules/patterns'
import { createApplySectorsInference } from './rules/sectorInference'
import {
  createSectorClueOneThreeIntraCellPropagationRule,
  createSectorClueTwoCombinationFeasibilityRule,
  createSectorConstraintEdgePropagationRule,
  createSectorDiagonalSharedVertexPropagationRule,
  createSectorNotOneClueTwoPropagationRule,
  createVertexOnlyOneNonSectorBalanceRule,
} from './rules/sectorPropagation'
import { createStrongInferenceRule } from './rules/strongInference'

export const deterministicSlitherRules: Rule[] = [
  createContiguousThreeRunBoundariesRule(),
  createDiagonalAdjacentThreeOuterCornersRule(),
  createCellCountRule(),
  createVertexDegreeRule(),
  createColorOutsideSeedingRule(),
  createColorEdgePropagationRule(),
  createColorCluePropagationRule(),
  createColorSectorMaskPropagationRule(),
  createColorOrthogonalConsensusPropagationRule(),
  createInsideReachabilityColoringRule(),
  createPreventPrematureLoopRule(),
  createApplySectorsInference(),
  createSectorDiagonalSharedVertexPropagationRule(),
  createSectorClueTwoCombinationFeasibilityRule(),
  createSectorClueOneThreeIntraCellPropagationRule(),
  createSectorConstraintEdgePropagationRule(),
  createVertexOnlyOneNonSectorBalanceRule(),
  createSectorNotOneClueTwoPropagationRule(),
]

export const slitherRules: Rule[] = [
  ...deterministicSlitherRules,
  createStrongInferenceRule(() => deterministicSlitherRules),
]
