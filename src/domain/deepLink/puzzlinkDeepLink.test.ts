import { describe, expect, it } from 'vitest'
import {
  PUZZLINK_DEEP_LINK_MAX_GRID_SIZE,
  parsePuzzlinkDeepLink,
} from './puzzlinkDeepLink'

const SLITHER_PAYLOAD =
  'slither/10/10/q2111221ch6212b212611b61262cg1c6bb2121c2bcc621112bo'
const MASYU_PAYLOAD = 'mashu/14/8/330000096960006ik00039a00010j0i0000220'

describe('parsePuzzlinkDeepLink', () => {
  it('does nothing when the p parameter is absent', () => {
    expect(parsePuzzlinkDeepLink('?other=value')).toEqual({ status: 'absent' })
  })

  it.each([
    [SLITHER_PAYLOAD, 'slitherlink', 10, 10],
    [MASYU_PAYLOAD, 'masyu', 8, 14],
  ])('loads canonical payload %s', (payload, pluginId, rows, cols) => {
    const result = parsePuzzlinkDeepLink(`?p=${encodeURIComponent(payload)}`)

    expect(result.status).toBe('valid')
    if (result.status !== 'valid') {
      return
    }
    expect(result.pluginId).toBe(pluginId)
    expect(result.sourceUrl).toBe(`https://puzz.link/p?${payload}`)
    expect(result.puzzle.rows).toBe(rows)
    expect(result.puzzle.cols).toBe(cols)
  })

  it.each([
    '?p=',
    '?p=slither%2F3%2F3%2Fg0h&p=mashu%2F3%2F3%2F000',
    '?p=slitherlink%2F3%2F3%2Fg0h',
    '?p=masyu%2F3%2F3%2F000',
    '?p=https%3A%2F%2Fpuzz.link%2Fp%3Fslither%2F3%2F3%2Fg0h',
    '?p=slither%2F10%2F10%2Fdsew%3F',
    `?p=slither%2F${PUZZLINK_DEEP_LINK_MAX_GRID_SIZE + 1}%2F3%2Fg0h`,
  ])('rejects invalid deep link %s', (search) => {
    expect(parsePuzzlinkDeepLink(search).status).toBe('invalid')
  })

  it('rejects a non-canonical payload that a permissive parser could decode', () => {
    const result = parsePuzzlinkDeepLink('?p=slither%2F3%2F3%2Fg0hz')

    expect(result.status).toBe('invalid')
    if (result.status === 'invalid') {
      expect(result.message).toMatch(/canonical/)
    }
  })
})
