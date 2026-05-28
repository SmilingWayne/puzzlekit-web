import type { Rule } from '../types'
import { createBlackPearlStrongInferenceRule } from './rules/blackPearlStrongInference'
import { createMasyuCandidateBridgeLineRule } from './rules/bridges'
import {
  createAdjacentWhitePearlsLookaheadRule,
  createBlackPearlCandidatePruningRule,
  createWhitePearlCandidatePruningRule,
} from './rules/candidates'
import {
  createMasyuColorLinePropagationRule,
  createMasyuColorPearlPropagationRule,
  createMasyuTileColorPropagationRule,
} from './rules/color'
import { createMasyuTileConnectivityCutColoringRule } from './rules/connectivity'
import { createCellExitCompletionRule } from './rules/completion'
import { createPreventPrematureLoopRule } from './rules/loop'
import {
  createBlackDiagonalWhitePinchRule,
  createBlackFacingConsecutiveWhitesRule,
  createConsecutiveWhitePearlsStraightRule,
  createDoubleBlackSqueezeRule,
} from './rules/patterns'
import { createBlackPearlRule, createWhitePearlRule } from './rules/pearls'
import { createWhitePearlStrongInferenceRule } from './rules/whitePearlStrongInference'

export const deterministicMasyuRules: Rule[] = [
  createWhitePearlRule(),
  createBlackPearlRule(),
  createBlackFacingConsecutiveWhitesRule(),
  createBlackDiagonalWhitePinchRule(),
  createConsecutiveWhitePearlsStraightRule(),
  createDoubleBlackSqueezeRule(),
  createMasyuTileColorPropagationRule(),
  createMasyuColorPearlPropagationRule(),
  createMasyuColorLinePropagationRule(),
  createMasyuTileConnectivityCutColoringRule(),
  createMasyuCandidateBridgeLineRule(),
  createPreventPrematureLoopRule(),
  createBlackPearlCandidatePruningRule(),
  createWhitePearlCandidatePruningRule(),
  createAdjacentWhitePearlsLookaheadRule(),
  createCellExitCompletionRule(),
]

export const masyuRules: Rule[] = [
  ...deterministicMasyuRules,
  createBlackPearlStrongInferenceRule(() => deterministicMasyuRules),
  createWhitePearlStrongInferenceRule(() => deterministicMasyuRules),
]
