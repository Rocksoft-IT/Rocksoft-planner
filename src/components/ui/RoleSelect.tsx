'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export const ROLES = [
  'Backend Developer',
  'Frontend Developer',
  'Mobile Developer',
  'Wordpress Developer',
  'UI/UX',
  'Graphic Designer',
  'Marketing',
  'Administration Support',
  'Management',
] as const

interface RoleSelectProps {
  value: string[]
  onChange: (roles: string[]) => void
}

export default function RoleSelect({ value, onChange }: RoleSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(role: string) {
    if (value.includes(role)) {
      onChange(value.filter((r) => r !== role))
    } else {
      onChange([...value, role])
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-left focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 flex items-center justify-between gap-2"
      >
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {value.length === 0 ? (
            <span className="text-slate-500">Wybierz stanowisko…</span>
          ) : (
            value.map((r) => (
              <span
                key={r}
                className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full"
              >
                {r}
              </span>
            ))
          )}
        </div>
        <svg
          className={cn('w-4 h-4 text-slate-400 shrink-0 transition-transform', open && 'rotate-180')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
          {ROLES.map((role) => {
            const selected = value.includes(role)
            return (
              <button
                key={role}
                type="button"
                onClick={() => toggle(role)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-slate-700 transition',
                  selected ? 'text-white' : 'text-slate-300'
                )}
              >
                <span
                  className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition',
                    selected
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'border-slate-500'
                  )}
                >
                  {selected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  )}
                </span>
                {role}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
