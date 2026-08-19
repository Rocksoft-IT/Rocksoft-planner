'use client'

import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import PersonModal from '@/components/people/PersonModal'
import { format } from 'date-fns'
import { calcUtilization, getAvailabilityWindow, formatAvailability, cn } from '@/lib/utils'
import { ROLES } from '@/components/ui/RoleSelect'
import type { TeamMember, Allocation, TimeOff } from '@/lib/types'

type GroupMode = 'none' | 'role' | 'capacity'

interface Props {
  initialPeople: TeamMember[]
  initialAllocations: Allocation[]
  initialTimeOff: TimeOff[]
}

export default function PeopleClient({ initialPeople, initialAllocations, initialTimeOff }: Props) {
  const [people, setPeople] = useState<TeamMember[]>(initialPeople)
  const [allocations] = useState<Allocation[]>(initialAllocations)
  const [timeOff] = useState<TimeOff[]>(initialTimeOff)
  const [modal, setModal] = useState<{ open: boolean; person?: TeamMember | null }>({ open: false })
  const [groupMode, setGroupMode] = useState<GroupMode>('none')

  // Availability is measured over the next 2 weeks (today → +13 days).
  const days = useMemo(() => getAvailabilityWindow(), [])
  const windowLabel = `${format(days[0], 'dd.MM')}–${format(days[days.length - 1], 'dd.MM')}`

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('team_members').select('*').order('full_name')
    if (data) setPeople(data as TeamMember[])
  }, [])

  function getPersonUtil(person: TeamMember) {
    const personAllocs = allocations.filter((a) => a.person_id === person.id)
    const personOffs = timeOff.filter((t) => t.person_id === person.id)
    return calcUtilization(personAllocs, days, person.capacity_hours_per_day, personOffs)
  }

  // Build grouped sections
  const groups = useMemo<{ label: string; sublabel?: string; color?: string; people: TeamMember[] }[]>(() => {
    if (groupMode === 'role') {
      const sections = ([...ROLES] as string[]).map((role) => ({
        label: role,
        color: undefined,
        people: people.filter((p) =>
          p.role.split(',').map((r) => r.trim()).includes(role)
        ),
      })).filter((s) => s.people.length > 0)

      const withoutRole = people.filter((p) => !p.role.trim())
      if (withoutRole.length > 0) sections.push({ label: 'Bez stanowiska', color: undefined, people: withoutRole })
      return sections
    }

    if (groupMode === 'capacity') {
      const free100: TeamMember[] = []
      const partial: TeamMember[] = []
      const busy: TeamMember[] = []
      const over: TeamMember[] = []
      const unavailable: TeamMember[] = []

      for (const p of people) {
        const av = formatAvailability(getPersonUtil(p))
        if (av.isUnavailable) unavailable.push(p)
        else if (av.isOver) over.push(p)
        else if (av.freePct <= 15) busy.push(p)
        else if (av.freePct < 100) partial.push(p)
        else free100.push(p)
      }

      return [
        { label: 'Wolni', sublabel: '100% wolne', color: '#10b981', people: free100 },
        { label: 'Częściowo wolni', sublabel: '16–99% wolne', color: '#6366f1', people: partial },
        { label: 'Prawie pełni', sublabel: '0–15% wolne', color: '#f59e0b', people: busy },
        { label: 'Przeciążeni', sublabel: '>100% zajęty', color: '#ef4444', people: over },
        { label: 'Niedostępni', sublabel: 'brak dostępnych godzin (urlop / 0h)', color: '#64748b', people: unavailable },
      ].filter((s) => s.people.length > 0)
    }

    return [{ label: '', people }]
  }, [people, groupMode, allocations, timeOff, days])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-white">People</h1>
          <p className="text-sm text-slate-400 mt-0.5">{people.length} członków zespołu</p>
        </div>
        <button
          onClick={() => setModal({ open: true, person: null })}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Dodaj osobę
        </button>
      </div>

      {/* Group controls */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs text-slate-500 font-medium">Grupuj po:</span>
        <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg">
          {([
            { value: 'none', label: 'Brak' },
            { value: 'role', label: 'Stanowisko' },
            { value: 'capacity', label: 'Wolny etat' },
          ] as { value: GroupMode; label: string }[]).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setGroupMode(value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition',
                groupMode === value ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {groupMode !== 'none' && (
          <span className="text-xs text-slate-500 ml-1">
            · dostępność na najbliższe 2 tygodnie ({windowLabel})
          </span>
        )}
      </div>

      {/* Groups */}
      <div className="space-y-8">
        {groups.map((group) => (
          <div key={group.label}>
            {/* Section header */}
            {groupMode !== 'none' && (
              <div className="flex items-center gap-2 mb-3">
                {group.color && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                )}
                <h2 className="text-sm font-semibold text-white">{group.label}</h2>
                {group.sublabel && (
                  <span className="text-xs text-slate-500">{group.sublabel}</span>
                )}
                <span className="text-xs text-slate-500 ml-auto">{group.people.length} os.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {group.people.map((person) => {
                const util = getPersonUtil(person)
                const av = formatAvailability(util)
                const roles = person.role.split(',').map((r) => r.trim()).filter(Boolean)

                return (
                  <div
                    key={person.id}
                    onClick={() => setModal({ open: true, person })}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer hover:border-slate-600 transition"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0 text-sm"
                        style={{ backgroundColor: person.avatar_color ?? '#6366f1' }}
                      >
                        {person.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate text-sm">{person.full_name}</p>
                        {roles.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {roles.map((r) => (
                              <span key={r} className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                                {r}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 mt-0.5">Bez stanowiska</p>
                        )}
                      </div>
                    </div>

                    {/* Availability — next 2 weeks (green bar = how much is free) */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-500">Najbliższe 2 tygodnie · {windowLabel}</span>
                        <span className="text-[10px] font-semibold" style={{ color: av.color }}>
                          {av.isUnavailable ? 'niedostępny' : av.isOver ? 'przeciążony' : av.isFull ? 'pełny' : `${av.freePct}% wolne`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(av.freePct, 100)}%`, backgroundColor: av.color }}
                        />
                      </div>
                      <p className="text-[10px] mt-1 font-medium" style={{ color: av.color }}>{av.label}</p>
                    </div>

                    {/* Capacity + email */}
                    <div className="mt-2.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        {person.capacity_hours_per_day}h/dzień dostępności
                      </div>
                      {person.email && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                          </svg>
                          <span className="truncate">{person.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {people.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <p>Brak członków zespołu. Dodaj pierwszą osobę.</p>
          </div>
        )}
      </div>

      <PersonModal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        onSaved={refresh}
        person={modal.person}
      />
    </div>
  )
}
