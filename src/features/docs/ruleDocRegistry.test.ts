import { describe, expect, it } from 'vitest'
import { puzzleRegistry } from '../../domain/plugins/registry'
import {
  getRuleDocEntry,
  getRuleDocPath,
  ruleDocEntries,
} from './ruleDocRegistry'

describe('ruleDocRegistry', () => {
  it('registers every production rule exactly once', () => {
    const productionRules = puzzleRegistry
      .all()
      .flatMap((plugin) =>
        plugin.getRules().map((rule) => `${plugin.id}:${rule.id}`),
      )
    const documentedRules = ruleDocEntries.map(
      (entry) => `${entry.puzzleId}:${entry.ruleId}`,
    )

    expect(new Set(documentedRules).size).toBe(documentedRules.length)
    expect(documentedRules.sort()).toEqual(productionRules.sort())
  })

  it('resolves stable rule paths by puzzle id and rule id', () => {
    expect(getRuleDocPath('masyu', 'white-pearl-rule')).toBe(
      '/docs/masyu/rules/white-pearl-rule',
    )
    expect(getRuleDocEntry('masyu', 'white-pearl-rule')?.status).toBe(
      'documented',
    )
  })
})
