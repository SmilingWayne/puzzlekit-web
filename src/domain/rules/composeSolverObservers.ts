import type { SolverObserver } from './types'

export const composeSolverObservers = (
  observers: Array<SolverObserver | undefined>,
): SolverObserver => {
  const activeObservers = observers.filter(
    (observer): observer is SolverObserver => observer !== undefined,
  )

  return {
    onRuleAttemptCompleted: (event) => {
      for (const observer of activeObservers) {
        try {
          observer.onRuleAttemptCompleted?.(event)
        } catch {
          // Observability must never affect solver behavior.
        }
      }
    },
    onStrongInferenceCompleted: (event) => {
      for (const observer of activeObservers) {
        try {
          observer.onStrongInferenceCompleted?.(event)
        } catch {
          // Observability must never affect solver behavior.
        }
      }
    },
  }
}
