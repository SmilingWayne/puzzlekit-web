import type { PuzzleIR } from '../../../ir/types'
import type { Rule, RuleApplication } from '../../types'
import {
  createMasyuLineDecisionCollector,
  type MasyuLineDecisionCollector,
} from './decisionCollector'
import {
  getMasyuBlackPearlKeys,
  getMasyuWhitePearlKeys,
} from './pearlSelectors'
import {
  MASYU_DIRECTIONS,
  areMasyuDirectionsOpposite,
  areMasyuDirectionsTurn,
  canMasyuLineBeAddedWithoutDegreeOverflow,
  collectMasyuLineDecision,
  collectMasyuLineDecisionWithoutDegreeOverflow,
  formatMasyuCellKeyLabel,
  formatMasyuLineLabel,
  getMasyuDirectionalLine,
  getMasyuTurnCandidateLines,
  getMasyuTwoStepLine,
  isMasyuLineAvailable,
  oppositeMasyuDirection,
  getMasyuIncidentDirectionalLines,
  type MasyuDirection,
} from './shared'

type Axis = [MasyuDirection, MasyuDirection]

const PEARL_AXES: Axis[] = [
  ['N', 'S'],
  ['E', 'W'],
]

const getOppositeAxis = (axis: Axis): Axis =>
  axis[0] === 'N' ? ['E', 'W'] : ['N', 'S']

const isWhiteAxisBlocked = (
  puzzle: PuzzleIR,
  pearlKey: string,
  axis: Axis,
): boolean =>
  axis
    .map((direction) => getMasyuDirectionalLine(puzzle, pearlKey, direction))
    .some(
      (item) =>
        !item ||
        !isMasyuLineAvailable(item) ||
        !canMasyuLineBeAddedWithoutDegreeOverflow(puzzle, item.lineKey),
    )

const canWhiteAxisSideTurn = (
  puzzle: PuzzleIR,
  pearlKey: string,
  direction: MasyuDirection,
): boolean => {
  const { first, second } = getMasyuTwoStepLine(puzzle, pearlKey, direction)
  if (!isMasyuLineAvailable(first) || !first || second?.mark === 'line') {
    return false
  }
  return getMasyuTurnCandidateLines(puzzle, first.neighborKey, direction).some(
    (candidate) => {
      if (!isMasyuLineAvailable(candidate)) {
        return false
      }
      const decisions = new Map<string, 'line' | 'blank'>()
      if (
        !collectMasyuLineDecisionWithoutDegreeOverflow(
          decisions,
          puzzle,
          first.lineKey,
          'line',
        )
      ) {
        return false
      }
      if (
        second &&
        !collectMasyuLineDecision(decisions, puzzle, second.lineKey, 'blank')
      ) {
        return false
      }
      return collectMasyuLineDecisionWithoutDegreeOverflow(
        decisions,
        puzzle,
        candidate.lineKey,
        'line',
      )
    },
  )
}

const isWhiteAxisTurnBlocked = (
  puzzle: PuzzleIR,
  pearlKey: string,
  axis: Axis,
): boolean =>
  axis.every((direction) => !canWhiteAxisSideTurn(puzzle, pearlKey, direction))

const isBlackExitAvailable = (
  puzzle: PuzzleIR,
  pearlKey: string,
  direction: MasyuDirection,
): boolean => {
  const { first, second } = getMasyuTwoStepLine(puzzle, pearlKey, direction)
  return isMasyuLineAvailable(first) && isMasyuLineAvailable(second)
}

const collectNewMasyuLineDecision = (
  decisions: MasyuLineDecisionCollector,
  key: string,
  to: 'line' | 'blank',
): boolean => {
  return decisions.addNew(key, to)
}

const collectNewMasyuLineDecisionWithoutDegreeOverflow = (
  decisions: MasyuLineDecisionCollector,
  key: string,
  to: 'line' | 'blank',
): boolean => {
  return to === 'line' ? decisions.addNew(key, to) : decisions.addNew(key, to)
}

