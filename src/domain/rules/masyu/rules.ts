import type { Rule } from '../types'
import { createBlackPearlCandidatePruningRule } from './rules/candidates'
import { createMasyuTileColorPropagationRule } from './rules/color'
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
  createPreventPrematureLoopRule(),
  createBlackPearlCandidatePruningRule(),
  createPearlCompletionRule(),
  createCellCompletionRule(),
]
