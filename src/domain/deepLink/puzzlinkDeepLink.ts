import type { PuzzleIR } from '../ir/types'
import { puzzleRegistry } from '../plugins/registry'

export const PUZZLINK_DEEP_LINK_PARAM = 'p'
export const PUZZLINK_DEEP_LINK_MAX_LENGTH = 8192
export const PUZZLINK_DEEP_LINK_MAX_GRID_SIZE = 100

type SupportedDeepLinkType = 'slither' | 'mashu'

const pluginIds: Record<SupportedDeepLinkType, string> = {
  slither: 'slitherlink',
  mashu: 'masyu',
}

export type PuzzlinkDeepLinkResult =
  | { status: 'absent' }
  | {
      status: 'valid'
      payload: string
      pluginId: string
      sourceUrl: string
      puzzle: PuzzleIR
    }
  | { status: 'invalid'; message: string }

const invalid = (message: string): PuzzlinkDeepLinkResult => ({
  status: 'invalid',
  message: `Invalid PuzzleKit deep link: ${message}`,
})

const getCanonicalPayload = (url: string): string => {
  const parsed = new URL(url)
  return decodeURIComponent(parsed.search.replace(/^\?/, '')).split('&')[0] ?? ''
}

export const parsePuzzlinkDeepLink = (search: string): PuzzlinkDeepLinkResult => {
  const params = new URLSearchParams(search)
  const values = params.getAll(PUZZLINK_DEEP_LINK_PARAM)

  if (values.length === 0) {
    return { status: 'absent' }
  }
  if (values.length !== 1) {
    return invalid('provide exactly one "p" parameter.')
  }

  const payload = values[0]
  if (!payload) {
    return invalid('the "p" parameter cannot be empty.')
  }
  if (payload.length > PUZZLINK_DEEP_LINK_MAX_LENGTH) {
    return invalid(`the payload exceeds ${PUZZLINK_DEEP_LINK_MAX_LENGTH} characters.`)
  }

  const match = /^(slither|mashu)\/([1-9]\d*)\/([1-9]\d*)\/([0-9a-z.]+)$/.exec(payload)
  if (!match) {
    return invalid('expected canonical "slither/<cols>/<rows>/<body>" or "mashu/<cols>/<rows>/<body>" data.')
  }

  const type = match[1] as SupportedDeepLinkType
  const colsText = match[2]
  const rowsText = match[3]
  const cols = Number(colsText)
  const rows = Number(rowsText)
  if (
    !Number.isSafeInteger(cols) ||
    !Number.isSafeInteger(rows) ||
    cols > PUZZLINK_DEEP_LINK_MAX_GRID_SIZE ||
    rows > PUZZLINK_DEEP_LINK_MAX_GRID_SIZE
  ) {
    return invalid(`grid dimensions must not exceed ${PUZZLINK_DEEP_LINK_MAX_GRID_SIZE} x ${PUZZLINK_DEEP_LINK_MAX_GRID_SIZE}.`)
  }

  const pluginId = pluginIds[type]
  const plugin = puzzleRegistry.get(pluginId)
  if (!plugin) {
    return invalid(`puzzle plugin "${pluginId}" is unavailable.`)
  }

  const sourceUrl = `https://puzz.link/p?${payload}`
  try {
    const puzzle = plugin.parse(sourceUrl)
    const canonicalPayload = getCanonicalPayload(plugin.encode(puzzle))
    if (canonicalPayload !== payload) {
      return invalid('the payload is damaged, incomplete, or not in canonical puzz.link form.')
    }
    return { status: 'valid', payload, pluginId, sourceUrl, puzzle }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return invalid(message)
  }
}
