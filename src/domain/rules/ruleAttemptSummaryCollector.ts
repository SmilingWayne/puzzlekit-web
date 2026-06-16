import type { RuleAttemptEvent, SolverObserver } from './types'

export type RuleAttemptRuleSummary = {
  ruleId: string
  ruleName: string
  attemptCount: number
  hitCount: number
  missCount: number
  hitRate: number
  totalDurationMs: number
  hitDurationMs: number
  missDurationMs: number
  averageDurationMs: number
  producedDiffCount: number
}

export type FinalNoHitScanRuleSummary = {
  ruleId: string
  ruleName: string
  durationMs: number
}

export type FinalNoHitScanSummary = {
  solverStepNumber: number
  totalDurationMs: number
  attemptCount: number
  rules: FinalNoHitScanRuleSummary[]
}

export type RuleAttemptSummary = {
  totalAttemptCount: number
  rules: Record<string, RuleAttemptRuleSummary>
  finalNoHitScan: FinalNoHitScanSummary | null
}

export type RuleAttemptSummaryCollector = {
  observer: SolverObserver
  getSummary: () => RuleAttemptSummary
}

type MutableRuleSummary = Omit<
  RuleAttemptRuleSummary,
  'hitRate' | 'averageDurationMs'
>

export const createRuleAttemptSummaryCollector =
  (): RuleAttemptSummaryCollector => {
    let totalAttemptCount = 0
    const rules = new Map<string, MutableRuleSummary>()
    let currentStepNumber: number | null = null
    let currentStepEvents: RuleAttemptEvent[] = []

    const observer: SolverObserver = {
      onRuleAttemptCompleted: (event) => {
        totalAttemptCount += 1
        const existing = rules.get(event.ruleId) ?? {
          ruleId: event.ruleId,
          ruleName: event.ruleName,
          attemptCount: 0,
          hitCount: 0,
          missCount: 0,
          totalDurationMs: 0,
          hitDurationMs: 0,
          missDurationMs: 0,
          producedDiffCount: 0,
        }

        existing.attemptCount += 1
        existing.totalDurationMs += event.durationMs
        existing.producedDiffCount += event.producedDiffCount
        if (event.hit) {
          existing.hitCount += 1
          existing.hitDurationMs += event.durationMs
        } else {
          existing.missCount += 1
          existing.missDurationMs += event.durationMs
        }
        rules.set(event.ruleId, existing)

        if (currentStepNumber !== event.solverStepNumber) {
          currentStepNumber = event.solverStepNumber
          currentStepEvents = []
        }
        currentStepEvents.push({ ...event })
      },
    }

    return {
      observer,
      getSummary: () => {
        const ruleSummaries = Object.fromEntries(
          Array.from(rules.entries(), ([ruleId, rule]) => [
            ruleId,
            {
              ...rule,
              hitRate:
                rule.attemptCount === 0 ? 0 : rule.hitCount / rule.attemptCount,
              averageDurationMs:
                rule.attemptCount === 0
                  ? 0
                  : rule.totalDurationMs / rule.attemptCount,
            },
          ]),
        )
        const isFinalNoHitScan =
          currentStepNumber !== null &&
          currentStepEvents.length > 0 &&
          currentStepEvents.every((event) => !event.hit)
        let finalNoHitScan: FinalNoHitScanSummary | null = null
        if (isFinalNoHitScan && currentStepNumber !== null) {
          finalNoHitScan = {
            solverStepNumber: currentStepNumber,
            totalDurationMs: currentStepEvents.reduce(
              (total, event) => total + event.durationMs,
              0,
            ),
            attemptCount: currentStepEvents.length,
            rules: currentStepEvents.map(
              ({ ruleId, ruleName, durationMs }) => ({
                ruleId,
                ruleName,
                durationMs,
              }),
            ),
          }
        }

        return {
          totalAttemptCount,
          rules: ruleSummaries,
          finalNoHitScan,
        }
      },
    }
  }
