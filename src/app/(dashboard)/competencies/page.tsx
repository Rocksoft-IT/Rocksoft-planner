import { createClient } from '@/lib/supabase/server'
import CompetenciesClient from './CompetenciesClient'
import type { CompetencyTag, TeamMember, Profile } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function CompetenciesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: tags }, { data: members }, profileRes] = await Promise.all([
    supabase.from('competency_tags').select('*').order('kind').order('name'),
    supabase.from('team_members').select('*').order('full_name'),
    user
      ? supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const profile = (profileRes?.data ?? null) as Profile | null
  const memberList = (members ?? []) as TeamMember[]

  // The only link between an auth user and their team_members row is email.
  const myEmail = (profile?.email ?? user?.email ?? '').toLowerCase()
  const myMember = myEmail
    ? memberList.find((m) => (m.email ?? '').toLowerCase() === myEmail) ?? null
    : null

  return (
    <CompetenciesClient
      tags={(tags ?? []) as CompetencyTag[]}
      members={memberList}
      myMemberId={myMember?.id ?? null}
      isAdmin={profile?.is_admin ?? false}
    />
  )
}
