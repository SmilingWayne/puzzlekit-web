import { describe, expect, it } from 'vitest'
import masyuRaw from '../../../dataset/public/masyu.json?raw'
import { analyzeMasyuCompletion } from './masyu/completion'
import { deterministicMasyuRules } from './masyu/rules'
import { decodeMasyuFromPuzzlink } from '../parsers/puzzlink'
import { runNextRule } from './engine'
import { createRuleAttemptSummaryCollector } from './ruleAttemptSummaryCollector'
import type { BenchmarkDatasetManifest } from '../benchmark/types'
import type { RuleStep, SolverObserver } from './types'

const caseIds = ['masyu-20x20-8268975', 'masyu-25x25-988309']
const manifest = JSON.parse(masyuRaw) as BenchmarkDatasetManifest

const normalizeAttempts = (step: RuleStep) =>
  step.ruleAttempts?.map(({ ruleId, ruleName, hit }) => ({
    ruleId,
    ruleName,
    hit,
  }))

const solveDeterministically = (
  sourceUrl: string,
  observer?: SolverObserver,
) => {
  let puzzle = decodeMasyuFromPuzzlink(sourceUrl)
  const steps: RuleStep[] = []
  const ruleUsage: Record<string, number> = {}
  const ruleSteps: Record<string, number[]> = {}

  while (true) {
    const result = runNextRule(
      puzzle,
      deterministicMasyuRules,
      steps.length + 1,
      { observer },
    )
    if (!result.step) {
      return {
        puzzle,
        steps,
        ruleUsage,
        ruleSteps,
        terminal: analyzeMasyuCompletion(puzzle),
      }
    }

    puzzle = result.nextPuzzle
    steps.push(result.step)
    ruleUsage[result.step.ruleId] = (ruleUsage[result.step.ruleId] ?? 0) + 1
    ruleSteps[result.step.ruleId] = [
      ...(ruleSteps[result.step.ruleId] ?? []),
      steps.length,
    ]
  }
}

describe.each(caseIds)('rule attempt observer contract: %s', (caseId) => {
  it('preserves deterministic solve behavior and produces a consistent summary', () => {
    const item = manifest.items.find((candidate) => candidate.id === caseId)
    expect(item).toBeDefined()

    const baseline = solveDeterministically(item!.sourceUrl)
    const collector = createRuleAttemptSummaryCollector()
    const observed = solveDeterministically(item!.sourceUrl, collector.observer)
    const summary = collector.getSummary()

    expect(observed.puzzle).toEqual(baseline.puzzle)
    expect(observed.terminal).toEqual(baseline.terminal)
    expect(observed.steps.map((step) => step.ruleId)).toEqual(
      baseline.steps.map((step) => step.ruleId),
    )
    expect(observed.steps.map((step) => step.diffs)).toEqual(
      baseline.steps.map((step) => step.diffs),
    )
    expect(observed.steps.map(normalizeAttempts)).toEqual(
      baseline.steps.map(normalizeAttempts),
    )
    expect(observed.ruleUsage).toEqual(baseline.ruleUsage)
    expect(observed.ruleSteps).toEqual(baseline.ruleSteps)

    const ruleSummaries = Object.values(summary.rules)
    expect(
      ruleSummaries.reduce((total, rule) => total + rule.attemptCount, 0),
    ).toBe(summary.totalAttemptCount)
    expect(
      ruleSummaries.reduce((total, rule) => total + rule.hitCount, 0),
    ).toBe(observed.steps.length)
    expect(
      ruleSummaries.reduce((total, rule) => total + rule.producedDiffCount, 0),
    ).toBe(observed.steps.reduce((total, step) => total + step.diffs.length, 0))
    expect(
      ruleSummaries.every(
        (rule) =>
          rule.totalDurationMs >= 0 &&
          rule.hitDurationMs >= 0 &&
          rule.missDurationMs >= 0 &&
          rule.averageDurationMs >= 0,
      ),
    ).toBe(true)
    expect(summary.finalNoHitScan?.solverStepNumber).toBe(
      observed.steps.length + 1,
    )
    expect(summary.finalNoHitScan?.rules.map((rule) => rule.ruleId)).toEqual(
      deterministicMasyuRules.map((rule) => rule.id),
    )
    expect(summary.finalNoHitScan?.attemptCount).toBe(
      deterministicMasyuRules.length,
    )
  }, 20_000)
})
