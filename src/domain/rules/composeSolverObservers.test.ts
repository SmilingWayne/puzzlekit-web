import { describe, expect, it, vi } from 'vitest'
import { composeSolverObservers } from './composeSolverObservers'
import type { RuleAttemptEvent, StrongInferenceCompletedEvent } from './types'

const ruleAttempt: RuleAttemptEvent = {
  solverStepNumber: 1,
  ruleId: 'rule-a',
  ruleName: 'Rule A',
  durationMs: 2,
  hit: true,
  producedDiffCount: 1,
}

const strongInference: StrongInferenceCompletedEvent = {
  solverStepNumber: 1,
  ruleId: 'rule-a',
  ruleName: 'Rule A',
  candidateCount: 1,
  probeCount: 2,
  trialStepCount: 3,
  probeDurationMs: 4,
  outcome: 'hit',
  producedDiffCount: 1,
}

describe('compose solver observers', () => {
  it('fans out events in registration order', () => {
    const calls: string[] = []
    const observer = composeSolverObservers([
      {
        onRuleAttemptCompleted: () => calls.push('first-rule'),
        onStrongInferenceCompleted: () => calls.push('first-strong'),
      },
      undefined,
      {
        onRuleAttemptCompleted: () => calls.push('second-rule'),
        onStrongInferenceCompleted: () => calls.push('second-strong'),
      },
    ])

    observer.onRuleAttemptCompleted?.(ruleAttempt)
    observer.onStrongInferenceCompleted?.(strongInference)

    expect(calls).toEqual([
      'first-rule',
      'second-rule',
      'first-strong',
      'second-strong',
    ])
  })

  it('isolates observer failures', () => {
    const laterObserver = vi.fn()
    const observer = composeSolverObservers([
      {
        onRuleAttemptCompleted: () => {
          throw new Error('collector failed')
        },
      },
      { onRuleAttemptCompleted: laterObserver },
    ])

    expect(() => observer.onRuleAttemptCompleted?.(ruleAttempt)).not.toThrow()
    expect(laterObserver).toHaveBeenCalledWith(ruleAttempt)
  })
})
