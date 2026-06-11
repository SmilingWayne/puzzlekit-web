import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BenchmarkDatasetItem } from '../domain/benchmark/types'
import { puzzleRegistry } from '../domain/plugins/registry'
import { BoardLegendButton } from '../features/board/BoardLegendButton'
import { publicDatasetManifests } from '../features/dataset/publicDatasets'
import { useEditorStore } from '../features/editor/editorStore'
import { PuzzleInfoButton } from '../features/puzzleInfo/PuzzleInfoButton'
import { PuzzlePreviewBoard } from '../features/puzzlePreview/PuzzlePreviewBoard'
import { useSolverStore } from '../features/solver/solverStore'
import { WorkspaceHeader } from './WorkspaceHeader'
import './workspace.css'

type DatasetPuzzleCard = BenchmarkDatasetItem & {
  datasetId: string
  datasetTitle: string
  description: string
}

type ActivePuzzlePopover = 'rules' | 'legend' | null

const DATASET_PREVIEW_SIZE = 136

const datasetCards: DatasetPuzzleCard[] = publicDatasetManifests.flatMap(
  (manifest) =>
    manifest.items.map((item) => ({
      ...item,
      datasetId: manifest.id,
      datasetTitle: manifest.title,
      description: `${manifest.title}: ${item.height} x ${item.width} ${item.puzzleType} puzzle.`,
    })),
)

const publicDatasetPluginIds = new Set(
  datasetCards.map((item) => item.puzzleType),
)

const buildSizeLabel = (
  item: Pick<BenchmarkDatasetItem, 'height' | 'width'>,
): string => `${item.height} x ${item.width}`

const parseDatasetPuzzle = (item: BenchmarkDatasetItem) => {
  const plugin = puzzleRegistry.get(item.puzzleType)
  if (!plugin) {
    throw new Error(`Plugin "${item.puzzleType}" not found.`)
  }
  return plugin.parse(item.sourceUrl)
}

const DatasetPreview = ({ item }: { item: DatasetPuzzleCard }) => {
  const puzzle = useMemo(() => {
    try {
      return parseDatasetPuzzle(item)
    } catch {
      return null
    }
  }, [item])

  if (!puzzle) {
    return <span>{buildSizeLabel(item)}</span>
  }

  return (
    <PuzzlePreviewBoard
      puzzle={puzzle}
      label={`${item.id} dataset preview`}
      className="dataset-preview-canvas"
      width={DATASET_PREVIEW_SIZE}
      height={DATASET_PREVIEW_SIZE}
      padding={12}
      variant="compact"
    />
  )
}

