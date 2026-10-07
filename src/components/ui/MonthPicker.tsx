'use client'

import { useState, useRef, useEffect } from 'react'
import { format, addMonths, startOfMonth } from 'date-fns'
import { pl } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface MonthPickerProps {
  anchor: Date
  onChange: (date: Date) => void
}

export default function MonthPicker({ anchor, onChange }: MonthPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Generate months: 3 in the past up to 12 months ahead
  const months: Date[] = []
  for (let i = -3; i <= 12; i++) {
    months.push(startOfMonth(addMonths(new Date(), i)))
  }

  const currentLabel = format(anchor, 'LLLL yyyy', { locale: pl })

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 light:bg-slate-100 hover:bg-slate-700 light:hover:bg-slate-200 rounded-lg text-sm font-medium text-white light:text-slate-900 transition"
        title="Skocz do miesiąca"
      >
        <svg className="w-3.5 h-3.5 text-slate-400 light:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <span className="capitalize">{currentLabel}</span>
        <svg
          className={cn('w-3.5 h-3.5 text-slate-400 light:text-slate-500 transition-transform', open && 'rotate-180')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-52 bg-slate-800 light:bg-white border border-slate-600 light:border-slate-200 rounded-xl shadow-2xl overflow-hidden py-1">
          {months.map((month) => {
            const isCurrent =
              format(month, 'yyyy-MM') === format(startOfMonth(new Date()), 'yyyy-MM')
            const isSelected =
              format(month, 'yyyy-MM') === format(startOfMonth(anchor), 'yyyy-MM')
            const isPast = month < startOfMonth(new Date())

            return (
              <button
                key={month.toISOString()}
                type="button"
                onClick={() => { onChange(month); setOpen(false) }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 text-sm text-left transition hover:bg-slate-700 light:hover:bg-slate-100',
                  isSelected ? 'text-white light:text-slate-900 font-medium bg-indigo-600/20 light:bg-indigo-50' : isPast ? 'text-slate-500 light:text-slate-400' : 'text-slate-200 light:text-slate-700'
                )}
              >
                <span className="capitalize">{format(month, 'LLLL yyyy', { locale: pl })}</span>
                <div className="flex items-center gap-1.5">
                  {isCurrent && (
                    <span className="text-[10px] text-indigo-400 light:text-indigo-600 font-medium">dziś</span>
                  )}
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 text-indigo-400 light:text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
