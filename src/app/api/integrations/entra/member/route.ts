import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getContractAttribute, getGraphUsers } from '@/lib/entra/graph'
import { contractMapping, planContractSync } from '@/lib/entra/contracts'
import { getSyncMembers } from '@/lib/entra/members'

export const runtime = 'nodejs'
export const maxDuration = 120

// The browser sends only the saved member's ID, never contract values/credentials.
// Session auth and the existing team_members read policy authorize the lookup.
export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin) {
    // Self-hosted Next can expose an internal URL behind Nginx. Prefer the
    // configured public origin, otherwise compare hosts like Next Server Actions.
    const publicUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.ENTRA_SYNC_URL
    const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim()
      || request.headers.get('host') || new URL(request.url).host
    let allowed = false
    try {
      const parsed = new URL(origin)
      allowed = publicUrl ? parsed.origin === new URL(publicUrl).origin
        : ['http:', 'https:'].includes(parsed.protocol) && parsed.host === host
    } catch { /* Reject malformed origins/configuration without exposing values. */ }
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let memberId: unknown
  try { memberId = (await request.json())?.memberId } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof memberId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(memberId)) {
    return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 })
  }
  const { data: member, error } = await supabase.from('team_members')
    .select('id, email, full_name').eq('id', memberId).maybeSingle()
  if (error) return NextResponse.json({ error: 'Failed to load team member' }, { status: 500 })
  if (!member) return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
  if (!member.email?.trim() && !member.full_name?.trim()) {
    return NextResponse.json({ status: 'skipped', updated: 0 })
  }

  try {
    const startedAt = new Date().toISOString()
    const attribute = getContractAttribute()
    const mapping = contractMapping()
    const admin = createAdminClient()
    const email = member.email?.trim()
    // Read the full directory for names: a server-side equality filter would
    // miss names that differ only by whitespace and could hide duplicates.
    const nameMembers = email ? [member] : await getSyncMembers(admin)
    const users = await getGraphUsers([attribute], email || undefined)
    const { updates, skipped } = planContractSync([member], users, attribute, mapping, nameMembers)
    if (!updates.length) return NextResponse.json({ status: 'skipped', updated: 0, skipped })
    const { data: updated, error: writeError } = await admin.rpc('sync_entra_contract_types', {
      p_updates: updates, p_synced_at: startedAt,
    })
    if (writeError) throw new Error('Failed to save Entra contract type. Check the database migration.')
    return NextResponse.json({ status: updated && updates[0].sync_contract ? 'synced' : 'skipped', updated }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Entra member lookup:', error instanceof Error ? error.message : 'Unexpected failure')
    return NextResponse.json({ error: 'Nie udało się pobrać typu umowy z Entra ID.' }, { status: 502 })
  }
}
