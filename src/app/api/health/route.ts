import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const HEADERS = { 'Cache-Control': 'no-store' }

// RunCloud can use /api/health as a cheap process liveness check. Add ?ready=1
// during deploy verification to include configuration and database connectivity.
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('ready') !== '1') {
    return NextResponse.json({ status: 'ok' }, { headers: HEADERS })
  }

  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('competency_tags').select('id').limit(1)
    if (error) throw error

    return NextResponse.json(
      { status: 'ready', database: 'ok', competencyApi: 'configured' },
      { headers: HEADERS }
    )
  } catch {
    return NextResponse.json(
      { status: 'unavailable', database: 'error', competencyApi: 'unavailable' },
      { status: 503, headers: HEADERS }
    )
  }
}
