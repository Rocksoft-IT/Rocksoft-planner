import { NextResponse, type NextRequest } from 'next/server'
import { requireApiKey } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Bounds on caller-supplied input so a valid API key can't drive unbounded RPC work.
const MAX_SLUGS = 50
const MAX_SLUG_LEN = 100
const MAX_TEXT_LEN = 2000

function cleanSlugs(values: string[]): string[] {
  return values
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= MAX_SLUG_LEN)
    .slice(0, MAX_SLUGS)
}

function splitCsv(v: string | null): string[] {
  if (!v) return []
  return cleanSlugs(v.split(','))
}

function cleanText(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  if (!trimmed) return null
  return trimmed.slice(0, MAX_TEXT_LEN)
}

async function runSearch(skills: string[], technologies: string[], query: string | null) {
  // Require at least one criterion — an empty search would scan everything for nothing.
  if (skills.length === 0 && technologies.length === 0 && !query) {
    return NextResponse.json(
      { error: 'Provide at least one of: skills, technologies, or a text query.' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('search_experts', {
    p_skill_slugs: skills,
    p_tech_slugs: technologies,
    p_query: query,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    query: { skills, technologies, text: query ?? null },
    count: data?.length ?? 0,
    experts: data ?? [],
  })
}

// GET /api/search/experts?skills=react,typescript&technologies=three-js&q=3D configurator
// Slugs must match competency_tags.slug (see GET /api/competencies).
export async function GET(request: NextRequest) {
  const denied = requireApiKey(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  return runSearch(
    splitCsv(searchParams.get('skills')),
    splitCsv(searchParams.get('technologies')),
    cleanText(searchParams.get('q'))
  )
}

// POST /api/search/experts
// Body: { skills?: string[], technologies?: string[], description?: string, query?: string }
// `description` (or `query`) is free text — e.g. a pasted project brief. This is the
// entry point an MCP tool / LLM uses to find matching experts.
export async function POST(request: NextRequest) {
  const denied = requireApiKey(request)
  if (denied) return denied

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  // Reject anything that isn't a JSON object (null, arrays, scalars) up front.
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be a JSON object.' }, { status: 400 })
  }
  const b = body as Record<string, unknown>

  for (const field of ['skills', 'technologies'] as const) {
    const value = b[field]
    if (value !== undefined && (
      !Array.isArray(value)
      || value.some((item) => typeof item !== 'string')
      || value.length > MAX_SLUGS
      || value.some((item) => item.length > MAX_SLUG_LEN)
    )) {
      return NextResponse.json(
        { error: `${field} must be an array of at most ${MAX_SLUGS} strings, each at most ${MAX_SLUG_LEN} characters.` },
        { status: 400 }
      )
    }
  }
  for (const field of ['description', 'query'] as const) {
    const value = b[field]
    if (value !== undefined && (typeof value !== 'string' || value.length > MAX_TEXT_LEN)) {
      return NextResponse.json(
        { error: `${field} must be a string of at most ${MAX_TEXT_LEN} characters.` },
        { status: 400 }
      )
    }
  }

  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? cleanSlugs(v.filter((x): x is string => typeof x === 'string')) : []

  return runSearch(
    asStringArray(b.skills),
    asStringArray(b.technologies),
    cleanText(b.description) ?? cleanText(b.query)
  )
}