export const DatasetPage = () => {
  const navigate = useNavigate()
  const loadSolverPuzzle = useSolverStore((state) => state.loadPuzzle)
  const loadEditorPuzzle = useEditorStore((state) => state.loadEditorPuzzle)
  const [pluginId, setPluginId] = useState('slitherlink')
  const [query, setQuery] = useState('')
  const [sizeFilter, setSizeFilter] = useState('all')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [activePuzzlePopover, setActivePuzzlePopover] =
    useState<ActivePuzzlePopover>(null)
  const [actionError, setActionError] = useState('')

  const pluginItems = useMemo(
    () => datasetCards.filter((item) => item.puzzleType === pluginId),
    [pluginId],
  )
  const tags = useMemo(
    () => Array.from(new Set(pluginItems.flatMap((item) => item.tags))).sort(),
    [pluginItems],
  )
  const sizeOptions = useMemo(
    () =>
      Array.from(new Set(pluginItems.map(buildSizeLabel))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    [pluginItems],
  )
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return datasetCards.filter((item) => {
      const sizeLabel = buildSizeLabel(item)
      const searchableText = [
        item.id,
        item.puzzleType,
        item.sourceUrl,
        item.datasetId,
        item.datasetTitle,
        sizeLabel,
        ...item.tags,
      ]
        .join(' ')
        .toLowerCase()
      const matchesPlugin = item.puzzleType === pluginId
      const matchesQuery =
        normalizedQuery.length === 0 || searchableText.includes(normalizedQuery)
      const matchesSize = sizeFilter === 'all' || sizeLabel === sizeFilter
      const matchesTag = activeTag === null || item.tags.includes(activeTag)
      return matchesPlugin && matchesQuery && matchesSize && matchesTag
    })
  }, [activeTag, pluginId, query, sizeFilter])

  const loadToSolver = (item: DatasetPuzzleCard) => {
    try {
      const puzzle = parseDatasetPuzzle(item)
      loadSolverPuzzle(puzzle, {
        pluginId: item.puzzleType,
        sourceUrl: item.sourceUrl,
      })
      setActionError('')
      navigate('/')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    }
  }

  const loadToEditor = (item: DatasetPuzzleCard) => {
    try {
      const puzzle = parseDatasetPuzzle(item)
      loadEditorPuzzle(puzzle, {
        sourceUrl: item.sourceUrl,
      })
      setActionError('')
      navigate('/editor')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <main className="workspace">
      <section className="workspace-grid dataset-workspace-grid">
        <div className="left-column">
          <WorkspaceHeader
            title="PuzzleKit Dataset"
            description="Browse public Slitherlink and Masyu puzzles and load them into the workspace."
            activePage="dataset"
          />
          <section
            className="panel-card dataset-list-card"
            aria-labelledby="dataset-list-title"
          >
            <header className="panel-header dataset-list-header">
              <div>
                <h2 id="dataset-list-title">Public Dataset</h2>
                <small>
                  Showing {filteredItems.length} / {datasetCards.length} puzzles
                </small>
              </div>
            </header>
            {actionError ? (
              <p className="error-text dataset-action-error">{actionError}</p>
            ) : null}
            <div className="dataset-card-list">
              {filteredItems.map((item) => (
                <article
                  key={`${item.datasetId}-${item.id}`}
                  className="dataset-puzzle-card"
                >
                  <div className="dataset-preview">
                    <DatasetPreview item={item} />
                  </div>
                  <div className="dataset-card-body">
                    <h3 title={item.description}>{item.id}</h3>
                    <span className="dataset-card-meta">
                      {buildSizeLabel(item)} · {item.puzzleType}
                    </span>
                    <div className="dataset-tags">
                      {item.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                    <div
                      className="dataset-card-actions"
                      aria-label={`${item.id} actions`}
                    >
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                        URL
                      </a>
                      <a
                        href="/"
                        onClick={(event) => {
                          event.preventDefault()
                          loadToSolver(item)
                        }}
                      >
                        Solver
                      </a>
                      <a
                        href="/editor"
                        className="dataset-primary-link"
                        onClick={(event) => {
                          event.preventDefault()
                          loadToEditor(item)
                        }}
                      >
                        Editor
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {filteredItems.length === 0 ? (
              <p className="dataset-empty">
                No dataset puzzles match the current filters.
              </p>
            ) : null}
          </section>
        </div>
        <div className="right-column">
          <section className="panel-card control-panel-card">
            <header className="panel-header">
              <h2>Dataset Controls</h2>
            </header>
            <div className="label-row type-row-wrap">
              <span className="type-row-label">Puzzle Type</span>
              <div className="type-row-controls">
                <select
                  value={pluginId}
                  onChange={(event) => {
                    setActivePuzzlePopover(null)
                    setPluginId(event.target.value)
                    setSizeFilter('all')
                    setActiveTag(null)
                  }}
                >
                  {puzzleRegistry.all().map((plugin) => {
                    const hasPublicDataset = publicDatasetPluginIds.has(
                      plugin.id,
                    )
                    return (
                      <option
                        key={plugin.id}
                        value={plugin.id}
                        disabled={!hasPublicDataset}
                      >
                        {hasPublicDataset
                          ? plugin.displayName
                          : `${plugin.displayName} (planned)`}
                      </option>
                    )
                  })}
                </select>
                <PuzzleInfoButton
                  pluginId={pluginId}
                  isOpen={activePuzzlePopover === 'rules'}
                  onToggle={() =>
                    setActivePuzzlePopover((current) =>
                      current === 'rules' ? null : 'rules',
                    )
                  }
                  onClose={() => setActivePuzzlePopover(null)}
                />
                <BoardLegendButton
                  pluginId={pluginId}
                  isOpen={activePuzzlePopover === 'legend'}
                  onToggle={() =>
                    setActivePuzzlePopover((current) =>
                      current === 'legend' ? null : 'legend',
                    )
                  }
                  onClose={() => setActivePuzzlePopover(null)}
                />
              </div>
            </div>
            <label className="label-row">
              Search Dataset
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, tag, size, type, or URL"
              />
            </label>
            <label className="label-row compact">
              Size
              <select
                value={sizeFilter}
                onChange={(event) => setSizeFilter(event.target.value)}
              >
                <option value="all">All sizes</option>
                {sizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <div className="control-group compact-control-group dataset-filter-group">
              <span className="control-group-title">Tags</span>
              <div
                className="dataset-filter-row"
                aria-label="Dataset tag filters"
              >
                <button
                  type="button"
                  data-active={activeTag === null}
                  onClick={() => setActiveTag(null)}
                >
                  All
                </button>
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    data-active={activeTag === tag}
                    onClick={() =>
                      setActiveTag((current) => (current === tag ? null : tag))
                    }
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
