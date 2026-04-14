import { expect, test } from '@playwright/test'

test('imports puzzle and applies next step', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('PuzzleKit Web - Logical Solver Workspace')).toBeVisible()
  await page.getByRole('button', { name: 'Import URL' }).click()
  await page.getByRole('button', { name: 'Next Step' }).click()
  await expect(page.getByText(/Total Steps/i)).toBeVisible()
})
