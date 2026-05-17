import { useMemo, useState } from 'react'
import type { PuzzleIR } from '../../domain/ir/types'
import { puzzleRegistry } from '../../domain/plugins/registry'

type Props = {
  pluginId: string
  puzzle: PuzzleIR
}

export const PuzzleStatsInfoButton = ({ pluginId, puzzle }: Props) => {
  const [isOpen, setIsOpen] = useState(false)
  const stats = useMemo(() => {
    const plugin = puzzleRegistry.get(pluginId)
    return plugin?.getStats?.(puzzle) ?? null
  }, [pluginId, puzzle])

  if (!stats) {
    return null
  }

  return (
    <span className="puzzle-stats-anchor">
      <button
        type="button"
        className="puzzle-stats-info-trigger"
        aria-label="Show puzzle stats"
        aria-describedby={`${pluginId}-puzzle-stats-panel`}
        onBlur={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        info
      </button>
      <span
        id={`${pluginId}-puzzle-stats-panel`}
        className="puzzle-stats-panel"
        role="tooltip"
        hidden={!isOpen}
      >
        <strong>{stats.title}</strong>
        <span className="puzzle-stats-summary">{stats.summary}</span>
        {stats.groups.map((group) => (
          <span className="puzzle-stats-group" key={group.title}>
            <span className="puzzle-stats-group-title">{group.title}</span>
            {group.items.map((item) => (
              <span className="puzzle-stats-row" key={item.label}>
                <span>{item.label}</span>
                <span>
                  {item.value}
                  {item.detail ? <small>{item.detail}</small> : null}
                </span>
              </span>
            ))}
          </span>
        ))}
      </span>
    </span>
  )
}
