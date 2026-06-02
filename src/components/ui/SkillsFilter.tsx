'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface SkillsFilterProps {
  roles: readonly string[]
  selected: string[]
  onChange: (roles: string[]) => void
  peopleCounts: Record<string, number>
}

export default function SkillsFilter({ roles, selected, onChange, peopleCounts }: SkillsFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(role: string) {
    onChange(selected.includes(role) ? selected.filter((r) => r !== role) : [...selected, role])
  }

  function clear() {
    onChange([])
    setOpen(false)
  }

  const hasFilter = selected.length > 0
  const availableRoles = roles.filter((r) => (peopleCounts[r] ?? 0) > 0)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border',
          hasFilter
            ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/30'
            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
        )}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
        {hasFilter ? `Umiejętności (${selected.length})` : 'Filtruj umiejętności'}
        <svg className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
            <span className="text-[11px] text-slate-500">{availableRoles.length} umiejętności</span>
            {hasFilter && (
              <button onClick={clear} className="text-[11px] text-slate-500 hover:text-slate-300 transition">
                Wyczyść
              </button>
            )}
          </div>
          <div className="py-1">
            {availableRoles.map((role) => {
              const isSelected = selected.includes(role)
              const count = peopleCounts[role] ?? 0
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggle(role)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-left transition hover:bg-slate-800',
                    isSelected ? 'text-white' : 'text-slate-300'
                  )}
                >
                  <span className={cn(
                    'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition',
                    isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600'
                  )}>
                    {isSelected && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                    )}
                  </span>
                  <span className="text-sm flex-1 truncate">{role}</span>
                  <span className="text-[11px] text-slate-500 shrink-0">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
