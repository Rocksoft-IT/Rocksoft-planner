'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { CompetencyTag } from '@/lib/types'

interface TagMultiSelectProps {
  options: CompetencyTag[]
  value: string[] // selected slugs
  onChange: (slugs: string[]) => void
  placeholder?: string
}

// Dropdown checklist of competency tags (used by the expert search). Mirrors the
// RoleSelect interaction pattern.
export default function TagMultiSelect({ options, value, onChange, placeholder }: TagMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(slug: string) {
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug])
  }

  const visible = options.filter((o) => o.name.toLowerCase().includes(filter.toLowerCase()))
  const selectedNames = options.filter((o) => value.includes(o.slug)).map((o) => o.name)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-left focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 flex items-center justify-between gap-2"
      >
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {selectedNames.length === 0 ? (
            <span className="text-slate-500">{placeholder ?? 'Wybierz…'}</span>
          ) : (
            selectedNames.map((n) => (
              <span key={n} className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full">{n}</span>
            ))
          )}
        </div>
        <svg className={cn('w-4 h-4 text-slate-400 shrink-0 transition-transform', open && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-700">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtruj…"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {visible.length === 0 && <p className="px-3 py-2.5 text-sm text-slate-500">Brak wyników</p>}
            {visible.map((o) => {
              const selected = value.includes(o.slug)
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.slug)}
                  className={cn('w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-slate-700 transition', selected ? 'text-white' : 'text-slate-300')}
                >
                  <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 transition', selected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-500')}>
                    {selected && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  {o.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
