'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Timeline from '@/components/timeline/Timeline'
import type { AllocationWithProject, TeamMember, Project, TimeOff } from '@/lib/types'

interface Props {
  initialPeople: TeamMember[]
  initialProjects: Project[]
  initialAllocations: AllocationWithProject[]
  initialTimeOffs: TimeOff[]
}

export default function TimelineClient({ initialPeople, initialProjects, initialAllocations, initialTimeOffs }: Props) {
  const [people] = useState<TeamMember[]>(initialPeople)
  const [projects] = useState<Project[]>(initialProjects)
  const [allocations, setAllocations] = useState<AllocationWithProject[]>(initialAllocations)
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>(initialTimeOffs)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const [{ data: allocs }, { data: offs }] = await Promise.all([
      supabase.from('allocations').select('*, project:projects(*), creator:profiles!created_by(id, full_name, email), editor:profiles!updated_by(id, full_name, email)').order('start_date'),
      supabase.from('time_off').select('*').order('start_date'),
    ])
    if (allocs) setAllocations(allocs as AllocationWithProject[])
    if (offs) setTimeOffs(offs as TimeOff[])
  }, [])

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-800 shrink-0">
        <h1 className="text-lg font-semibold text-white">Timeline</h1>
        <p className="text-sm text-slate-400 mt-0.5">Przegląd alokacji zespołu</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <Timeline
          people={people}
          projects={projects}
          allocations={allocations}
          timeOffs={timeOffs}
          onRefresh={refresh}
        />
      </div>
    </div>
  )
}
