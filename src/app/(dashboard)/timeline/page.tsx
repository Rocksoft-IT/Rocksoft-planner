import { createClient } from '@/lib/supabase/server'
import TimelineClient from './TimelineClient'

export const dynamic = 'force-dynamic'

export default async function TimelinePage() {
  const supabase = await createClient()

  const [{ data: people }, { data: projects }, { data: allocations }, { data: timeOffs }] = await Promise.all([
    supabase.from('team_members').select('*').order('full_name'),
    supabase.from('projects').select('*').order('name'),
    supabase.from('allocations').select('*, project:projects(*), creator:profiles!created_by(id, full_name, email), editor:profiles!updated_by(id, full_name, email)').order('start_date'),
    supabase.from('time_off').select('*').order('start_date'),
  ])

  return (
    <TimelineClient
      initialPeople={people ?? []}
      initialProjects={projects ?? []}
      initialAllocations={allocations ?? []}
      initialTimeOffs={timeOffs ?? []}
    />
  )
}
