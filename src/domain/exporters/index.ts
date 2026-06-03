import { normalizePuzzle } from '../ir/normalize'
import { puzzleRegistry } from '../plugins/registry'
import type {
  ExportContext,
  ExportFormat,
  Exporter,
  PuzzleUrlExportFormat,
  PuzzlinkEncodeResult,
} from './types'

export const isPuzzleUrlExportFormat = (format: ExportFormat): format is PuzzleUrlExportFormat =>
  format === 'puzzlink' || format === 'pzplus' || format === 'pzprxs'

const getPuzzlinkPath = (url: string): string => {
  if (!url.includes('://')) {
    return url.replace(/^p\?/, '').split('&')[0] ?? ''
  }
  const parsed = new URL(url)
  const path = decodeURIComponent(parsed.search.replace(/^\?/, '')).split('&')[0] ?? ''
  if (path.length > 0) {
    return path
  }
  const pathTokens = parsed.pathname.split('/').filter(Boolean)
  if (pathTokens[0] === 'p') {
    return pathTokens.slice(1).join('/')
  }
  throw new Error('Could not extract puzz.link puzzle data from encoded URL.')
}

const formatPuzzleUrl = (puzzlinkUrl: string, format: PuzzleUrlExportFormat): string => {
  const path = getPuzzlinkPath(puzzlinkUrl)
  if (format === 'pzplus') {
    return `https://pzplus.tck.mn/p.html?${path}`
  }
  if (format === 'pzprxs') {
    return `https://pzprxs.vercel.app/p?${path}`
  }
  return `https://puzz.link/p?${path}`
}

export const tryEncodePuzzleUrl = (
  context: ExportContext,
  format: PuzzleUrlExportFormat,
): PuzzlinkEncodeResult => {
  const plugin = puzzleRegistry.get(context.pluginId)
  if (!plugin) {
    return { ok: false, message: `Puzzle plugin "${context.pluginId}" not found.` }
  }
  try {
    return { ok: true, url: formatPuzzleUrl(plugin.encode(context.puzzle), format) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, message }
  }
}

export const tryEncodePuzzlink = (context: ExportContext): PuzzlinkEncodeResult =>
  tryEncodePuzzleUrl(context, 'puzzlink')

const exportPuzzleUrl = (format: PuzzleUrlExportFormat) => (context: ExportContext): string => {
  const result = tryEncodePuzzleUrl(context, format)
  if (!result.ok) {
    throw new Error(result.message)
  }
  return result.url
}

const exportPenpa = ({ pluginId }: ExportContext): string =>
  `TODO: penpa export pipeline is not implemented yet for "${pluginId}".`

const exportJson = ({ puzzle }: ExportContext): string =>
  JSON.stringify(normalizePuzzle(puzzle), null, 2)

export const exporters: Exporter[] = [
  { format: 'puzzlink', label: 'puzz.link URL', export: exportPuzzleUrl('puzzlink') },
  { format: 'pzplus', label: 'pzplus URL', export: exportPuzzleUrl('pzplus') },
  { format: 'pzprxs', label: 'pzprxs URL', export: exportPuzzleUrl('pzprxs') },
  { format: 'penpa', label: 'Penpa URL', export: exportPenpa },
  { format: 'json', label: 'Custom JSON', export: exportJson },
]

export const exportPuzzle = (context: ExportContext, format: ExportFormat): string => {
  const exporter = exporters.find((item) => item.format === format)
  if (!exporter) {
    return `TODO: exporter "${format}" is not registered`
  }
  return exporter.export(context)
}
