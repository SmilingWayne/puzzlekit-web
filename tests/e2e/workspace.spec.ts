import { expect, test } from '@playwright/test'

test('imports puzzle and applies next step', async ({ page }) => {
  await page.goto('/puzzlekit-web/')
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
