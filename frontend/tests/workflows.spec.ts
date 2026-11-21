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
    const language = page.getByRole('combobox', { name: 'Language / भाषा / ভাষা' })
    for (const path of ['/', '/analyze', '/emergency', '/report', '/resources', '/missing']) {
      await page.goto(path)
      await expect(page.locator('main')).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(language).toBeFocused()
      for (const value of ['en', 'hi', 'as']) {
        await language.selectOption(value)
        await expect(page.locator('html')).toHaveAttribute('lang', value)
        await expect(page.locator('h1')).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      }
    }
  })
}

test('preserves the upload, draft, and result while switching languages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/analyze')
  const language = page.getByRole('combobox', { name: 'Language / भाषा / ভাষা' })
  await expect(page.locator('main')).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(language).toBeFocused()
  expect(await language.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid')

  const message = 'Reply with your OTP now.'
  const url = 'https://sbi.example.com/signin'
  await page.getByRole('textbox', { name: 'Message' }).fill(message)
  await page.getByRole('button', { name: 'Link', exact: true }).click()
  await page.getByRole('textbox', { name: 'Link' }).fill(url)
  await page.getByRole('button', { name: 'Screenshot', exact: true }).click()
  await page.locator('input[type=file]').setInputFiles({
    name: 'valid.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==', 'base64'),
  })

  await language.selectOption('hi')
  await expect(page.getByRole('heading', { name: 'संदेश जाँचें' })).toBeVisible()
  await expect(page.getByText('valid.png')).toBeVisible()
  await expect(page.getByRole('img', { name: 'स्क्रीनशॉट' })).toBeVisible()
  await page.getByRole('button', { name: 'संदेश', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'संदेश' })).toHaveValue(message)
  await page.getByRole('button', { name: 'लिंक', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'लिंक' })).toHaveValue(url)

  let scans = 0
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/analyze', async route => {
    scans++
    const request = route.request().postData() ?? ''
    expect(request).toContain('valid.png')
    expect(request).toContain(message)
    expect(request).toContain(url)
    expect(request).toMatch(/name="language"\r\n\r\nhi/)
    const response = await route.fetch()
    await pending
    await route.fulfill({ response })
  })

  try {
    await page.getByRole('button', { name: 'विश्लेषण करें' }).click()
    await expect.poll(() => scans).toBe(1)
    await language.selectOption('as')
    await expect(page.getByRole('button', { name: 'কাম চলি আছে…' })).toBeDisabled()
  } finally {
    release()
  }
  await expect(page.getByText('উচ্চ বিপদাশংকা', { exact: true })).toBeVisible()
  await expect(page.getByText(/Reply with your OTP/)).toBeVisible()
  await expect(page.getByText(/sbi\.example\.com .*সেৱা কনফিগাৰ কৰা হোৱা নাই/)).toBeVisible()
  await expect(page.locator('.results')).toHaveCSS('animation-name', 'none')
  await language.selectOption('en')
  await expect(page.getByText('High Risk', { exact: true })).toBeVisible()
  await expect(page.getByText('Screenshot text was unavailable for rule checks.')).toBeVisible()
  await language.selectOption('as')
  expect(scans).toBe(1)
  await expect(page).toHaveURL(/\/analyze$/)
  await page.reload()
  await expect(language).toHaveValue('as')
  await expect(page.locator('html')).toHaveAttribute('lang', 'as')
})

test('keeps generated prose and evidence when the interface language changes', async ({ page }) => {
  let scans = 0
  await page.route('**/api/analyze', async route => {
    scans++
    await route.fulfill({ json: {
      risk: 'medium', basis: 'warning_signs', rules_ran: true,
      findings: [{ id: 'pressure', category: 'urgency', severity: 'low', evidence: 'Act now' }],
      ai_status: 'completed', ai: { category: 'Possible impersonation', concern: 'some', summary: 'The sender applies pressure.', supporting: ['Act now'] },
      links: [], limitations: [], actions: ['verify_sender'],
    } })
  })
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Message' }).fill('Act now')
  await page.getByRole('button', { name: 'Analyze', exact: true }).click()
  await expect(page.getByText('Medium Risk', { exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Language / भाषा / ভাষা' }).selectOption('hi')
  await expect(page.getByText('मध्यम जोखिम', { exact: true })).toBeVisible()
  await expect(page.getByText('कुछ चेतावनी संकेत', { exact: true })).toBeVisible()
  await expect(page.getByText('The sender applies pressure.')).toHaveAttribute('lang', 'en')
  await expect(page.getByText('Act now', { exact: true })).toBeVisible()
  await expect(page.getByText('स्कैन के समय AI की व्याख्या की भाषा · English')).toBeVisible()
  expect(scans).toBe(1)
})

test('routes a standalone link in Message through the URL field flow', async ({ page }) => {
  const link = 'sbi.example.com/signin'
  await page.goto('/analyze')
  const analyze = page.getByRole('button', { name: 'Analyze', exact: true })
  const message = page.getByRole('textbox', { name: 'Message', exact: true })
  const warning = page.getByText(/Brand name appears on a different domain/)
  const scan = async () => {
    const response = page.waitForResponse(response => response.url().endsWith('/api/analyze') && response.request().method() === 'POST')
    await analyze.click()
    return response
  }
  await message.fill('  ' + link + '\n')
  const fromMessage = await scan()
  expect(fromMessage.ok()).toBe(true)
  await expect(warning).toBeVisible()
  await expect(page.getByText('Medium Risk', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Analyze again' }).click()
  await page.getByRole('button', { name: 'Link', exact: true }).click()
  await page.getByRole('textbox', { name: 'Link', exact: true }).fill(link)
  const fromLink = await scan()
  expect(fromLink.ok()).toBe(true)
  expect(await fromMessage.json()).toEqual(await fromLink.json())

  await page.getByRole('button', { name: 'Analyze again' }).click()
  await message.fill('Share your OTP to sign in at https://' + link)
  await scan()
  await expect(warning).toBeVisible()
  await expect(page.getByText(/Requests a secret code or credential/)).toBeVisible()
  await expect(page.getByText('High Risk', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Analyze again' }).click()
  await message.fill('https://')
  expect((await scan()).status()).toBe(422)
  await expect(page.getByRole('alert')).toHaveText('Enter a valid HTTP or HTTPS link.')
})

test('retains the gradient with reduced motion on desktop and mobile', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 850 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/')
    const gradient = () => page.locator('#root').evaluate(element => {
      const style = getComputedStyle(element, '::before')
      return { image: style.backgroundImage, animation: style.animationName }
    })
    expect((await gradient()).animation).toBe('gradient-drift')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const reduced = await gradient()
    expect(reduced.animation).toBe('none')
    expect(reduced.image).toContain('radial-gradient')
  }
})