export const createWhiteCircleRule = (): Rule => ({
  id: 'white-circle-rule',
  name: 'White Circle Rule',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decisions = createMasyuLineDecisionCollector(puzzle, {
      guardLineDegree: true,
    })
    const affectedCells = new Set<string>()
    let firstPearl: string | null = null
    let firstLine: string | null = null
    let firstReason: string | null = null

    for (const pearlKey of getMasyuWhitePearlKeys(puzzle)) {
      const incident = getMasyuIncidentDirectionalLines(puzzle, pearlKey)
      const lineEntries = MASYU_DIRECTIONS.flatMap((direction) => {
        const item = incident[direction]
        return item?.mark === 'line' ? [item] : []
      })
      const lineDirections = lineEntries.map((item) => item.direction)

      for (const axis of PEARL_AXES) {
        if (!axis.every((direction) => incident[direction]?.mark === 'line')) {
          continue
        }
        for (const straightSide of axis) {
          const turnSide = oppositeMasyuDirection(straightSide)
          const straightExtension = getMasyuTwoStepLine(
            puzzle,
            pearlKey,
            straightSide,
          ).second
          const turnExtension = getMasyuTwoStepLine(
            puzzle,
            pearlKey,
            turnSide,
          ).second
          if (straightExtension?.mark !== 'line' || !turnExtension) {
            continue
          }
          if (
            collectNewMasyuLineDecision(
              decisions,
              turnExtension.lineKey,
              'blank',
            )
          ) {
            affectedCells.add(pearlKey)
            if (firstPearl === null) {
              firstPearl = pearlKey
              firstLine = turnExtension.lineKey
              firstReason =
                'must turn in an adjacent cell; one side already goes straight for two segments, so the other side cannot continue straight'
            }
          }
        }
      }

      if (lineEntries.length === 1) {
        const straightDirection = oppositeMasyuDirection(
          lineEntries[0].direction,
        )
        let addedAny = false
        for (const direction of MASYU_DIRECTIONS) {
          const item = incident[direction]
          if (!item) {
            continue
          }
          const mark = direction === straightDirection ? 'line' : 'blank'
          if (
            collectNewMasyuLineDecisionWithoutDegreeOverflow(
              decisions,
              item.lineKey,
              mark,
            )
          ) {
            addedAny = true
            if (firstLine === null) {
              firstLine = item.lineKey
            }
          }
        }
        if (addedAny) {
          affectedCells.add(pearlKey)
          if (firstPearl === null) {
            firstPearl = pearlKey
            firstReason = 'must go straight through the pearl'
          }
        }
        continue
      }

      if (lineEntries.length === 2) {
        if (!areMasyuDirectionsOpposite(lineDirections[0], lineDirections[1])) {
          continue
        }
        let addedAny = false
        for (const direction of MASYU_DIRECTIONS) {
          if (lineDirections.includes(direction)) {
            continue
          }
          const item = incident[direction]
          if (
            item &&
            collectNewMasyuLineDecision(decisions, item.lineKey, 'blank')
          ) {
            addedAny = true
            if (firstLine === null) {
              firstLine = item.lineKey
            }
          }
        }
        if (addedAny) {
          affectedCells.add(pearlKey)
          if (firstPearl === null) {
            firstPearl = pearlKey
            firstReason =
              'must go straight through the pearl, so turn candidates are blank'
          }
        }
        continue
      }

      const unavailableAxes = PEARL_AXES.filter(
        (axis) =>
          isWhiteAxisBlocked(puzzle, pearlKey, axis) ||
          isWhiteAxisTurnBlocked(puzzle, pearlKey, axis),
      )
      if (unavailableAxes.length !== 1) {
        continue
      }

      const blockedAxis = unavailableAxes[0]
      const straightAxis = getOppositeAxis(blockedAxis)
      let addedAny = false

      for (const direction of blockedAxis) {
        const item = getMasyuDirectionalLine(puzzle, pearlKey, direction)
        if (
          item &&
          collectNewMasyuLineDecision(decisions, item.lineKey, 'blank')
        ) {
          addedAny = true
          if (firstLine === null) {
            firstLine = item.lineKey
          }
        }
      }
      for (const direction of straightAxis) {
        const item = getMasyuDirectionalLine(puzzle, pearlKey, direction)
        if (
          item &&
          collectNewMasyuLineDecisionWithoutDegreeOverflow(
            decisions,
            item.lineKey,
            'line',
          )
        ) {
          addedAny = true
          if (firstLine === null) {
            firstLine = item.lineKey
          }
        }
      }
      if (addedAny) {
        affectedCells.add(pearlKey)
        if (firstPearl === null) {
          firstPearl = pearlKey
          firstReason = 'has a blocked axis and must use the other axis'
        }
      }
    }

    if (!decisions.hasChanges()) {
      return null
    }

    const diffs = decisions.diffs()
    return {
      message:
        firstPearl && firstLine
          ? `White pearl ${formatMasyuCellKeyLabel(firstPearl)} ${firstReason ?? 'forces a local decision'}, so ${formatMasyuLineLabel(firstLine)} is decided${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`
          : 'White circle rule applied.',
      diffs,
      affectedCells: [...affectedCells],
      affectedLines: diffs.map((diff) => diff.lineKey),
    }
  },
})

