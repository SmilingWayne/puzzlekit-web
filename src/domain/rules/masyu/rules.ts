import type { Rule } from '../types'
import { createCellCompletionRule } from './rules/completion'
import { createBlackCircleRule, createWhiteCircleRule } from './rules/pearls'

export const masyuRules: Rule[] = [
  createWhiteCircleRule(),
  createBlackCircleRule(),
  createCellCompletionRule(),
]
