import { useEffect, useState } from 'react'
import { puzzleRegistry } from '../../domain/plugins/registry'
import type { DisplaySettings } from '../solver/solverStore'

type Props = {
  pluginId: string
  displaySettings: DisplaySettings
  onSetDisplayOption: (optionId: string, enabled: boolean) => void
}

export const BoardDisplayButton = ({
  pluginId,
  displaySettings,
  onSetDisplayOption,
}: Props) => {
  const [openPluginId, setOpenPluginId] = useState<string | null>(null)
  const plugin = puzzleRegistry.get(pluginId)
  const options = plugin?.displayOptions ?? []
  const isOpen = openPluginId === pluginId
  const titleId = `${pluginId}-board-display-title`

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenPluginId(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (!plugin || options.length === 0) {
    return null
  }

  return (
    <div className="board-display-anchor">
      <button
        type="button"
        className="board-display-trigger"
        aria-label={`Show ${plugin.displayName} display options`}
        aria-expanded={isOpen}
        data-active={isOpen}
        onClick={() => setOpenPluginId((current) => (current === pluginId ? null : pluginId))}
      >
        display
      </button>
      {isOpen ? (
        <section
          className="board-display-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <header className="puzzle-info-panel-header">
            <h2 id={titleId}>Display</h2>
            <button
              type="button"
              className="panel-icon-close"
              aria-label={`Close ${plugin.displayName} display options`}
              onClick={() => setOpenPluginId(null)}
            >
              ×
            </button>
          </header>
          <div className="board-display-list">
            {options.map((option) => {
              const checked = displaySettings[option.id] ?? option.enabledByDefault
              return (
                <label key={option.id} className="board-display-row">
                  <span>
                    <strong>{option.label}</strong>
                    {option.description ? <small>{option.description}</small> : null}
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onSetDisplayOption(option.id, event.target.checked)}
                  />
                </label>
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}
