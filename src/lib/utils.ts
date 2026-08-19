import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isWeekend,
  startOfWeek,
} from 'date-fns'
import type { Allocation, TimeOff, ViewMode } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getViewDays(anchorDate: Date, mode: ViewMode): Date[] {
  const start = startOfWeek(anchorDate, { weekStartsOn: 1 })
  const count = mode === 'week' ? 7 : mode === '3weeks' ? 21 : mode === 'month' ? 35 : 91
  return eachDayOfInterval({ start, end: addDays(start, count - 1) })
}

export function getAllocationStyle(
  allocation: { start_date: string; end_date: string },
  days: Date[],
  dayWidth: number
) {
  const viewStart = days[0]
  const viewEnd = days[days.length - 1]

  const allocStart = new Date(allocation.start_date)
  const allocEnd = new Date(allocation.end_date)

  const clampedStart = allocStart < viewStart ? viewStart : allocStart
  const clampedEnd = allocEnd > viewEnd ? viewEnd : allocEnd

  const offsetDays = differenceInCalendarDays(clampedStart, viewStart)
  const spanDays = differenceInCalendarDays(clampedEnd, clampedStart) + 1

  return {
    left: offsetDays * dayWidth,
    width: spanDays * dayWidth - 4,
    visible: clampedStart <= viewEnd && clampedEnd >= viewStart,
  }
}

export function isAllocationInView(allocation: Allocation, days: Date[]) {
  const viewStart = days[0]
  const viewEnd = days[days.length - 1]
  const allocStart = new Date(allocation.start_date)
  const allocEnd = new Date(allocation.end_date)
  return allocStart <= viewEnd && allocEnd >= viewStart
}

// Returns { allocated: number (0-100+), free: number (0-100) }
// Weekends are ignored. OOO days reduce available capacity.
export function calcUtilization(
  allocations: Allocation[],
  days: Date[],
  capacityHoursPerDay: number,
  timeOffs: TimeOff[] = []
): { allocated: number; free: number; allocatedHours: number; capacityHours: number; ooodays: number } {
  const workdays = days.filter((d) => !isWeekend(d))

  // Count OOO workdays — they reduce available capacity
  const oooDays = workdays.filter((d) => {
    const ds = format(d, 'yyyy-MM-dd')
    return timeOffs.some((t) => ds >= t.start_date && ds <= t.end_date)
  }).length

  const availableWorkdays = workdays.length - oooDays
  const totalCapacityHours = availableWorkdays * capacityHoursPerDay

  let totalAllocatedHours = 0
  for (const alloc of allocations) {
    const overlap = workdays.filter((d) => {
      const ds = format(d, 'yyyy-MM-dd')
      // Don't count hours on OOO days
      const isOoo = timeOffs.some((t) => ds >= t.start_date && ds <= t.end_date)
      return !isOoo && ds >= alloc.start_date && ds <= alloc.end_date
    })
    totalAllocatedHours += overlap.length * alloc.hours_per_day
  }

  if (totalCapacityHours === 0) return { allocated: 0, free: 0, allocatedHours: 0, capacityHours: 0, ooodays: oooDays }

  const allocatedPct = Math.round((totalAllocatedHours / totalCapacityHours) * 100)
  const freePct = Math.max(0, 100 - allocatedPct)

  return {
    allocated: allocatedPct,
    free: freePct,
    allocatedHours: Math.round(totalAllocatedHours * 10) / 10,
    capacityHours: totalCapacityHours,
    ooodays: oooDays,
  }
}

export const PROJECT_COLORS = [
  '#6366f1',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#f97316',
  '#84cc16',
  '#14b8a6',
  '#e11d48',
]

export const AVATAR_COLORS = [
  '#6366f1',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
]

export function formatDate(date: Date | string): string {
  return format(new Date(date), 'yyyy-MM-dd')
}

// Forward-looking availability window: today through today + 13 (the next 2 weeks).
// Weekends are dropped downstream by calcUtilization.
export function getAvailabilityWindow(): Date[] {
  const today = new Date()
  return eachDayOfInterval({ start: today, end: addDays(today, 13) })
}

// Turn a calcUtilization result into a free-resources-focused label + color, so
// the People page and the Timeline present availability identically.
//
// Status (isUnavailable/isOver/isFull) is derived from the raw hours, not the
// rounded percentages — otherwise a person with a fraction of an hour free could
// be labelled "pełny", or a tiny overallocation could round down to "pełny".
// The percentage is presentation only.
export function formatAvailability(util: {
  allocated: number
  free: number
  allocatedHours: number
  capacityHours: number
}): {
  freeHours: number
  freePct: number
  isFull: boolean
  isOver: boolean
  isUnavailable: boolean
  color: string
  label: string
} {
  const { allocatedHours, capacityHours } = util
  const rawFreeHours = capacityHours - allocatedHours

  // No available capacity in the window (e.g. fully on time-off, or 0h/day) —
  // this is "not available", not "fully booked".
  const isUnavailable = capacityHours <= 0
  const isOver = !isUnavailable && rawFreeHours < 0
  const isFull = !isUnavailable && !isOver && rawFreeHours <= 0

  const freeHours = Math.max(0, Math.round(rawFreeHours * 10) / 10)
  const freePct = isUnavailable
    ? 0
    : Math.max(0, Math.min(100, Math.round((rawFreeHours / capacityHours) * 100)))

  const color = isUnavailable
    ? '#64748b'
    : isOver
      ? '#ef4444'
      : freePct <= 15
        ? '#f59e0b'
        : '#10b981'

  const label = isUnavailable
    ? 'Niedostępny'
    : isOver
      ? 'Przeciążony'
      : isFull
        ? 'Brak wolnych godzin'
        : `Wolne: ${freeHours}h z ${capacityHours}h (${freePct}%)`

  return { freeHours, freePct, isFull, isOver, isUnavailable, color, label }
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
