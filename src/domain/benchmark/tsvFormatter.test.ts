import { describe, expect, it } from 'vitest'
import { runBenchmarkManifest } from './runner'
import { formatBenchmarkReportTsv, serializeTsv } from './tsvFormatter'
import type { BenchmarkDatasetManifest } from './types'

const manifest: BenchmarkDatasetManifest = {
  schemaVersion: 1,
  id: 'sample',
  title: 'Sample',
  puzzleType: 'slitherlink',
  items: [
    {
      id: 'slitherlink-3x3-0001',
      puzzleType: 'slitherlink',
      sourceUrl: 'https://puzz.link/p?slither/3/3/g0h',
      width: 3,
      height: 3,
      tags: [],
    },
  ],
}

describe('benchmark TSV formatter', () => {
  it('serializes stable columns, empty values, booleans, tabs, and newlines', () => {
    expect(
      serializeTsv(
        ['a', 'b', 'c', 'd'],
        [
          {
            a: true,
            b: null,
            c: 'tab\tand\n"quoted" line',
            d: 1.23456789,
          },
        ],
      ),
    ).toBe('a\tb\tc\td\ntrue\t\ttab and "quoted" line\t1.234568\n')
  })

  it('builds puzzle and long rule tables with unattempted rules', () => {
    const report = runBenchmarkManifest(manifest, {
      maxSteps: 1,
      telemetry: 'summary',
    })
    const tables = formatBenchmarkReportTsv(report)
    const puzzleLines = tables.puzzles.trimEnd().split('\n')
    const ruleLines = tables.ruleAttempts!.trimEnd().split('\n')
    const strongLines = tables.strongInference!.trimEnd().split('\n')

    expect(puzzleLines).toHaveLength(2)
    expect(puzzleLines[0]).toContain('strong_coverage')
    expect(
      ruleLines.some((line) => line.includes('\tfalse\t0\t0\t0\t0\t')),
    ).toBe(true)
    expect(strongLines).toHaveLength(4)
    expect(strongLines[1]).toContain('\tfalse\t\t\t\t\t\t\t')
  })

  it('only builds the puzzle table when telemetry is off', () => {
    const report = runBenchmarkManifest(manifest, {
      maxSteps: 1,
      telemetry: 'off',
    })
    const tables = formatBenchmarkReportTsv(report)

    expect(tables.ruleAttempts).toBeUndefined()
    expect(tables.strongInference).toBeUndefined()
    expect(tables.puzzles.split('\n')[1]).toContain('\toff\t')
  })
})
