'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { TeamMember } from '@/lib/types'

interface PeopleFilterProps {
  people: TeamMember[]
  selected: string[]          // array of person IDs
  onChange: (ids: string[]) => void
}

export default function PeopleFilter({ people, selected, onChange }: PeopleFilterProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const filtered = people.filter((p) =>
    p.full_name.toLowerCase().includes(query.toLowerCase())
  )

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  function clear() {
    onChange([])
    setOpen(false)
  }

  const selectedPeople = people.filter((p) => selected.includes(p.id))
  const hasFilter = selected.length > 0

  return (
    <div ref={ref} className="relative flex items-center gap-1.5 flex-wrap">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border',
          hasFilter
            ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/30 light:bg-indigo-50 light:border-indigo-300 light:text-indigo-700 light:hover:bg-indigo-100'
            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 light:bg-white light:border-slate-300 light:text-slate-600 light:hover:text-slate-900 light:hover:border-slate-400'
        )}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        {hasFilter ? `Osoby (${selected.length})` : 'Filtruj osoby'}
        <svg className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {/* Selected chips */}
      {selectedPeople.map((p) => (
        <span
          key={p.id}
          className="flex items-center gap-1 pl-1.5 pr-1 py-0.5 bg-indigo-600/20 border border-indigo-500/30 rounded-full text-[11px] text-indigo-300 light:bg-indigo-50 light:border-indigo-200 light:text-indigo-700"
        >
          <span
            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
            style={{ backgroundColor: p.avatar_color ?? '#6366f1' }}
          >
            {p.full_name[0]}
          </span>
          {p.full_name.split(' ')[0]}
          <button
            onClick={() => toggle(p.id)}
            className="ml-0.5 text-indigo-400 hover:text-white light:text-indigo-500 light:hover:text-indigo-800 transition"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </span>
      ))}

      {/* Clear all */}
      {hasFilter && (
        <button
          onClick={clear}
          className="text-[11px] text-slate-500 hover:text-slate-300 light:hover:text-slate-700 transition underline underline-offset-2"
        >
          wyczyść
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 w-64 bg-slate-900 light:bg-white border border-slate-700 light:border-slate-200 rounded-xl shadow-2xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-800 light:border-slate-200">
            <div className="flex items-center gap-2 bg-slate-800 light:bg-slate-100 rounded-lg px-3 py-2">
              <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj osoby…"
                className="flex-1 bg-transparent text-sm text-white light:text-slate-900 placeholder-slate-500 light:placeholder-slate-400 outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-slate-500 hover:text-white light:hover:text-slate-900">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Select all / deselect */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800 light:border-slate-200">
            <span className="text-[11px] text-slate-500">{filtered.length} osób</span>
            <div className="flex gap-2">
              <button
                onClick={() => onChange(filtered.map((p) => p.id))}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 light:text-indigo-600 light:hover:text-indigo-500 transition"
              >
                Zaznacz wszystkich
              </button>
              {hasFilter && (
                <>
                  <span className="text-slate-700 light:text-slate-300">·</span>
                  <button onClick={clear} className="text-[11px] text-slate-500 hover:text-slate-300 light:hover:text-slate-700 transition">
                    Wyczyść
                  </button>
                </>
              )}
            </div>
          </div>

          {/* People list */}
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500 text-center">Brak wyników</p>
            ) : (
              filtered.map((person) => {
                const isSelected = selected.includes(person.id)
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => toggle(person.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-left transition hover:bg-slate-800 light:hover:bg-slate-100',
                      isSelected ? 'text-white light:text-slate-900' : 'text-slate-300 light:text-slate-700'
                    )}
                  >
                    {/* Checkbox */}
                    <span className={cn(
                      'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition',
                      isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600 light:border-slate-300'
                    )}>
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </span>

                    {/* Avatar */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0"
                      style={{ backgroundColor: person.avatar_color ?? '#6366f1' }}
                    >
                      {person.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>

                    {/* Name + role */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{person.full_name}</p>
                      {person.role && (
                        <p className="text-[11px] text-slate-500 truncate">{person.role.split(',')[0].trim()}</p>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
