'use client'

import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import PersonModal from '@/components/people/PersonModal'
import { format } from 'date-fns'
import { calcUtilization, getAvailabilityWindow, formatAvailability, cn } from '@/lib/utils'
import { ROLES } from '@/components/ui/RoleSelect'
import type { TeamMember, Allocation, TimeOff } from '@/lib/types'

type GroupMode = 'none' | 'role' | 'capacity'

// Shared column layout for the list header and rows:
// name · roles · 2-week availability · daily capacity · email
const LIST_COLS = 'grid grid-cols-[minmax(180px,1.3fr)_minmax(140px,1fr)_minmax(240px,1.4fr)_90px_minmax(160px,1.1fr)] items-center gap-4'

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
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<string | undefined>()

  // Availability is measured over the next 2 weeks (today → +13 days).
  const days = useMemo(() => getAvailabilityWindow(), [])
  const windowLabel = `${format(days[0], 'dd.MM')}–${format(days[days.length - 1], 'dd.MM')}`

  const refresh = useCallback(async (syncNotice?: string) => {
    setNotice(syncNotice)
    const supabase = createClient()
    const { data } = await supabase.from('team_members').select('*').order('full_name')
    if (data) setPeople(data as TeamMember[])
  }, [])

  function getPersonUtil(person: TeamMember) {
    const personAllocs = allocations.filter((a) => a.person_id === person.id)
    const personOffs = timeOff.filter((t) => t.person_id === person.id)
    return calcUtilization(personAllocs, days, person.capacity_hours_per_day, personOffs)
  }

  // Search by first / last name, case-insensitive. Every word of the query must
  // appear in full_name, so both "jan kow" and "kow jan" match "Jan Kowalski".
  const filteredPeople = useMemo(() => {
    const tokens = query.toLocaleLowerCase('pl').split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return people
    return people.filter((p) => {
      const name = p.full_name.toLocaleLowerCase('pl')
      return tokens.every((t) => name.includes(t))
    })
  }, [people, query])

  // Build grouped sections
  const groups = useMemo<{ label: string; sublabel?: string; color?: string; people: TeamMember[] }[]>(() => {
    const people = filteredPeople
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

    return people.length > 0 ? [{ label: '', people }] : []
  }, [filteredPeople, groupMode, allocations, timeOff, days])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-white light:text-slate-900">People</h1>
          <p className="text-sm text-slate-400 light:text-slate-600 mt-0.5">
            {query.trim() ? `${filteredPeople.length} z ${people.length}` : people.length} członków zespołu
          </p>
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

      {/* Search */}
      {notice && (
        <p role="status" className="text-sm text-amber-400 light:text-amber-700 mb-4">{notice}</p>
      )}
      <div className="flex items-center gap-2 bg-slate-900 light:bg-white border border-slate-800 light:border-slate-300 focus-within:border-slate-600 light:focus-within:border-slate-400 rounded-lg px-3 py-2 mb-4 max-w-md transition">
        <svg className="w-4 h-4 text-slate-500 light:text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') setQuery('') }}
          placeholder="Szukaj po imieniu lub nazwisku…"
          aria-label="Szukaj po imieniu lub nazwisku"
          className="flex-1 bg-transparent text-sm text-white light:text-slate-900 placeholder-slate-500 light:placeholder-slate-400 outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Wyczyść wyszukiwanie"
            className="text-slate-500 light:text-slate-600 hover:text-white light:hover:text-slate-900 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      {/* Group controls */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs text-slate-500 light:text-slate-600 font-medium">Grupuj po:</span>
        <div className="flex items-center gap-1 bg-slate-800 light:bg-slate-200 p-0.5 rounded-lg">
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
                groupMode === value
                  ? 'bg-slate-600 light:bg-white text-white light:text-slate-900 light:shadow-sm'
                  : 'text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {groupMode !== 'none' && (
          <span className="text-xs text-slate-500 light:text-slate-600 ml-1">
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
                <h2 className="text-sm font-semibold text-white light:text-slate-900">{group.label}</h2>
                {group.sublabel && (
                  <span className="text-xs text-slate-500 light:text-slate-600">{group.sublabel}</span>
                )}
                <span className="text-xs text-slate-500 light:text-slate-600 ml-auto">{group.people.length} os.</span>
              </div>
            )}

            <div className="bg-slate-900 light:bg-white border border-slate-800 light:border-slate-200 rounded-xl overflow-x-auto">
              <div className="min-w-[880px]">
                {/* Column headers */}
                <div className={cn(LIST_COLS, 'px-4 py-2 border-b border-slate-800 light:border-slate-200 text-[10px] font-medium uppercase tracking-wide text-slate-500 light:text-slate-600')}>
                  <span>Osoba</span>
                  <span>Stanowisko</span>
                  <span>Najbliższe 2 tygodnie · {windowLabel}</span>
                  <span>Dziennie</span>
                  <span>E-mail</span>
                </div>

                {group.people.map((person) => {
                  const util = getPersonUtil(person)
                  const av = formatAvailability(util)
                  const roles = person.role.split(',').map((r) => r.trim()).filter(Boolean)

                  return (
                    <div
                      key={person.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setModal({ open: true, person })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setModal({ open: true, person })
                        }
                      }}
                      className={cn(
                        LIST_COLS,
                        'px-4 py-3 border-b border-slate-800 light:border-slate-200 last:border-b-0 cursor-pointer hover:bg-slate-800/50 light:hover:bg-slate-50 focus:bg-slate-800/50 light:focus:bg-slate-50 outline-none transition'
                      )}
                    >
                      {/* Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold shrink-0 text-xs"
                          style={{ backgroundColor: person.avatar_color ?? '#6366f1' }}
                        >
                          {person.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <p className="font-medium text-white light:text-slate-900 truncate text-sm">{person.full_name}</p>
                      </div>

                      {/* Roles */}
                      <div className="min-w-0">
                        {roles.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {roles.map((r) => (
                              <span key={r} className="text-[10px] bg-slate-800 light:bg-slate-100 text-slate-400 light:text-slate-600 px-1.5 py-0.5 rounded">
                                {r}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 light:text-slate-600">Bez stanowiska</p>
                        )}
                      </div>

                      {/* Availability — next 2 weeks (green bar = how much is free) */}
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] font-semibold" style={{ color: av.color }}>
                            {av.isUnavailable ? 'niedostępny' : av.isOver ? 'przeciążony' : av.isFull ? 'pełny' : `${av.freePct}% wolne`}
                          </span>
                          <span className="text-[10px] font-medium truncate" style={{ color: av.color }}>{av.label}</span>
                        </div>
                        <div className="h-1.5 bg-slate-700 light:bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${av.barPct}%`, backgroundColor: av.color }}
                          />
                        </div>
                      </div>

                      {/* Daily capacity */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 light:text-slate-600">
                        <svg className="w-3 h-3 shrink-0 text-slate-500 light:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        {person.capacity_hours_per_day}h/dzień
                      </div>

                      {/* Email */}
                      <div className="min-w-0 text-xs text-slate-400 light:text-slate-600 truncate">
                        {person.email ? (
                          <span className="truncate" title={person.email}>{person.email}</span>
                        ) : (
                          <span className="text-slate-600 light:text-slate-400">—</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}

        {people.length > 0 && filteredPeople.length === 0 && (
          <div className="text-center py-16 text-slate-500 light:text-slate-600">
            <p>Brak osób pasujących do „{query.trim()}”.</p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-2 text-xs text-indigo-400 light:text-indigo-600 hover:text-indigo-300 light:hover:text-indigo-500 transition"
            >
              Wyczyść wyszukiwanie
            </button>
          </div>
        )}

        {people.length === 0 && (
          <div className="text-center py-16 text-slate-500 light:text-slate-600">
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
