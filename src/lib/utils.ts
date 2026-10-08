import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isWeekend,
  parseISO,
  startOfWeek,
} from 'date-fns'
import { CONTRACT_TYPES, type Allocation, type TeamMember, type TimeOff, type ViewMode } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Shared dark/light-themed classes for form modals (PersonModal, ProjectModal,
// AllocationModal, TimeOffModal, ExperienceModal) so the two themes stay in sync
// from one place instead of drifting across five separate call sites.
export const themedInputClass =
  'w-full bg-slate-800 light:bg-white border border-slate-600 light:border-slate-300 rounded-lg px-3 py-2.5 text-white light:text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
export const themedPlaceholderClass = 'placeholder-slate-500 light:placeholder-slate-400'
// Native <option> elements ignore the parent <select>'s theme classes for the open
// dropdown list on most platforms, so they need their own themed background/text.
export const themedOptionClass = 'bg-slate-800 light:bg-white text-white light:text-slate-900'
export const themedLabelClass = 'block text-sm font-medium text-slate-300 light:text-slate-700'
export const dangerButtonClass = 'text-red-400 light:text-red-600 hover:text-red-300 light:hover:text-red-700 text-sm transition'
export const secondaryButtonClass = 'px-4 py-2 text-sm text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900 transition'

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
// Tentative allocations (not yet confirmed by the client) are excluded — they
// must not make a person look busy or overloaded.
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
    if (alloc.status === 'tentative') continue
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

// True when a 'yyyy-MM-dd' date falls on Saturday or Sunday. Parsed as a local
// date (parseISO), not UTC, so the weekday never shifts with the timezone.
export function isWeekendDate(isoDate: string): boolean {
  return isWeekend(parseISO(isoDate))
}

// Project allocations may span a weekend, but must start and end on a workday —
// nobody is assigned to a project on Saturday or Sunday. Returns the Polish
// error message to show, or null when the range is allowed.
export const WEEKEND_ALLOCATION_ERROR = 'Alokacja nie może zaczynać się ani kończyć w sobotę lub niedzielę.'
export function validateAllocationDates(startDate: string, endDate: string): string | null {
  return isWeekendDate(startDate) || isWeekendDate(endDate) ? WEEKEND_ALLOCATION_ERROR : null
}

// Workdays (Mon–Fri) in an inclusive 'yyyy-MM-dd' range — the days an
// allocation actually books hours on. Weekends inside the range book nothing.
export function countWorkdays(startDate: string, endDate: string): number {
  if (startDate > endDate) return 0
  return eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) })
    .filter((d) => !isWeekend(d)).length
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
  barPct: number
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
  // Percentage is presentation only. Keep it the exact complement of the rounded
  // allocated% (util.free === 100 - util.allocated) so "% zajęty" + "% wolne" always
  // sum to 100, and a person with any allocation never rounds up into 100% free.
  const freePct = isUnavailable ? 0 : Math.max(0, util.free)

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

  // Bar width: a partial-availability person shows their free fraction (green/amber).
  // The no-availability states (over / full / unavailable) fill the whole bar in the
  // status color, so the most important cases are the most visible — not an invisible
  // 0%-wide bar.
  const barPct = isUnavailable || isOver || isFull ? 100 : freePct

  return { freeHours, freePct, barPct, isFull, isOver, isUnavailable, color, label }
}

// Index of a contract type in the Timeline's contract-type sort group order
// (UoP → B2B → Freelance). Unset (null) sorts after every known type — FR-004.
function contractTypeSortIndex(contractType: TeamMember['contract_type']): number {
  const index = contractType ? CONTRACT_TYPES.indexOf(contractType) : -1
  return index === -1 ? CONTRACT_TYPES.length : index
}

// Timeline "Contract type" sort: UoP → B2B → Freelance → unset, alphabetically
// by full name within each group (FR-004). localeCompare matches this file's
// existing date-string sort precedent (Timeline.tsx assignLanes/assignLanesAll).
export function compareByContractType(a: TeamMember, b: TeamMember): number {
  const diff = contractTypeSortIndex(a.contract_type) - contractTypeSortIndex(b.contract_type)
  return diff !== 0 ? diff : a.full_name.localeCompare(b.full_name)
}

// Filter key for people whose contract type is unset — lets the Timeline
// contract-type filter find people still missing one.
export const NO_CONTRACT_TYPE = 'none'

// Timeline contract-type filter: an empty selection passes everyone; otherwise
// the person's type (or NO_CONTRACT_TYPE when unset) must be selected.
export function matchesContractTypeFilter(person: TeamMember, selected: string[]): boolean {
  return selected.length === 0 || selected.includes(person.contract_type ?? NO_CONTRACT_TYPE)
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
