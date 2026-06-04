import { deflateSync, strToU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { cellKey } from '../../ir/keys'
import { masyuPlugin } from '../../plugins/masyuPlugin'
import { slitherPlugin } from '../../plugins/slitherPlugin'
import { decodeMasyuFromPenpa, penpaAdapter } from './index'

const MASYU_PENPA_CASE_1 =
  'https://swaroopg92.github.io/penpa-edit/#m=edit&p=7ZfdT+M4EMDf+1ec/LrWxY6bNIm0OpUCKyHg4IDjaFShtHVJIK27+QAuiP99xy6o+ZjysKeTeFhFmU5/Mx3PxPY4zb+XUSYpZ5Q7VHgUPuHqc4+6zKO+YOZ+vy6TIpXBb3RYFrHKQImLYp0HlrUuq3E1/j1NVg/W+o9llMelxZnFHUv4jLEZ812XM8F8kUwXfTYXtmszJu4FZ8xjLriIlAkffGE0+ufhIV1EaS7p0c393v7D8Olg+I/ljIW4Ol18ud8/v7qfX//Nz1liZew09VYnZ/t76Zdv1fgkHj7KA+me5WoWpzKaR9X4+ug5XR16d/GCj47ikbeIViz/7l36j3vnX7/2wrfiJr2Xyg+qIa2+BSGxCTU3JxNanQcv1UlAZmo5TQitLsBOKJ9QsizTIpmpVGXknVXHoHFCbVAPtuq1sWtttIGcgX76poN6A+osyWapvD3ekLMgrC4p0QnsmV9rlSzVo9SDwc/M901SAKZRAZOTx8maUAGGvJyrh/LNlU9eaTX8iTIg0nsZWt2UoTWkDF3dfy4DlpB8RirwJ6+vMEN/QQ23QajLudqq3la9CF5AnhrJjbwJXojgEIbDMPXUiBAY7fsYdRhKUV9Xx7U71MXooI9FGKBxPQ+jvo1SHbczGmfog4CtiXujyXHm4N5oepyhtXA+wDEehONBbLwcW3t3EzSrAMF4OX08QbM8ut4OnomDB3Fx7wE+DWaNIBjPxEcflW1mvuNtM3T12HwHRheEjc+lje062JCHZlvaRl7CrqWVMHLfSGakY+Sx8Tkw8trIkZF9I13jM9D7/qc7w/+UTgjHmD5Im5fzi2Fs0gvJRZktopmE02CklmuVJ4UkcCKTXKW3+cZ2K5+jWUGCzZtB3dJgq3I5lXCQ1VCq1FqfK0iEd1MDJncrlUnUpKGc3+0KpU1IqKnK5q2cnqI0bdZi3sQaaLNvGqjI4JSsfY+yTD01yDIq4gaovRg0IslV62EWUTPF6CFqjbbcPo7XHnkm5g4FtfUk/np9+uyvT3q22GdrlZ8tHbPQVfZB19ka2xjpPUA/aD81K8Z3dJqatc07bUUn2+0sQJHmArTdXwB1WwzATpcBtqPR6KjtXqOzarcbPVSn4+ih6k0nJPDn8t+STHo/AA=='

const pearlEntries = (puzzle: ReturnType<typeof decodeMasyuFromPenpa>) =>
  Object.entries(puzzle.cells).filter(([, cell]) => cell.clue?.kind === 'pearl')

const penpaCellIndex = (
  row: number,
  col: number,
  colsWithMargins: number,
): number => (row + 2) * (colsWithMargins + 4) + col + 2

const makeMinimalMasyuPenpaPayload = (): string => {
  const cols = 10
  const rows = 10
  const symbol = {
    [penpaCellIndex(0, 0, cols)]: [1, 'circle_L', 1],
    [penpaCellIndex(1, 1, cols)]: [8, 'circle_M', 1],
    [penpaCellIndex(2, 2, cols)]: [2, 'circle_L', 1],
    [penpaCellIndex(3, 3, cols)]: [2, 'circle_M', 1],
  }
  const lines = [
    `square,${cols},${rows},38,0,1,1,152,152,0,0,0,0,0,0,Title: ,Author: ,,OFF,false,`,
    '[0,0,0,0]',
    '{}',
    JSON.stringify({ symbol }),
    '{}',
    '[]',
    '[]',
    '{}',
    '"x"',
    '"x"',
    '[3,2,1]',
    '{}',
    '"x"',
    '0',
    '{}',
    '{}',
    '{}',
    '["masyu"]',
    '',
  ]
  const compressed = deflateSync(strToU8(lines.join('\n')))
  return `m=edit&p=${btoa(String.fromCharCode(...compressed))}`
}

describe('Masyu Penpa parser', () => {
  it('imports the Penpa sample with expected pearls', () => {
    const puzzle = decodeMasyuFromPenpa(MASYU_PENPA_CASE_1)

    expect(puzzle.puzzleType).toBe('masyu')
    expect(puzzle.source).toBe('penpa')
    expect(puzzle.rows).toBe(15)
    expect(puzzle.cols).toBe(10)
    expect(pearlEntries(puzzle)).toHaveLength(40)
    expect(puzzle.cells[cellKey(0, 1)]?.clue).toEqual({
      kind: 'pearl',
      color: 'white',
    })
    expect(puzzle.cells[cellKey(13, 5)]?.clue).toEqual({
      kind: 'pearl',
      color: 'white',
    })
    expect(puzzle.cells[cellKey(2, 5)]?.clue).toEqual({
      kind: 'pearl',
      color: 'black',
    })
    expect(puzzle.cells[cellKey(2, 8)]?.clue).toEqual({
      kind: 'pearl',
      color: 'black',
    })
    expect(puzzle.cells[cellKey(10, 3)]?.clue).toEqual({
      kind: 'pearl',
      color: 'black',
    })
  })

  it('imports circle_M and circle_L pearls', () => {
    const puzzle = decodeMasyuFromPenpa(makeMinimalMasyuPenpaPayload())

    expect(puzzle.rows).toBe(10)
    expect(puzzle.cols).toBe(10)
    expect(pearlEntries(puzzle)).toHaveLength(4)
    expect(puzzle.cells[cellKey(0, 0)]?.clue).toEqual({
      kind: 'pearl',
      color: 'white',
    })
    expect(puzzle.cells[cellKey(1, 1)]?.clue).toEqual({
      kind: 'pearl',
      color: 'white',
    })
    expect(puzzle.cells[cellKey(2, 2)]?.clue).toEqual({
      kind: 'pearl',
      color: 'black',
    })
    expect(puzzle.cells[cellKey(3, 3)]?.clue).toEqual({
      kind: 'pearl',
      color: 'black',
    })
  })

  it('lets the Masyu plugin import Penpa input automatically', () => {
    const input = makeMinimalMasyuPenpaPayload()
    const fromPlugin = masyuPlugin.parse(input)
    const fromPenpa = decodeMasyuFromPenpa(input)

    expect(fromPlugin.rows).toBe(fromPenpa.rows)
    expect(fromPlugin.cols).toBe(fromPenpa.cols)
    expect(fromPlugin.cells).toEqual(fromPenpa.cells)
  })

  it('lets the generic Penpa adapter dispatch Masyu input by genre', () => {
    expect(penpaAdapter.decode(makeMinimalMasyuPenpaPayload()).puzzleType).toBe(
      'masyu',
    )
  })

  it('keeps Slitherlink plugin Penpa import scoped to Slitherlink', () => {
    expect(() => slitherPlugin.parse(makeMinimalMasyuPenpaPayload())).toThrow(
      /Only Slitherlink import is supported/,
    )
  })
})
