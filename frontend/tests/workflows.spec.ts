import { expect, test } from '@playwright/test'

test('validates and scans a real message and link through the API', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.getByRole('button', { name: 'Analyze', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Add a message, link, or screenshot first.')
  await page.getByRole('textbox', { name: 'Message' }).fill('Reply with your OTP now.')
  await page.getByRole('button', { name: 'Link', exact: true }).click()
  await page.getByRole('textbox', { name: 'Link' }).fill('https://sbi.example.com/signin')
  await page.getByRole('button', { name: 'Analyze', exact: true }).click()
  await expect(page.getByText('High Risk', { exact: true })).toBeVisible()
  await expect(page.getByText(/sbi\.example\.com .*Service not configured/)).toBeVisible()
  await page.getByRole('button', { name: 'Copy analysis' }).click()
  await expect(page.getByRole('button', { name: 'Analysis copied' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('High Risk')
  const summary = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download summary' }).click()
  expect((await summary).suggestedFilename()).toBe('scamshield-analysis.txt')
  await page.getByRole('button', { name: 'Analyze again' }).click()
  await expect(page.getByRole('textbox', { name: 'Message' })).toHaveValue('')
})

test('rejects a corrupt screenshot and allows removal', async ({ page }) => {
  await page.goto('/analyze')
  await page.getByRole('button', { name: 'Screenshot', exact: true }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'corrupt.png', mimeType: 'image/png', buffer: Buffer.from('broken') })
  await expect(page.getByText('corrupt.png')).toBeVisible()
  await page.getByRole('button', { name: 'Analyze', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Choose a valid PNG, JPEG, or WebP image.')
  await page.getByRole('button', { name: 'Remove image' }).click()
  await expect(page.getByText('corrupt.png')).toHaveCount(0)
})

test('drafts, edits, and downloads an incident report while preserving checklist state', async ({ page }) => {
  await page.goto('/emergency')
  await expect(page.getByRole('link', { name: '1930' })).toHaveAttribute('href', 'tel:1930')
  await page.getByRole('checkbox').first().check()
  await page.getByRole('textbox', { name: 'Describe what happened' }).fill('A caller says they took ₹100.')
  await page.getByRole('button', { name: 'Organize incident details' }).click()
  await expect(page.getByRole('heading', { name: 'Incident report' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Description', exact: true }).fill('I confirmed a payment of ₹100.')
  const pdf = page.getByRole('button', { name: 'Download PDF' })
  await expect(pdf).toBeDisabled()
  await page.getByText('Preview report', { exact: true }).click()
  await expect(page.locator('dd')).toContainText(['I confirmed a payment of ₹100.'])
  await page.getByRole('checkbox').check()
  const report = page.waitForEvent('download')
  await pdf.click()
  expect((await report).suggestedFilename()).toBe('scamshield-incident.pdf')
  await page.getByRole('navigation').getByRole('link', { name: 'Emergency help' }).click()
  await expect(page.getByRole('checkbox').first()).toBeChecked()
})

for (const width of [360, 390, 768, 1024, 1440]) {
  test('essential pages fit a ' + width + 'px viewport', async ({ page }) => {
    await page.setViewportSize({ width, height: 850 })
    await page.goto('/')
    await page.getByRole('combobox').selectOption('as')
    await expect(page.locator('html')).toHaveAttribute('lang', 'as')
    for (const path of ['/', '/analyze', '/emergency', '/report', '/resources']) {
      await page.goto(path)
      await expect(page.locator('h1')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    }
    await page.getByRole('combobox', { name: 'Language / भाषा / ভাষা' }).selectOption('hi')
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
  })
}
