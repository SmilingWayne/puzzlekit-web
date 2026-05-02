import { deflateSync, strToU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { decodeSlitherFromPuzzlink } from '../puzzlink'
import { decodeSlitherFromPenpa, parsePenpaInput } from './index'
import { slitherPlugin } from '../../plugins/slitherPlugin'
import type { PuzzleIR } from '../../ir/types'

const CASES: Record<string, { penpa: string; puzzlink: string }> = {
  slitherlink_1: {
    penpa: 'm=edit&p=7VdfT+M4EH/nU5z8utY1tpvEjbQ6lQIrIeDggONoVaH8a5uSNt0kpSiI774zLlVttyDdrXTiYRVlNPOb8fxzM3ar78uwTCmTlDlUSOpQBo/POW0D1nYd9W6em6zO0+A32l3Wk6IEZlLXiypotRbLpt/0f8+z+WNr8UeVZ/UkLVtMtpjTGkfxmCfjJEl8kXCZJCsuHN9jnEmXCR5l8TSeR9MwE4JJn3EhfSFEsoo8njAviZJozOJxHFL658kJHYV5ldLT++nh0WN3ddz9p+X2hbi9GH2ZHl3dTpO7v9mVk7VK5yKX8/PLo8P8y7emfz7pPqXHqXdZFfEkT8MkbPp3p8/5/ESOJyPWO5305CicO9V3edN5Orz6+vVg8Fb08OCl6QRNlzbfggERhBIGLydD2lwFL815QOJiFmWENtegJ5QNKZkt8zqLi7woyQZrzoCDlRzY4y17p/TI9dYgc4C/eOOBvQc2zso4Tx/O1shlMGhuKMEEDtVqZMmseEoxGCaH8jopAKKwhk2rJtmCUAGKapkUj8s3UzZ8pU33P5QBnjZlILsuA7k9ZWB1P11GmozT5z0VdIavr7BDf0END8EAy7ndsnLLXgcvQC+CF9L2YSn+ymE5eHMdEPlWbJuiC6LYih1D9LgpmloftVtXPnrWtKZnX5rGpivJTNF0xZgZiTFh6dEeP+2NjLF1e7MljGF0TeZmj+DTtfRmHxi34nHPssd4ur1ZPONWfIGypm+jP032rHw89KfFV83V4lndZRLr09Zb7WYS+6nFk9g/3d7KR1r1SSt+x+pnx+pfx9q/jrXfHfO3wznab/PhVr+51V+u+qutFxhfsxeWP2HFE+hP07ctfdvSu5Z/1+wnd7Ffmuxhfzb7B58tUx/vvaIninJFb+Dbpo1Q9EhRR1FX0TNlc6zonaI9RduKesrGx+nwr+bH/5DOoO2pY/jjx/1l87M2w4MBuV6WozBO4bzpFbNFUWV1SuDMJ1WRP1Rr3UP6HMY1CdZ3D11jYPPlLErhqNSgvCgWcCna52GjMsBsPC/KdK8KQTwE33GFqj2uoqJMrJxWYZ6btag7oAGtj2oDqks4hzU5LMtiZSCzsJ4YgHb1MDylc6uZdWimGD6GVrTZth2vB+SZqBdGDgyNXxe0z39Bw91yPtuY/WzpqB96UX4wdbZKG94zewD9YPxo2n34O5NG09r4zljBZHcnC6B7hgug9nwBaHfEALgzZQB7Z9CgV3vWYFb2uMFQOxMHQ+lDZ0De/tbin1wyPPgB',
    puzzlink:'https://puzz.link/p?slither/18/10/gbcg2dgddd73d28ddw2307612185132bicjcnbjai3318712387333dwb62d16dbdbg1cgca',
  },
  slitherlink_2: {
    penpa:'m=edit&p=7VZbb+I8EH3nV3zya63NraQhUrXiWqlq2bKlyxaEkAOGpBhMc2lREP+9YwMiDmml7kqf+rCKMpw5Y49nHPuI6DkhIcVlbGPLwTo24DFNB5u2Db+6fA9PN4gZdf/D1ST2eQjAj+NV5GraKkn7af8bC5ZzbfU9YkHs01Ara7ZmejNP9zzfM8hkZngY/2i18JSwiOLrx6daY159bVZ/a+W+ZT20p2dPjc7D06T3y+jogRbqbeYsb+8aNXZ2lfZv/eoLbVL7LuJjn1EyIWm/d71my5Yz86dG/dqvO1Oy1KNnp1t5qXUuL0uDfeXD0iatuGkVp1fuAFkIIwNeEw1x2nE36a2LxnzhBQin9xBH2BhitEhYHIw54yE6cOkNIJhpAmweYU/GBarvSEMH3N5jgI8Ax0E4ZnR0s2Pu3EHaxUgUUJOzBUQL/kLFYqI44e+KAsIjMex85AcrhC0IRMmEz5P9UGO4xWn1D9qATIc2BNy1IVBBG6K7v26DTmZ0XdBBZbjdwhf6CT2M3IFo5+EInSO8dzdg2+4GmTpMNeGownTIZhrgipO7dyuKa5ngipO9dy0lei5SZVx1btlW3QsllS3mWkfXUQbb2VRQuCHLf5S2Ja0pbRe6w6klbUNaXdqytDdyTFPanrR1ac+lteWYC7E/n9rB/6GcASiH6F485c+iYWmA7pNwSsYUTlGdL1Y8CmKK4CajiLNRtIuN6JqMY+TuFCUbUbhlsvAoXIAMxThfgV4VZTiEFDKYLXlIC0OCFEf7nVQiVJDK4+EkV9MrYUztRYqzQu0uoELFIdyujE/CkL8qzILEvkJkBEXJRJe5zYyJWiKZk9xqi+N2bEtojeQLlwJu5z/Z/fqyK76W/tWk46uVIw86Dz9QnWMwTxdoD7AfyE8mWsS/ozSZaJ4/kRVR7KmyAFsgLsDm9QWoU4kB8kRlgHtHaETWvNaIqvJyI5Y6URyxVFZ0Bmj/j1P8/0TD0hs=',
    puzzlink: 'https://puzz.link/p?slither/5/6/2bgb0bbhb1adg1b',
  },
  slitherlink_3: {
    penpa:'https://swaroopg92.github.io/penpa-edit/#m=edit&p=7VdtT+NIDP7eX3Garzu6xkmbppFWp1JgJQQcHLAcrSqUpFMSSDslL4CC+O9rT4sap2Wlu9NJnHRK49qP7YmduM+k+WMZZEqCRR/Hk/iNRwc8c9qea05rfVwmRar8X+SgLGKdoRIXxTL32+1lWY2q0a9psnhoL3/L06SIVdYGiz6PNgDYNkSxa4Md4ukChC5+2dEdRG5IEER2GEUYgKGhlvL3w0M5C9JcyaOb+739h8HzweDPdnfkOFensy/3++dX99Pr73BuJe3MOk29xcnZ/l765Vs1OokHT+pAuWe5juJUBdOgGl0fvaSLQ+8unsHwKB56s2Bh5Y/eZf9p7/zr19Z43d+k9Vr1/Wogq2/+WDhCCsDTFhNZnfuv1YkvIj0PEyGrC/QLCRMp5mVaJJFOdSbeseoYNcy0UT3YqNfGT9pwBYKF+ulaR/UG1SjJolTdHq+QM39cXUpBBeyZbFLFXD8puhgVR/aqKATCoMDnk8fJUkgHHXk51Q/lOhQmb7Ia/I02cKX3NkhdtUHajjaou3/chpreqZcdHfQnb2/4hP7AHm79MbVztVG9jXrhv6I89V9Fp4upNg40puNqHRdNmu+12eOmx80+y+1a3AQW3LWZ1+Ve1+HeDvfyIl1eZI/n9nhuj+f2Grm8ox51tDE96qhm8rvh8eA+b7/PG+zzIvtU5MYEi+7OJhosHg4WLxssXjcAdVm3yV/LB14r2LxYZJeGnz8tsPmjBoffGXAa9TpUb83ukL8W3xg7aMwdNAYPGpMHjdEDM3vvfhxtMAN+Y+QlzrysHCP3jbSM7Bp5bGIOjLw2cmhkx0jXxPToV/OXflf/UgljZ7X78KP738MmrbG4KLNZECnktqGeL3WeFErg/iJynd7mK9+tegmiQvirfa7uYdiinIcKabkGpVovca/dtcK7i4HJ3UJnaqeLQCLcD5Yi146lQp1NGzU9B2nKezGvFgxabQsMKjLk/JodZJl+Zsg8KGIG1LY5tpJaNG5mEfASg4egcbX55na8tcSLMOfYkTbuPv+/DHz6lwF6WtZnoK7PUIIZaJ39hF02zia8g2MQ/QnN1Ly78A8YpeZt4lv0QcVuMwiiO0gE0SaPILRNJQhusQliHxAKrdrkFKqqSSt0qS1moUvVyWUs1v+K6D+SmLR+AA==',
    puzzlink:'https://puzz.link/p?slither/10/10/q2111221ch6212b212611b61262cg1c6bb2121c2bcc621112bo',
  },
}

const clueMap = (puzzle: PuzzleIR): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(puzzle.cells)
      .filter(([, cell]) => cell.clue?.kind === 'number')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, cell]) => [key, cell.clue]),
  )

