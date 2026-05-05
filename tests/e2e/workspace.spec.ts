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
  await page.getByRole('button', { name: /Starter Loop/i }).click()
  await page.getByRole('button', { name: 'Solve It' }).click()
  await expect(page.getByRole('heading', { name: 'PuzzleKit Web' })).toBeVisible()
  await expect(page.getByText('3 × 3')).toBeVisible()
})
