import { expect, test } from '@playwright/test'

test('imports puzzle and applies next step', async ({ page }) => {
  await page.goto('/puzzlekit-web/')
  await expect(page).toHaveTitle('PuzzleKit Web')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    'href',
    '/puzzlekit-web/favicon.svg',
  )
  await expect(page.getByRole('heading', { name: 'PuzzleKit Web' })).toBeVisible()
  await page.getByRole('button', { name: 'Import URL' }).click()
  await page.getByRole('button', { name: 'Next Step' }).click()
  await expect(page.getByText(/Total Steps/i)).toBeVisible()
})

test('loads an editor preset into the solver', async ({ page }) => {
  await page.goto('/puzzlekit-web/editor')
  await page.getByRole('button', { name: 'Load Preset' }).click()
  const firstPreset = page.locator('article').filter({ hasText: 'Default Slitherlink 1' })
  await firstPreset.getByRole('button', { name: 'To Solve' }).click()
  await expect(page.getByRole('heading', { name: 'PuzzleKit Web' })).toBeVisible()
  await expect(page.getByText('10 × 10')).toBeVisible()
})

test('loads and reloads a canonical puzz.link payload deep link', async ({ page }) => {
  const payload =
    'slither/10/10/q2111221ch6212b212611b61262cg1c6bb2121c2bcc621112bo'
  const sourceUrl = `https://puzz.link/p?${payload}`
  const urlInput = page.getByPlaceholder('Paste puzz.link, pzplus, pzv, or penpa URL')

  await page.goto(`/puzzlekit-web/?p=${payload}`)
  await expect(urlInput).toHaveValue(sourceUrl)
  await expect(page.getByText('10 × 10')).toBeVisible()

  await page.reload()
  await expect(urlInput).toHaveValue(sourceUrl)
  await expect(page.getByText('10 × 10')).toBeVisible()
})

test('falls back and reports an invalid deep link', async ({ page }) => {
  await page.goto('/puzzlekit-web/?p=slither/10/10/dsew%3F')

  await expect(page.getByRole('alertdialog', { name: 'Import failed' })).toBeVisible()
  await expect(page.getByPlaceholder('Paste puzz.link, pzplus, pzv, or penpa URL')).toHaveValue(
    /https:\/\/puzz\.link\/p\?slither\/18\/10\//,
  )
  await expect(page).toHaveURL(/p=slither\/10\/10\/dsew%3F/)
})

test('keeps the docs header aligned and compact across docs routes', async ({ page }) => {
  await page.goto('/puzzlekit-web/')
  const solverHeader = page.locator('.workspace-title')
  const solverHeaderWidth = await solverHeader.evaluate(
    (element) => element.getBoundingClientRect().width,
  )

  await page.goto('/puzzlekit-web/docs')
  const docsHeader = page.locator('.workspace-title')
  const docsIndexHeaderSize = await docsHeader.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { height: rect.height, width: rect.width }
  })

  expect(docsIndexHeaderSize.width).toBeCloseTo(solverHeaderWidth, 0)

  await page.goto(
    '/puzzlekit-web/docs/slitherlink/rules/diagonal-adjacent-three-outer-corners',
  )
  const ruleHeaderHeight = await page
    .locator('.workspace-title')
    .evaluate((element) => element.getBoundingClientRect().height)

  expect(ruleHeaderHeight).toBeCloseTo(docsIndexHeaderSize.height, 0)
})
