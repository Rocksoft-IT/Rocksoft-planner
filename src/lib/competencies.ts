import type { CompetencyKind } from './types'

// Normalize a tag name into a stable slug (matches the seed slugs in the migration).
// "Next.js" → "next-js", "UI/UX Design" → "ui-ux-design", "3D / WebGL" → "3d-webgl".
// Meaningful trailing symbols are transliterated first so distinct techs don't collapse
// to the same slug: "C#" → "c-sharp", "C++" → "c-plus-plus" (a bare strip made both "c").
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\+\+/g, ' plus plus')
    .replace(/\+/g, ' plus')
    .replace(/#/g, ' sharp')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const KIND_LABELS: Record<CompetencyKind, string> = {
  skill: 'Umiejętność',
  technology: 'Technologia',
}
