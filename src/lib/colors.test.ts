import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { avatarColorStyle, contrastRatio, projectColorStyle } from './colors'
import { AVATAR_COLORS, PROJECT_COLORS } from './utils'

describe('WCAG AA color pairs', () => {
  it('uses the WCAG relative luminance formula', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.478, 3)
    expect(contrastRatio('#ffffff', '#777777')).toBeCloseTo(4.478, 3)
  })

  // Include saved custom colors outside the picker, including extreme luminance
  // and saturated hues. No project color may make its label or boundary unreadable.
  const colors = [...PROJECT_COLORS, '#0ea5e9', '#000000', '#ffffff', '#112244']
  for (const r of ['00', '33', '66', '99', 'cc', 'ff']) {
    for (const g of ['00', '33', '66', '99', 'cc', 'ff']) {
      for (const b of ['00', '33', '66', '99', 'cc', 'ff']) colors.push(`#${r}${g}${b}`)
    }
  }

  it.each(['dark', 'light'])('keeps project labels >= 4.5:1 and boundaries >= 3:1 in %s mode', (theme) => {
    for (const color of colors) {
      const style = projectColorStyle(color) as Record<string, string>
      const bg = style[`--project-bg-${theme}`]
      expect(contrastRatio(style[`--project-text-${theme}`], bg), `${theme} ${color} text`).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(style[`--project-accent-${theme}`], bg), `${theme} ${color} edge`).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(style[`--project-accent-${theme}`], theme === 'dark' ? '#334155' : '#e2e8f0'), `${theme} ${color} canvas`).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps avatar initials white and >= 4.5:1 against their background', () => {
    for (const color of [...AVATAR_COLORS, ...colors]) {
      const style = avatarColorStyle(color)
      expect(style.color).toBe('#ffffff')
      expect(contrastRatio(style.color as string, style.backgroundColor as string)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('handles missing or invalid legacy colors', () => {
    expect(projectColorStyle('invalid')).toEqual(projectColorStyle('#6366f1'))
    expect(avatarColorStyle('invalid')).toEqual(avatarColorStyle())
  })

  it.each(['dark', 'light'])('keeps %s accessible text tokens >= 4.5:1 and graphical tokens >= 3:1', (theme) => {
    const css = readFileSync('src/app/globals.css', 'utf8')
    const palette = css.match(theme === 'dark' ? /:root\s*\{([^}]+)\}/ : /\.light\s*\{([^}]+)\}/)![1]
    const tokens = Object.fromEntries([...palette.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map((m) => [m[1], m[2]]))
    // Light availability retains the original palette at the user's request;
    // its status colors are not included in the AA guarantee.
    const availabilityText = theme === 'dark' ? ['availability-free', 'availability-busy', 'availability-over', 'availability-unavailable'] : []
    const availabilityBars = theme === 'dark' ? availabilityText.map((token) => `${token}-bar`) : []
    for (const text of ['foreground', 'secondary', 'muted', 'status-success', 'status-warning', 'status-error', ...availabilityText]) {
      for (const surface of ['canvas', 'surface', 'surface-raised', 'surface-hover']) {
        expect(contrastRatio(tokens[text], tokens[surface]), `${text} / ${surface}`).toBeGreaterThanOrEqual(4.5)
      }
    }
    for (const graphic of ['separator', 'control-border', ...availabilityBars]) {
      for (const surface of ['canvas', 'surface', 'surface-raised', 'track']) {
        expect(contrastRatio(tokens[graphic], tokens[surface]), `${graphic} / ${surface}`).toBeGreaterThanOrEqual(3)
      }
    }
  })
})
