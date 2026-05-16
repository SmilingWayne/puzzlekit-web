import type { Rule } from '../types'
import { createCellCompletionRule, createPearlCompletionRule } from './rules/completion'
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
  createPearlCompletionRule(),
  createCellCompletionRule(),
]
