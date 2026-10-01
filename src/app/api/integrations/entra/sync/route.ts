import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getContractAttribute, getGraphUsers } from '@/lib/entra/graph'
import { contractMapping, planContractSync } from '@/lib/entra/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function sync(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Configure CRON_SECRET.' }, { status: 503 })
  const expected = Buffer.from(`Bearer ${secret}`)
  const presented = Buffer.from(request.headers.get('authorization') ?? '')
  if (expected.length !== presented.length || !timingSafeEqual(expected, presented)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const attribute = getContractAttribute()
    const mapping = contractMapping()
    const supabase = createAdminClient()
    const startedAt = new Date().toISOString()
    // Read all members, also beyond Supabase's default 1000-row page.
    const members: { id: string; email: string }[] = []
    for (let offset = 0; ;) {
      const { data, error } = await supabase.from('team_members')
        .select('id, email').order('id').range(offset, offset + 999)
      if (error) throw new Error('Failed to load team members.')
      if (!data?.length) break
      members.push(...data)
      // Supabase may have a configured response cap below the requested page
      // size. Advance by what was actually returned and stop only on an empty page.
      offset += data.length
    }
    const users = await getGraphUsers([attribute])
    const { updates, skipped } = planContractSync(members, users, attribute, mapping)
    const { data: updated, error } = await supabase.rpc('sync_entra_contract_types', {
      p_updates: updates, p_synced_at: startedAt,
    })
    if (error) throw new Error('Failed to save Entra contract types. Check the database migration.')
    return NextResponse.json({ updated, skipped }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Entra contract sync:', error instanceof Error ? error.message : 'Unexpected failure')
    return NextResponse.json({ error: 'Synchronizacja Entra ID nie powiodła się. Sprawdź logi serwera.' }, { status: 502 })
  }
}

// The RunCloud script uses POST; GET is also available to authenticated schedulers.
export const GET = sync
export const POST = sync
