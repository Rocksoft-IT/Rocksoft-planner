import type { SupabaseClient } from '@supabase/supabase-js'
import type { SyncMember } from './contracts'

// Include every member when checking whether a name is unique in Planner.
export async function getSyncMembers(supabase: SupabaseClient): Promise<SyncMember[]> {
  const members: SyncMember[] = []
  for (let offset = 0; ;) {
    const { data, error } = await supabase.from('team_members')
      .select('id, email, full_name').order('id').range(offset, offset + 999)
    if (error) throw new Error('Failed to load team members.')
    if (!data?.length) return members
    members.push(...data)
    // Advance by the actual page size, including configured caps below 1000.
    offset += data.length
  }
}
