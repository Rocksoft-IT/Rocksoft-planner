import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/postcss'
import { chromium, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixture = path.join(root, 'scripts/contrast-audit')
const narrow = process.argv.includes('--narrow')
const availabilityOnly = process.argv.includes('--availability')
const port = availabilityOnly ? 4180 : narrow ? 4179 : 4178
const output = path.join(root, 'test-results/contrast', ...(availabilityOnly ? ['availability'] : narrow ? ['narrow'] : []))
await mkdir(output, { recursive: true })
const server = await createServer({
  configFile: false,
  root: fixture,
  plugins: [react()],
  css: { postcss: { plugins: [tailwind()] } },
  resolve: { alias: {
    '@/lib/supabase/client': path.join(fixture, 'mock-supabase.ts'),
    'next/navigation': path.join(fixture, 'mock-next.tsx'),
    'next/link': path.join(fixture, 'mock-next.tsx'),
    '@': path.join(root, 'src'),
  } },
  server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [root] } },
})

let browser
const report = []
try {
  await server.listen()
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH })
  const context = await browser.newContext({ viewport: narrow ? { width: 1366, height: 900 } : { width: 1920, height: 1200 } })
  const page = await context.newPage()
  const browserErrors = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  // Block external traffic: every scenario uses local, synthetic data.
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort())

  async function scan(name) {
    if (browserErrors.length) throw new Error(browserErrors.join('\n'))
    // Measure the settled theme, after finite hover/color transitions finish.
    await page.evaluate(async () => {
      await new Promise(requestAnimationFrame)
      await Promise.all(document.getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {})))
    })
    const modalSelector = 'main .fixed.inset-0.z-50 > .relative'
    const modalOpen = await page.locator(modalSelector).count() > 0
    const builder = new AxeBuilder({ page }).withRules(['color-contrast'])
    if (modalOpen) builder.include(modalSelector)
    const result = await builder.analyze()
    // axe cannot always resolve backgrounds inside overlapping sticky panes.
    // Measure those exact DOM targets against their opaque ancestor surface,
    // and check real graphical colors and pattern geometry separately.
    const supplemental = await page.evaluate(({ targets, modalSelector }) => {
      const scope = document.querySelector(modalSelector) ?? document
      const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
      function rgba(color) {
        context.clearRect(0, 0, 1, 1)
        context.fillStyle = color
        context.fillRect(0, 0, 1, 1)
        return [...context.getImageData(0, 0, 1, 1).data]
      }
      function background(element) {
        const color = rgba(getComputedStyle(element).backgroundColor)
        if (color[3] === 255) return color
        const behind = element.parentElement ? background(element.parentElement) : [255, 255, 255, 255]
        const alpha = color[3] / 255
        return color.map((c, i) => i === 3 ? 255 : c * alpha + behind[i] * (1 - alpha))
      }
      function ratio(a, b) {
        const lum = (rgb) => rgb.slice(0, 3).map((v) => v / 255)
          .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
          .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
        const [light, dark] = [lum(a), lum(b)].sort((x, y) => y - x)
        return (light + 0.05) / (dark + 0.05)
      }
      const text = targets.map((target) => {
        const element = document.querySelector(target)
        return { target, ratio: ratio(rgba(getComputedStyle(element).color), background(element)) }
      })
      const placeholders = [...scope.querySelectorAll('input[placeholder], textarea[placeholder]')]
        .filter((element) => !element.value && element.getBoundingClientRect().width > 0)
        .map((element) => ({ target: element.placeholder, ratio: ratio(rgba(getComputedStyle(element, '::placeholder').color), background(element)) }))
      const graphics = [...document.querySelectorAll('.allocation-block, .bg-track > div')].map((element) => ({
        target: element.className,
        ratio: element.matches('.allocation-block')
          ? ratio(rgba(getComputedStyle(element).borderTopColor), background(element))
          : ratio(background(element), background(element.parentElement)),
      }))
      if (!document.querySelector('.light')) {
        const canvas = rgba(getComputedStyle(document.querySelector('main').parentElement).backgroundColor)
        document.querySelectorAll('main .border-separator').forEach((element) => {
          graphics.push({ target: 'timeline grid', ratio: ratio(rgba(getComputedStyle(element).borderRightColor), canvas) })
        })
      }
      const patternClear = [...document.querySelectorAll('.allocation-pattern')].every((pattern) => {
        const top = pattern.getBoundingClientRect().top
        return [...pattern.parentElement.querySelectorAll('span')].every((label) => label.getBoundingClientRect().bottom <= top)
      })
      const filledLabels = [...document.querySelectorAll('.allocation-block')].every((element) =>
        element.getBoundingClientRect().height >= 24 && rgba(getComputedStyle(element).backgroundColor)[3] === 255 && getComputedStyle(element).opacity === '1')
      const availability = [...document.querySelectorAll('.bg-track > div')].map((element) => {
        const track = element.parentElement
        const label = track.previousElementSibling.textContent
        const full = /pełny|przeciążony|niedostępny/i.test(label)
        const barBox = element.getBoundingClientRect()
        const trackBox = track.getBoundingClientRect()
        return { label, full, width: barBox.width, trackWidth: trackBox.width, height: barBox.height }
      })
      return { text, placeholders, graphics, patternClear, filledLabels, availability }
    }, { targets: result.incomplete.flatMap((rule) => rule.nodes.map((node) => node.target[0])), modalSelector })
    report.push({ name, violations: result.violations, incomplete: result.incomplete, supplemental })
    console.log(`${name}: ${result.violations.length} contrast violations, ${result.incomplete.length} manual-review groups`)
    for (const violation of result.violations) {
      console.log(violation.nodes.map((node) => `${node.html}\n${node.failureSummary}`).join('\n'))
    }
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true })
    if (supplemental.text.some((pair) => pair.ratio < 4.5) || supplemental.placeholders.some((pair) => pair.ratio < 4.5)
      || supplemental.graphics.some((pair) => pair.ratio < 3)
      || supplemental.availability.some((bar) => bar.height < 1 || (bar.full && Math.abs(bar.width - bar.trackWidth) > 1))
      || !supplemental.patternClear || !supplemental.filledLabels) {
      console.log(`${name}: supplemental contrast or allocation geometry check failed; see axe-report.json`)
      process.exitCode = 1
    }
  }

  async function closeModal() {
    await page.keyboard.press('Escape')
    await expect(page.locator('main .fixed.inset-0.z-50')).toHaveCount(0)
  }

  for (const theme of ['dark', 'light']) {
    for (const view of availabilityOnly ? ['timeline', 'people'] : ['timeline', 'people', 'projects', 'competencies']) {
      await page.goto(`http://127.0.0.1:${port}/?view=${view}&theme=${theme}`)
      await page.locator('main > div').first().waitFor()
      await page.evaluate(() => document.fonts.ready)
      if (view === 'timeline') {
        for (const action of [page.getByRole('button', { name: 'Przydziel', exact: true }), page.getByTitle('Dodaj nieobecność')]) {
          const unobscured = await action.evaluate((element) => {
            const rect = element.getBoundingClientRect()
            return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
          })
          expect(unobscured, 'Timeline actions must remain clickable when the toolbar wraps').toBe(true)
        }
      }
      await scan(`${theme}-${view}`)
      if (availabilityOnly) {
        await page.addStyleTag({ content: ':root, .light { --availability-free-bar: initial; --availability-busy-bar: initial; --availability-over-bar: initial; --availability-unavailable-bar: initial; }' })
        await scan(`${theme}-${view}-fallback-colors`)
        continue
      }
      if (narrow) continue
      if (view === 'timeline') {
        // Hover must retain full opacity and the same readable label surface.
        await page.locator('.allocation-block').first().hover()
        await scan(`${theme}-timeline-hover`)
        await page.getByRole('button', { name: 'Filtruj projekty' }).click()
        await scan(`${theme}-timeline-project-filter`)
        await page.getByRole('button', { name: 'Filtruj projekty' }).click()
        await page.getByRole('button', { name: 'Filtruj osoby' }).click()
        await scan(`${theme}-timeline-people-filter`)
        await page.getByRole('button', { name: 'Filtruj osoby' }).click()
        await page.getByRole('button', { name: /2026/ }).first().click()
        await scan(`${theme}-timeline-month-picker`)
        await page.getByRole('button', { name: /2026/ }).first().click()
        await page.getByRole('button', { name: 'Przydziel', exact: true }).click()
        await scan(`${theme}-allocation-confirmed`)
        await page.getByRole('button', { name: /Tentative/ }).click()
        await scan(`${theme}-allocation-tentative`)
        await page.locator('form').getByRole('button', { name: /🏖️ Urlop/ }).click()
        await scan(`${theme}-allocation-timeoff`)
        await closeModal()
        await page.getByTitle('Dodaj nieobecność').click()
        await scan(`${theme}-timeoff-modal`)
        await closeModal()
      }
      if (view === 'people') {
        await page.getByRole('button', { name: 'Wolny etat', exact: true }).click()
        await scan(`${theme}-people-capacity-groups`)
        await page.getByRole('button', { name: 'Dodaj osobę', exact: true }).click()
        await scan(`${theme}-person-modal`)
        await closeModal()
      }
      if (view === 'projects') {
        await page.getByRole('button', { name: 'New project', exact: true }).click()
        await scan(`${theme}-project-modal`)
        await closeModal()
      }
      if (view === 'competencies') {
        await page.getByRole('button', { name: 'Szukaj ekspertów' }).click()
        await page.getByText('2.5 pkt').waitFor()
        await scan(`${theme}-competencies-results`)
        await page.getByRole('button', { name: 'Moje kompetencje' }).click()
        await page.getByText('4/5', { exact: false }).first().waitFor()
        await scan(`${theme}-competencies-editor`)
        await page.getByRole('button', { name: '+ Dodaj', exact: true }).click()
        await scan(`${theme}-experience-modal`)
        await closeModal()
      }
      // Check that the already-mounted view responds to both theme directions.
      const opposite = theme === 'dark' ? 'light' : 'dark'
      for (const target of [opposite, theme]) {
        await page.getByRole('button', { name: /User/ }).click()
        await page.getByRole('menuitemradio', { name: target === 'light' ? 'Light' : 'Dark', exact: true }).click()
        if (target === 'light') await expect(page.locator('#root > div')).toHaveClass(/light/)
        else await expect(page.locator('#root > div')).not.toHaveClass(/light/)
        await scan(`${theme}-${view}-switch-to-${target}`)
      }
    }
  }
} finally {
  await writeFile(path.join(output, 'axe-report.json'), JSON.stringify(report, null, 2))
  await browser?.close()
  await server.close()
}

if (report.some((result) => result.violations.length)) process.exitCode = 1
