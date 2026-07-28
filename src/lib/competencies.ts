import type { CompetencyKind } from './types'

// Normalize a tag name into a stable slug (matches the seed slugs in the migration).
// "Next.js" → "next-js", "UI/UX Design" → "ui-ux-design", "3D / WebGL" → "3d-webgl".
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const KIND_LABELS: Record<CompetencyKind, string> = {
  skill: 'Umiejętność',
  technology: 'Technologia',
}
