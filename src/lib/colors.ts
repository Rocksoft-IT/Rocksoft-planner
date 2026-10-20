import type { CSSProperties } from 'react'

type RGB = [number, number, number]

function rgb(hex: string): RGB {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB
}

function mix(color: string, target: string, amount: number): string {
  const to = rgb(target)
  return '#' + rgb(color).map((value, i) =>
    Math.round(value + (to[i] - value) * amount).toString(16).padStart(2, '0')
  ).join('')
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((value) => {
    const channel = value / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

function withContrast(color: string, backgrounds: string[], target: string, minimum: number): string {
  // Test the rounded sRGB color actually sent to CSS, including arbitrary saved
  // project colors. The margin avoids values that only round up to WCAG AA.
  for (let step = 0; step <= 100; step++) {
    const candidate = mix(color, target, step / 100)
    if (backgrounds.every((bg) => contrastRatio(candidate, bg) >= minimum)) return candidate
  }
  return target
}

// Both themes are emitted together: CSS selects them under the themed ancestor,
// so initial server rendering and instant theme changes use the same palette.
const projectStyles = new Map<string, CSSProperties>()

export function projectColorStyle(value: string): CSSProperties {
  const color = /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : '#6366f1'
  const cached = projectStyles.get(color)
  if (cached) return cached
  const darkFill = mix('#0f172a', color, 0.25)
  const lightFill = mix('#ffffff', color, 0.12)
  const style = {
    '--project-bg-dark': darkFill,
    '--project-text-dark': withContrast(color, [darkFill], '#ffffff', 4.6),
    '--project-accent-dark': withContrast(color, [darkFill, '#334155'], '#ffffff', 3.1),
    '--project-bg-light': lightFill,
    '--project-text-light': withContrast(color, [lightFill], '#0f172a', 4.6),
    '--project-accent-light': withContrast(color, [lightFill, '#e2e8f0'], '#0f172a', 3.1),
  } as CSSProperties
  projectStyles.set(color, style)
  return style
}

// Keep white initials in both themes; darken the chosen hue only as much as
// needed for readable text, instead of changing the initials to black.
const avatarStyles = new Map<string, CSSProperties>()

export function avatarColorStyle(value = '#6366f1'): CSSProperties {
  const color = /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : '#6366f1'
  const cached = avatarStyles.get(color)
  if (cached) return cached
  const style = {
    backgroundColor: withContrast(color, ['#ffffff'], '#000000', 4.6),
    color: '#ffffff',
  }
  avatarStyles.set(color, style)
  return style
}
