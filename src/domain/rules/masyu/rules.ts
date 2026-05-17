import type { Rule } from '../types'
import { createBlackPearlStrongInferenceRule } from './rules/blackPearlStrongInference'
import { createMasyuCandidateBridgeLineRule } from './rules/bridges'
import { createBlackPearlCandidatePruningRule } from './rules/candidates'
import {
  createMasyuColorLinePropagationRule,
  createMasyuColorPearlPropagationRule,
  createMasyuTileColorPropagationRule,
} from './rules/color'
import { createMasyuTileConnectivityCutColoringRule } from './rules/connectivity'
import { createCellCompletionRule, createPearlCompletionRule } from './rules/completion'
import { createPreventPrematureLoopRule } from './rules/loop'
import {
  createBlackDiagonalWhitePinchRule,
  createBlackFacingConsecutiveWhitesRule,
  createConsecutiveWhitePearlsStraightRule,
  createDoubleBlackSqueezeRule,
} from './rules/patterns'
import { createBlackCircleRule, createWhiteCircleRule } from './rules/pearls'

export const deterministicMasyuRules: Rule[] = [
  createWhiteCircleRule(),
  createBlackCircleRule(),
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
  createPearlCompletionRule(),
  createCellCompletionRule(),
]

export const masyuRules: Rule[] = [
  ...deterministicMasyuRules,
  createBlackPearlStrongInferenceRule(() => deterministicMasyuRules),
]
