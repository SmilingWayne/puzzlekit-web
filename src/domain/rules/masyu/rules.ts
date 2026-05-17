import type { Rule } from '../types'
import { createMasyuCandidateBridgeLineRule } from './rules/bridges'
import { createBlackPearlCandidatePruningRule } from './rules/candidates'
import { createMasyuColorLinePropagationRule, createMasyuTileColorPropagationRule } from './rules/color'
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

export const masyuRules: Rule[] = [
  createWhiteCircleRule(),
  createBlackCircleRule(),
  createBlackFacingConsecutiveWhitesRule(),
  createBlackDiagonalWhitePinchRule(),
  createConsecutiveWhitePearlsStraightRule(),
  createDoubleBlackSqueezeRule(),
  createMasyuTileColorPropagationRule(),
  createMasyuColorLinePropagationRule(),
  createMasyuTileConnectivityCutColoringRule(),
  createMasyuCandidateBridgeLineRule(),
  createPreventPrematureLoopRule(),
  createBlackPearlCandidatePruningRule(),
  createPearlCompletionRule(),
  createCellCompletionRule(),
]
