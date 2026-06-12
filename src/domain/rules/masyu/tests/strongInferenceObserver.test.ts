import { describe, expect, it } from 'vitest'
import { cellKey, lineKey, tileKey } from '../../../ir/keys'
import { createMasyuPuzzle } from '../../../ir/masyu'
import { runNextRule } from '../../engine'
import type {
  Rule,
  RuleRuntimeContext,
  StrongInferenceCompletedEvent,
} from '../../types'
import { createBlackPearlStrongInferenceRule } from '../rules/blackPearlStrongInference'
import { createLineComponentEndpointStrongInferenceRule } from '../rules/lineComponentEndpointStrongInference'
import { createWhitePearlStrongInferenceRule } from '../rules/whitePearlStrongInference'
import { addPearl, markLine } from './testUtils'

const observe = (
  apply: (runtimeContext: RuleRuntimeContext) => unknown,
): StrongInferenceCompletedEvent[] => {
  const events: StrongInferenceCompletedEvent[] = []
  apply({
    cache: new Map(),
    solverStepNumber: 7,
    observer: {
      onStrongInferenceCompleted: (event) => events.push(event),
    },
  })
  return events
}

describe('Masyu strong inference observer', () => {
  it('reports one zero-candidate miss for each strong rule', () => {
    const puzzle = createMasyuPuzzle(3, 3)
    const rules = [
      createBlackPearlStrongInferenceRule(() => []),
      createLineComponentEndpointStrongInferenceRule(() => []),
      createWhitePearlStrongInferenceRule(() => []),
    ]

    for (const rule of rules) {
      const events = observe((runtimeContext) =>
        rule.apply(puzzle, runtimeContext),
      )
      expect(events).toEqual([
        {
          solverStepNumber: 7,
          ruleId: rule.id,
          ruleName: rule.name,
          candidateCount: 0,
          probeCount: 0,
          trialStepCount: 0,
          probeDurationMs: 0,
          outcome: 'miss',
          producedDiffCount: 0,
        },
      ])
    }
  })

  it('reports black-pearl hit, timeout, setup contradiction, and gradient retries', () => {
    const hitPuzzle = createMasyuPuzzle(5, 5)
    addPearl(hitPuzzle, 2, 2, 'black')
    markLine(hitPuzzle, lineKey([1, 1], [1, 2]), 'line')
    markLine(hitPuzzle, lineKey([1, 2], [1, 3]), 'line')
    const hitRule = createBlackPearlStrongInferenceRule(() => [])
    const hitEvents = observe((runtimeContext) =>
      hitRule.apply(hitPuzzle, runtimeContext),
    )
    expect(hitEvents).toHaveLength(1)
    expect(hitEvents[0]).toMatchObject({
      outcome: 'hit',
      probeCount: 1,
      trialStepCount: 0,
      producedDiffCount: 1,
    })

    const setupPuzzle = createMasyuPuzzle(5, 5)
    addPearl(setupPuzzle, 2, 2, 'black')
    markLine(setupPuzzle, lineKey([0, 2], [1, 2]), 'blank')
    const setupRule = createBlackPearlStrongInferenceRule(() => [], {
      maxCandidates: 1,
    })
    const setupEvents = observe((runtimeContext) =>
      setupRule.apply(setupPuzzle, runtimeContext),
    )
    expect(setupEvents[0]).toMatchObject({
      outcome: 'hit',
      probeCount: 1,
      trialStepCount: 0,
      probeDurationMs: 0,
    })

    const timeoutPuzzle = createMasyuPuzzle(5, 5)
    addPearl(timeoutPuzzle, 2, 2, 'black')
    const timeoutRule = createBlackPearlStrongInferenceRule(() => [], {
      maxMs: -1,
    })
    const timeoutEvents = observe((runtimeContext) =>
      timeoutRule.apply(timeoutPuzzle, runtimeContext),
    )
    expect(timeoutEvents[0]).toMatchObject({
      outcome: 'timeout',
      probeCount: 0,
      producedDiffCount: 0,
    })

    const retryPuzzle = createMasyuPuzzle(5, 5)
    addPearl(retryPuzzle, 2, 2, 'black')
    const targetCell = cellKey(0, 0)
    const progressingRule: Rule = {
      id: 'test-progress',
      name: 'Test Progress',
      apply: (trial) => {
        const fromFill = trial.cells[targetCell]?.fill ?? null
        return {
          message: 'progress',
          diffs: [
            {
              kind: 'cell',
              cellKey: targetCell,
              fromFill,
              toFill: fromFill === 'a' ? 'b' : 'a',
            },
          ],
          affectedCells: [targetCell],
        }
      },
    }
    const retryRule = createBlackPearlStrongInferenceRule(
      () => [progressingRule],
      { maxCandidates: 1, maxTrialSteps: 13 },
    )
    const retryEvents = observe((runtimeContext) =>
      retryRule.apply(retryPuzzle, runtimeContext),
    )
    expect(retryEvents[0]).toMatchObject({
      outcome: 'miss',
      candidateCount: 1,
      probeCount: 2,
      trialStepCount: 25,
      producedDiffCount: 0,
    })
  })

  it('reports endpoint and white-pearl hits with formal diff counts', () => {
    const endpointPuzzle = createMasyuPuzzle(3, 4)
    markLine(endpointPuzzle, lineKey([0, 0], [0, 1]), 'line')
    markLine(endpointPuzzle, lineKey([0, 2], [0, 3]), 'line')
    markLine(endpointPuzzle, lineKey([0, 2], [1, 2]), 'line')
    const endpointRule = createLineComponentEndpointStrongInferenceRule(
      () => [],
    )
    const endpointEvents = observe((runtimeContext) =>
      endpointRule.apply(endpointPuzzle, runtimeContext),
    )
    expect(endpointEvents).toHaveLength(1)
    expect(endpointEvents[0]).toMatchObject({
      outcome: 'hit',
      probeCount: 1,
      producedDiffCount: 1,
    })

    const whitePuzzle = createMasyuPuzzle(5, 5)
    addPearl(whitePuzzle, 2, 2, 'white')
    whitePuzzle.tiles[tileKey(2, 2)] = { fill: 'yellow' }
    whitePuzzle.tiles[tileKey(2, 3)] = { fill: 'yellow' }
    const whiteRule = createWhitePearlStrongInferenceRule(() => [])
    const whiteEvents = observe((runtimeContext) =>
      whiteRule.apply(whitePuzzle, runtimeContext),
    )
    expect(whiteEvents).toHaveLength(1)
    expect(whiteEvents[0]).toMatchObject({
      outcome: 'hit',
      candidateCount: 1,
      probeCount: 1,
      producedDiffCount: 4,
    })
  })

  it('keeps internal trial attempts unobserved and isolates observer errors', () => {
    const puzzle = createMasyuPuzzle(5, 5)
    addPearl(puzzle, 2, 2, 'black')
    const north = lineKey([1, 2], [2, 2])
    const west = lineKey([1, 1], [1, 2])
    const east = lineKey([1, 2], [1, 3])
    const downstreamRule: Rule = {
      id: 'test-downstream',
      name: 'Test Downstream',
      apply: (trial) =>
        trial.lines[north]?.mark === 'line'
          ? {
              message: 'contradiction',
              diffs: [
                { kind: 'line', lineKey: west, from: 'unknown', to: 'line' },
                { kind: 'line', lineKey: east, from: 'unknown', to: 'line' },
              ],
              affectedCells: [],
            }
          : null,
    }
    const strongRule = createBlackPearlStrongInferenceRule(() => [
      downstreamRule,
    ])
    const ruleAttempts: string[] = []
    const strongEvents: StrongInferenceCompletedEvent[] = []

    const observed = runNextRule(puzzle, [strongRule], 9, {
      observer: {
        onRuleAttemptCompleted: (event) => ruleAttempts.push(event.ruleId),
        onStrongInferenceCompleted: (event) => strongEvents.push(event),
      },
    })
    const throwing = runNextRule(puzzle, [strongRule], 9, {
      observer: {
        onRuleAttemptCompleted: () => {
          throw new Error('rule observer failed')
        },
        onStrongInferenceCompleted: () => {
          throw new Error('strong observer failed')
        },
      },
    })

    expect(ruleAttempts).toEqual([strongRule.id])
    expect(strongEvents).toHaveLength(1)
    expect(strongEvents[0]).toMatchObject({
      solverStepNumber: 9,
      ruleId: strongRule.id,
      outcome: 'hit',
      trialStepCount: 1,
    })
    expect(throwing.step?.diffs).toEqual(observed.step?.diffs)
    expect(throwing.nextPuzzle).toEqual(observed.nextPuzzle)
  })
})
