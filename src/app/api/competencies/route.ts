import { NextResponse, type NextRequest } from 'next/server'
import { requireApiKey } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// GET /api/competencies?kind=skill|technology&q=<substring>
// Lists the skill / technology catalog.
export async function GET(request: NextRequest) {
  const denied = requireApiKey(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const kind = searchParams.get('kind')
  const q = searchParams.get('q')

  if (kind && kind !== 'skill' && kind !== 'technology') {
    return NextResponse.json({ error: 'kind must be skill or technology.' }, { status: 400 })
  }
  if (q && q.length > 200) {
    return NextResponse.json({ error: 'q must not exceed 200 characters.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  let query = supabase
    .from('competency_tags')
    .select('id, kind, name, slug, is_curated')
    .order('kind')
    .order('name')

  if (kind) query = query.eq('kind', kind)
  // Escape LIKE metacharacters so a caller's `%`/`_` are matched literally, not as wildcards.
  if (q) query = query.ilike('name', `%${q.replace(/[\\%_]/g, '\\$&')}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ competencies: data ?? [] })
}