export const createBlackCircleRule = (): Rule => ({
  id: 'black-circle-rule',
  name: 'Black Circle Rule',
  apply: (puzzle: PuzzleIR): RuleApplication | null => {
    const decisions = createMasyuLineDecisionCollector(puzzle)
    const affectedCells = new Set<string>()
    let firstPearl: string | null = null
    let firstLine: string | null = null

    for (const pearlKey of getMasyuBlackPearlKeys(puzzle)) {
      const incident = getMasyuIncidentDirectionalLines(puzzle, pearlKey)
      const lineEntries = MASYU_DIRECTIONS.flatMap((direction) => {
        const item = incident[direction]
        return item?.mark === 'line' ? [item] : []
      })
      const lineDirections = lineEntries.map((item) => item.direction)

      if (lineEntries.length === 1) {
        const lineDirection = lineEntries[0].direction
        const opposite = incident[oppositeMasyuDirection(lineDirection)]
        let addedAny = false
        if (
          opposite &&
          collectNewMasyuLineDecision(decisions, opposite.lineKey, 'blank')
        ) {
          addedAny = true
          if (firstLine === null) {
            firstLine = opposite.lineKey
          }
        }
        const extension = getMasyuTwoStepLine(
          puzzle,
          pearlKey,
          lineDirection,
        ).second
        if (
          extension &&
          collectNewMasyuLineDecision(decisions, extension.lineKey, 'line')
        ) {
          addedAny = true
          if (firstLine === null) {
            firstLine = extension.lineKey
          }
        }
        if (addedAny) {
          affectedCells.add(pearlKey)
          if (firstPearl === null) {
            firstPearl = pearlKey
          }
        }
        continue
      }

      if (lineEntries.length === 2) {
        if (!areMasyuDirectionsTurn(lineDirections[0], lineDirections[1])) {
          continue
        }
        let addedAny = false
        for (const direction of MASYU_DIRECTIONS) {
          if (lineDirections.includes(direction)) {
            continue
          }
          const item = incident[direction]
          if (
            item &&
            collectNewMasyuLineDecision(decisions, item.lineKey, 'blank')
          ) {
            addedAny = true
            if (firstLine === null) {
              firstLine = item.lineKey
            }
          }
        }
        for (const direction of lineDirections) {
          const extension = getMasyuTwoStepLine(
            puzzle,
            pearlKey,
            direction,
          ).second
          if (
            extension &&
            collectNewMasyuLineDecision(decisions, extension.lineKey, 'line')
          ) {
            addedAny = true
            if (firstLine === null) {
              firstLine = extension.lineKey
            }
          }
        }
        if (addedAny) {
          affectedCells.add(pearlKey)
          if (firstPearl === null) {
            firstPearl = pearlKey
          }
        }
        continue
      }

      for (const direction of ['N', 'E', 'S', 'W'] as const) {
        if (isBlackExitAvailable(puzzle, pearlKey, direction)) {
          continue
        }
        const oppositeDirection = oppositeMasyuDirection(direction)
        if (!isBlackExitAvailable(puzzle, pearlKey, oppositeDirection)) {
          continue
        }

        let addedAny = false
        const blocked = getMasyuDirectionalLine(puzzle, pearlKey, direction)
        if (
          blocked &&
          collectNewMasyuLineDecision(decisions, blocked.lineKey, 'blank')
        ) {
          addedAny = true
          if (firstLine === null) {
            firstLine = blocked.lineKey
          }
        }

        const opposite = getMasyuTwoStepLine(
          puzzle,
          pearlKey,
          oppositeDirection,
        )
        for (const item of [opposite.first, opposite.second]) {
          if (
            item &&
            collectNewMasyuLineDecision(decisions, item.lineKey, 'line')
          ) {
            addedAny = true
            if (firstLine === null) {
              firstLine = item.lineKey
            }
          }
        }

        if (addedAny) {
          affectedCells.add(pearlKey)
          if (firstPearl === null) {
            firstPearl = pearlKey
          }
        }
      }
    }

    if (!decisions.hasChanges()) {
      return null
    }

    const diffs = decisions.diffs()
    return {
      message:
        firstPearl && firstLine
          ? `Black pearl ${formatMasyuCellKeyLabel(firstPearl)} must turn, so ${formatMasyuLineLabel(firstLine)} is a line${diffs.length > 1 ? ` (${diffs.length} total)` : ''}.`
          : 'Black circle rule applied.',
      diffs,
      affectedCells: [...affectedCells],
      affectedLines: diffs.map((diff) => diff.lineKey),
    }
  },
})
