import type { Rule } from '../types'
import {
  createColorCluePropagationRule,
  createColorConnectivityCutColoringRule,
  createColorEdgePropagationRule,
  createInsideReachabilityColoringRule,
  createColorOrthogonalConsensusPropagationRule,
  createColorOutsideSeedingRule,
  createColorSectorMaskPropagationRule,
  createOutsideReachabilityColoringRule,
} from './rules/color'
import { createColorAssumptionInferenceRule } from './rules/colorAssumptionInference'
import { createCellCountRule, createPreventPrematureLoopRule, createVertexDegreeRule } from './rules/core'
import {
  createContiguousThreeRunBoundariesRule,
  createDiagonalAdjacentThreeOuterCornersRule,
} from './rules/patterns'
import { createSectorParityInferenceRule } from './rules/sectorParityInference'
import { createApplySectorsInference } from './rules/sectorInference'
import {
  createClueVertexCandidateCombinationPruningRule,
  createSectorClueOneThreeIntraCellPropagationRule,
  createSectorConstraintEdgePropagationRule,
  createSectorDiagonalSharedVertexPropagationRule,
  createSectorNotOneClueTwoPropagationRule,
  createVertexCandidateEdgePruningRule,
  createVertexOnlyOneNonSectorBalanceRule,
} from './rules/sectorPropagation'
import { createStrongInferenceRule } from './rules/strongInference'

export const deterministicSlitherRules: Rule[] = [
  createContiguousThreeRunBoundariesRule(),
  createDiagonalAdjacentThreeOuterCornersRule(),
  createCellCountRule(),
  createVertexDegreeRule(),
  createSectorConstraintEdgePropagationRule(),
  createColorOutsideSeedingRule(),
  createColorEdgePropagationRule(),
  createColorCluePropagationRule(),
  createColorSectorMaskPropagationRule(),
  createColorOrthogonalConsensusPropagationRule(),
  createInsideReachabilityColoringRule(),
  createOutsideReachabilityColoringRule(),
  createColorConnectivityCutColoringRule(),
  createPreventPrematureLoopRule(),
  createApplySectorsInference(),
  createSectorDiagonalSharedVertexPropagationRule(),
  createVertexCandidateEdgePruningRule(),
  createClueVertexCandidateCombinationPruningRule(),
  createSectorClueOneThreeIntraCellPropagationRule(),
  // createSectorConstraintEdgePropagationRule(),
  createVertexOnlyOneNonSectorBalanceRule(),
  createSectorNotOneClueTwoPropagationRule(),
]

export const slitherRules: Rule[] = [
  ...deterministicSlitherRules,
  createColorAssumptionInferenceRule(() => deterministicSlitherRules),
  createSectorParityInferenceRule(() => deterministicSlitherRules),
  createStrongInferenceRule(() => deterministicSlitherRules),
]