const expectSameSlitherClues = (penpaInput: string, puzzlinkInput: string): void => {
  const fromPenpa = decodeSlitherFromPenpa(penpaInput)
  const fromPuzzlink = decodeSlitherFromPuzzlink(puzzlinkInput)
  expect(fromPenpa.rows).toBe(fromPuzzlink.rows)
  expect(fromPenpa.cols).toBe(fromPuzzlink.cols)
  expect(clueMap(fromPenpa)).toEqual(clueMap(fromPuzzlink))
}

const makeMinimalPenpaPayload = (genre: string): string => {
  const lines = [
    'square,3,3,38,0,1,1,152,152,0,0,0,0,0,0,Title: ,Author: ,,OFF,false,',
    '[0,0,0,0]',
    '{}',
    '{"number":{"30":["1",1,"1"]}}',
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
    `["${genre}"]`,
    '',
  ]
  const compressed = deflateSync(strToU8(lines.join('\n')))
  return `m=edit&p=${btoa(String.fromCharCode(...compressed))}`
}

describe('slither Penpa parser', () => {
  it('matches the slitherlink_1 puzz.link puzzle', () => {
    const { penpa, puzzlink } = CASES.slitherlink_1
    expectSameSlitherClues(penpa, puzzlink)
  })

  it('matches the slitherlink_2 puzz.link puzzle', () => {
    const { penpa, puzzlink } = CASES.slitherlink_2
    expectSameSlitherClues(penpa, puzzlink)
  })

  it('extracts the payload from a full Penpa fragment URL for slitherlink_3', () => {
    const { penpa, puzzlink } = CASES.slitherlink_3
    expectSameSlitherClues(penpa, puzzlink)
  })

  it('lets the slither plugin import Penpa input automatically', () => {
    const { penpa, puzzlink } = CASES.slitherlink_2
    const fromPlugin = slitherPlugin.parse(penpa)
    const fromPuzzlink = decodeSlitherFromPuzzlink(puzzlink)
    expect(fromPlugin.rows).toBe(fromPuzzlink.rows)
    expect(fromPlugin.cols).toBe(fromPuzzlink.cols)
    expect(clueMap(fromPlugin)).toEqual(clueMap(fromPuzzlink))
  })

  it('normalizes raw fragment, query URL, and payload-only inputs without changing + characters', () => {
    const { penpa } = CASES.slitherlink_1
    const parsed = parsePenpaInput(penpa)
    expect(parsed.pPayload).toContain('+')
    expect(parsePenpaInput(`https://swaroopg92.github.io/penpa-edit/?m=edit&p=${parsed.pPayload}`).pPayload).toBe(
      parsed.pPayload,
    )
    expect(parsePenpaInput(`m=edit&p=${parsed.pPayload}`).pPayload).toBe(parsed.pPayload)
    expect(parsePenpaInput(parsed.pPayload).pPayload).toBe(parsed.pPayload)
  })

  it('rejects damaged payloads with a stable Penpa error', () => {
    expect(() => decodeSlitherFromPenpa('m=edit&p=not-valid-base64')).toThrow(/Invalid Penpa URL/)
  })

  it('rejects non-Slitherlink Penpa payloads', () => {
    expect(() => decodeSlitherFromPenpa(makeMinimalPenpaPayload('masyu'))).toThrow(
      /Only Slitherlink import is supported/,
    )
  })
})
