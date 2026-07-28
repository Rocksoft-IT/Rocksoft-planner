import { NextResponse, type NextRequest } from 'next/server'
import { requireApiKey } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function splitCsv(v: string | null): string[] {
  if (!v) return []
  return v.split(',').map((s) => s.trim()).filter(Boolean)
}

async function runSearch(skills: string[], technologies: string[], query: string | null) {
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
    searchParams.get('q')
  )
}

// POST /api/search/experts
// Body: { skills?: string[], technologies?: string[], description?: string, query?: string }
// `description` (or `query`) is free text — e.g. a pasted project brief. This is the
// entry point an MCP tool / LLM uses to find matching experts.
export async function POST(request: NextRequest) {
  const denied = requireApiKey(request)
  if (denied) return denied

  let body: {
    skills?: unknown
    technologies?: unknown
    description?: unknown
    query?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean) : []

  const text =
    typeof body.description === 'string'
      ? body.description
      : typeof body.query === 'string'
        ? body.query
        : null

  return runSearch(asStringArray(body.skills), asStringArray(body.technologies), text)
}
