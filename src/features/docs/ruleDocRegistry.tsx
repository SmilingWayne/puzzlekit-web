import type { ComponentType } from 'react'
import BlackPearlRuleDoc from '../../../docs/content/masyu/rules/black-pearl-rule.mdx'
import WhitePearlRuleDoc from '../../../docs/content/masyu/rules/white-pearl-rule.mdx'
import AdjacentThreesRuleDoc from '../../../docs/content/slitherlink/rules/adjacent-threes.mdx'
import AdjacentTwoThreeOppositeCrossRuleDoc from '../../../docs/content/slitherlink/rules/adjacent-two-three-opposite-cross.mdx'
import CellClueCompletionRuleDoc from '../../../docs/content/slitherlink/rules/cell-clue-completion.mdx'
import DiagonalThreesRuleDoc from '../../../docs/content/slitherlink/rules/diagonal-threes.mdx'
import VertexDegreeRuleDoc from '../../../docs/content/slitherlink/rules/vertex-degree.mdx'
import { puzzleRegistry } from '../../domain/plugins/registry'
import type { Rule } from '../../domain/rules/types'
import { DraftRuleContent } from './DraftRuleContent'
import { ruleExamples, type RuleExampleData } from './ruleExamples'

export type RuleDocStatus = 'documented' | 'draft' | 'missing'

export type RuleDocEntry = {
  puzzleId: string
  ruleId: string
  title: string
  summary: string
  category: string
  content: ComponentType
  status: RuleDocStatus
  example?: RuleExampleData
}

const documentedContent: Record<
  string,
  { content: ComponentType; summary: string }
> = {
  'masyu:white-pearl-rule': {
    content: WhitePearlRuleDoc,
    summary:
      'Keeps a white pearl straight while preserving its required adjacent turn.',
  },
  'masyu:black-pearl-rule': {
    content: BlackPearlRuleDoc,
    summary:
      'Forces a turn on a black pearl and straight continuation after each exit.',
  },
  'slitherlink:vertex-degree': {
    content: VertexDegreeRuleDoc,
    summary:
      'Maintains the loop degree of zero or two at every Slitherlink vertex.',
  },
  'slitherlink:contiguous-three-run-boundaries': {
    content: AdjacentThreesRuleDoc,
    summary: 'Draws the forced repeating line pattern around adjacent 3 clues.',
  },
  'slitherlink:diagonal-adjacent-three-outer-corners': {
    content: DiagonalThreesRuleDoc,
    summary:
      'Draws the four forced outer-corner edges of diagonally adjacent 3 clues.',
  },
  'slitherlink:cell-count-completion': {
    content: CellClueCompletionRuleDoc,
    summary:
      'Completes or blanks every remaining unknown edge around a numbered clue when the clue count is already determined.',
  },
  'slitherlink:adjacent-two-three-opposite-cross': {
    content: AdjacentTwoThreeOppositeCrossRuleDoc,
    summary:
      "When a 2's far-side edge is crossed out beside a 3, forces the 3's opposite line and blanks the shared-side extensions.",
  },
}

const getCategory = (rule: Rule): string => {
  if (
    rule.id.includes('strong') ||
    rule.id.includes('assumption') ||
    rule.id.includes('parity-inference')
  ) {
    return 'Bounded Inference'
  }
  if (rule.id.includes('color') || rule.id.includes('tile')) {
    return 'Color and Region Reasoning'
  }
  if (rule.id.includes('sector') || rule.id.includes('vertex')) {
    return 'Sector and Vertex Reasoning'
  }
  if (
    rule.id.includes('pearl') ||
    rule.id.includes('white') ||
    rule.id.includes('black')
  ) {
    return 'Pearl Techniques'
  }
  if (
    rule.id.includes('loop') ||
    rule.id.includes('bridge') ||
    rule.id.includes('connectivity')
  ) {
    return 'Loop and Connectivity'
  }
  return 'Core Techniques'
}

export const getRuleDocPath = (puzzleId: string, ruleId: string): string =>
  `/docs/${encodeURIComponent(puzzleId)}/rules/${encodeURIComponent(ruleId)}`

export const ruleDocEntries: RuleDocEntry[] = puzzleRegistry
  .all()
  .flatMap((plugin) =>
    plugin.getRules().map((rule) => {
      const key = `${plugin.id}:${rule.id}`
      const documented = documentedContent[key]
      return {
        puzzleId: plugin.id,
        ruleId: rule.id,
        title: rule.name,
        summary:
          documented?.summary ??
          'A registered PuzzleKit solver technique. Detailed documentation is being prepared.',
        category: getCategory(rule),
        content: documented?.content ?? DraftRuleContent,
        status: documented ? 'documented' : 'draft',
        example: ruleExamples[key],
      } satisfies RuleDocEntry
    }),
  )

export const getRuleDocEntry = (
  puzzleId: string,
  ruleId: string,
): RuleDocEntry | undefined =>
  ruleDocEntries.find(
    (entry) => entry.puzzleId === puzzleId && entry.ruleId === ruleId,
  )
