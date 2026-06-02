'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { Project } from '@/lib/types'

interface ProjectFilterProps {
  projects: Project[]
  selected: string[]
  onChange: (ids: string[]) => void
}

export default function ProjectFilter({ projects, selected, onChange }: ProjectFilterProps) {
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

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  )

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  function clear() {
    onChange([])
    setOpen(false)
  }

  const selectedProjects = projects.filter((p) => selected.includes(p.id))
  const hasFilter = selected.length > 0

  return (
    <div ref={ref} className="relative flex items-center gap-1.5 flex-wrap">
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
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M6 12h12M9 17h6"/>
        </svg>
        {hasFilter ? `Projekty (${selected.length})` : 'Filtruj projekty'}
        <svg className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {/* Selected chips */}
      {selectedProjects.map((p) => (
        <span
          key={p.id}
          className="flex items-center gap-1 pl-1.5 pr-1 py-0.5 bg-indigo-600/20 border border-indigo-500/30 rounded-full text-[11px] text-indigo-300"
        >
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: p.color ?? '#6366f1' }}
          />
          {p.name.split(' ')[0]}
          <button onClick={() => toggle(p.id)} className="ml-0.5 text-indigo-400 hover:text-white transition">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </span>
      ))}

      {hasFilter && (
        <button onClick={clear} className="text-[11px] text-slate-500 hover:text-slate-300 transition underline underline-offset-2">
          wyczyść
        </button>
      )}

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-800">
            <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
              <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj projektu…"
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-slate-500 hover:text-white">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800">
            <span className="text-[11px] text-slate-500">{filtered.length} projektów</span>
            <div className="flex gap-2">
              <button
                onClick={() => onChange(filtered.map((p) => p.id))}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 transition"
              >
                Zaznacz wszystkie
              </button>
              {hasFilter && (
                <>
                  <span className="text-slate-700">·</span>
                  <button onClick={clear} className="text-[11px] text-slate-500 hover:text-slate-300 transition">
                    Wyczyść
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500 text-center">Brak wyników</p>
            ) : (
              filtered.map((project) => {
                const isSelected = selected.includes(project.id)
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => toggle(project.id)}
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
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: project.color ?? '#6366f1' }}
                    />
                    <span className="text-sm font-medium truncate">{project.name}</span>
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
