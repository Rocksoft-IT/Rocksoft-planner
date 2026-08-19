import { createClient } from '@/lib/supabase/server'
import PeopleClient from './PeopleClient'

export const dynamic = 'force-dynamic'

export default async function PeoplePage() {
  const supabase = await createClient()
  const [peopleRes, allocationsRes, timeOffRes] = await Promise.all([
    supabase.from('team_members').select('*').order('full_name'),
    supabase.from('allocations').select('*'),
    supabase.from('time_off').select('*'),
  ])

  // Surface read failures in the server logs instead of silently swallowing them —
  // a failed time_off / allocations read would otherwise show inflated availability.
  for (const [name, res] of [
    ['team_members', peopleRes],
    ['allocations', allocationsRes],
    ['time_off', timeOffRes],
  ] as const) {
    if (res.error) console.error(`People page: failed to load ${name}:`, res.error)
  }

  const { data: people } = peopleRes
  const { data: allocations } = allocationsRes
  const { data: timeOff } = timeOffRes

  return (
    <PeopleClient
      initialPeople={people ?? []}
      initialAllocations={allocations ?? []}
      initialTimeOff={timeOff ?? []}
    />
  )
}
