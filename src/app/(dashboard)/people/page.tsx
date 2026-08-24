import { createClient } from '@/lib/supabase/server'
import PeopleClient from './PeopleClient'

export const dynamic = 'force-dynamic'

export default async function PeoplePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: people }, { data: allocations }, { data: profile }] = await Promise.all([
    supabase.from('team_members').select('*').order('full_name'),
    supabase.from('allocations').select('*'),
    user ? supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  return (
    <PeopleClient
      initialPeople={people ?? []}
      initialAllocations={allocations ?? []}
      isAdmin={profile?.is_admin ?? false}
    />
  )
}
