import { mkdtemp, readdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { runBenchmarkManifest } from '../src/domain/benchmark'
import {
  createRunDirectory,
  formatRunTimestamp,
  parseBenchmarkCliArgs,
  selectManifestItems,
  writeBenchmarkOutputs,
} from './benchmark-solve'
import type { BenchmarkDatasetManifest } from '../src/domain/benchmark'

const manifest: BenchmarkDatasetManifest = {
  schemaVersion: 1,
  id: 'sample',
  title: 'Sample',
  puzzleType: 'slitherlink',
  items: [
    {
      id: 'a',
      puzzleType: 'slitherlink',
      sourceUrl: 'https://puzz.link/p?slither/1/1/0',
      width: 1,
      height: 1,
      tags: [],
    },
    {
      id: 'b',
      puzzleType: 'slitherlink',
      sourceUrl: 'https://puzz.link/p?slither/1/1/1',
      width: 1,
      height: 1,
      tags: [],
    },
  ],
}

describe('benchmark solve CLI', () => {
  it('defaults to text plus TSV output', () => {
    expect(parseBenchmarkCliArgs([]).format).toBe('both')
  })

  it('parses repeatable datasets and comma-separated IDs', () => {
    expect(
      parseBenchmarkCliArgs([
        '--dataset',
        'a.json',
        '--dataset',
        'b.json',
        '--ids',
        'a,b',
        '--ids',
        'c',
        '--max-steps',
        '12',
        '--timeout-ms',
        '34',
        '--telemetry',
        'off',
        '--format',
        'both',
        '--out-dir',
        'out',
      ]),
    ).toEqual({
      datasetPaths: ['a.json', 'b.json'],
      ids: ['a', 'b', 'c'],
      maxSteps: 12,
      timeoutMs: 34,
      telemetry: 'off',
      format: 'both',
      outDir: 'out',
    })
  })

  it('rejects invalid values and unknown options', () => {
    expect(() => parseBenchmarkCliArgs(['--max-steps', '0'])).toThrow(
      '--max-steps must be a positive integer',
    )
    expect(() => parseBenchmarkCliArgs(['--telemetry', 'details'])).toThrow(
      '--telemetry must be one of off, summary',
    )
    expect(() => parseBenchmarkCliArgs(['--unknown'])).toThrow(
      'Invalid benchmark arguments',
    )
  })

  it('filters manifests and rejects duplicate or unmatched selections', () => {
    expect(
      selectManifestItems([manifest], ['b'])[0].items.map((item) => item.id),
    ).toEqual(['b'])
    expect(() => selectManifestItems([manifest], ['missing'])).toThrow(
      'No puzzles matched',
    )
    expect(() => selectManifestItems([manifest, { ...manifest }], [])).toThrow(
      'Duplicate dataset ID',
    )
  })

  it('formats local timestamps and avoids overwriting same-second runs', async () => {
    const outDir = await mkdtemp(path.join(os.tmpdir(), 'benchmark-output-'))
    const timestamp = formatRunTimestamp(new Date(2026, 5, 12, 19, 45, 7))

    expect(timestamp).toBe('20260612-194507')
    expect(
      path.basename(await createRunDirectory(outDir, 'sample', timestamp)),
    ).toBe(timestamp)
    expect(
      path.basename(await createRunDirectory(outDir, 'sample', timestamp)),
    ).toBe(`${timestamp}-2`)
  })

  it('writes only the files selected by each format', async () => {
    const outDir = await mkdtemp(path.join(os.tmpdir(), 'benchmark-output-'))
    const report = runBenchmarkManifest(manifest, {
      maxSteps: 1,
      telemetry: 'summary',
    })
    const expected = {
      both: [
        'puzzles.tsv',
        'rule-attempts.tsv',
        'strong-inference.tsv',
        'summary.txt',
      ],
      text: ['summary.txt'],
      tsv: ['puzzles.tsv', 'rule-attempts.tsv', 'strong-inference.tsv'],
      json: ['report.json'],
    } as const

    for (const format of ['both', 'text', 'tsv', 'json'] as const) {
      const timestamp = `20260612-19450${Object.keys(expected).indexOf(format)}`
      await writeBenchmarkOutputs(report, { format, outDir }, timestamp)
      expect(
        (
          await readdir(path.join(outDir, report.run.datasetId, timestamp))
        ).sort(),
      ).toEqual([...expected[format]].sort())
    }
  })

  it('writes only puzzles.tsv when TSV telemetry is off', async () => {
    const outDir = await mkdtemp(path.join(os.tmpdir(), 'benchmark-output-'))
    const report = runBenchmarkManifest(manifest, {
      maxSteps: 1,
      telemetry: 'off',
    })
    const timestamp = '20260612-194510'

    await writeBenchmarkOutputs(report, { format: 'tsv', outDir }, timestamp)

    expect(
      await readdir(path.join(outDir, report.run.datasetId, timestamp)),
    ).toEqual(['puzzles.tsv'])
  })
})
