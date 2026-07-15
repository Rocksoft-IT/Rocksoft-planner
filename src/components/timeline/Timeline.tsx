'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragCancelEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  format,
  addDays,
  subDays,
  eachDayOfInterval,
  differenceInCalendarDays,
  isToday,
  isWeekend,
} from 'date-fns'
import { calcUtilization, getAllocationStyle, hexToRgba, cn, formatDate } from '@/lib/utils'
import { ROLES } from '@/components/ui/RoleSelect'
import MonthPicker from '@/components/ui/MonthPicker'
import PeopleFilter from '@/components/ui/PeopleFilter'
import ProjectFilter from '@/components/ui/ProjectFilter'
import SkillsFilter from '@/components/ui/SkillsFilter'
import type { AllocationWithProject, TeamMember, Project, TimeOff } from '@/lib/types'
import { TIME_OFF_LABELS } from '@/lib/types'
import AllocationModal from './AllocationModal'
import TimeOffModal from './TimeOffModal'
import { createClient } from '@/lib/supabase/client'

const DAY_WIDTH = 44
const DAYS_BEFORE = 180  // 6 miesięcy wstecz
const DAYS_AFTER  = 548  // ~18 miesięcy do przodu

const LANE_HEIGHT = 28   // px per allocation block
const LANE_GAP = 2       // px between lanes
const ROW_PADDING = 4    // px top + bottom

function calcRowHeight(numLanes: number) {
  return Math.max(44, ROW_PADDING * 2 + numLanes * LANE_HEIGHT + (numLanes - 1) * LANE_GAP)
}

function assignLanes(allocs: AllocationWithProject[]): (AllocationWithProject & { lane: number })[] {
  const sorted = [...allocs].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const laneEnds: string[] = []
  return sorted.map((alloc) => {
    let lane = laneEnds.findIndex((end) => alloc.start_date > end)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = alloc.end_date
    return { ...alloc, lane }
  })
}

// Combined item for lane assignment (allocation or time-off)
type LaneItem =
  | (AllocationWithProject & { lane: number; kind: 'allocation' })
  | (TimeOff & { lane: number; kind: 'timeoff' })

function assignLanesAll(
  allocs: AllocationWithProject[],
  offs: TimeOff[]
): LaneItem[] {
  type Raw = { start_date: string; end_date: string; kind: 'allocation' | 'timeoff'; data: AllocationWithProject | TimeOff }
  const items: Raw[] = [
    ...allocs.map((a) => ({ start_date: a.start_date, end_date: a.end_date, kind: 'allocation' as const, data: a })),
    ...offs.map((t) => ({ start_date: t.start_date, end_date: t.end_date, kind: 'timeoff' as const, data: t })),
  ].sort((a, b) => a.start_date.localeCompare(b.start_date))

  const laneEnds: string[] = []
  return items.map(({ kind, data }) => {
    let lane = laneEnds.findIndex((end) => data.start_date > end)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = data.end_date
    return kind === 'allocation'
      ? { ...(data as AllocationWithProject), lane, kind }
      : { ...(data as TimeOff), lane, kind }
  })
}

interface DraggableAllocBlockProps {
  id: string
  left: number
  width: number
  laneTop: number
  blockTop: number
  blockHeight: number
  bg: string
  isTentative: boolean
  hoursPerDay: number
  projectName: string
  onClick: (e: React.MouseEvent) => void
}

function DraggableAllocBlock({
  id,
  left,
  width,
  laneTop,
  blockTop,
  blockHeight,
  bg,
  isTentative,
  hoursPerDay,
  projectName,
  onClick,
}: DraggableAllocBlockProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      data-block
      onClick={onClick}
      className="absolute cursor-pointer hover:opacity-90 transition-opacity"
      style={{
        left, width, top: laneTop, height: LANE_HEIGHT,
        transform: CSS.Transform.toString(transform ? { ...transform, y: 0 } : null),
      }}
      title={`${projectName} — ${hoursPerDay}h/dzień · ${isTentative ? 'Tentative' : 'Confirmed'}`}
      {...attributes}
      {...listeners}
    >
      <div
        className="absolute rounded"
        style={{
          left: 0, right: 0,
          top: blockTop - laneTop, height: blockHeight,
          background: isTentative
            ? `repeating-linear-gradient(45deg,${hexToRgba(bg,0.12)},${hexToRgba(bg,0.12)} 4px,${hexToRgba(bg,0.28)} 4px,${hexToRgba(bg,0.28)} 8px)`
            : hexToRgba(bg, 0.25),
          borderLeft: `3px solid ${bg}`,
          borderStyle: isTentative ? 'dashed' : 'solid',
          opacity: isTentative ? 0.85 : 1,
        }}
      />
      <div className="absolute inset-0 flex items-center px-2 gap-1 overflow-hidden">
        <span className="text-xs font-medium truncate leading-none" style={{ color: bg }}>
          {projectName}
        </span>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {isTentative && (
            <span className="text-[9px] font-bold leading-none" style={{ color: bg, opacity: 0.8 }}>?</span>
          )}
          <span className="text-[10px] opacity-70 leading-none" style={{ color: bg }}>
            {hoursPerDay}h
          </span>
        </div>
      </div>
    </div>
  )
}

interface TimelineProps {
  people: TeamMember[]
  projects: Project[]
  allocations: AllocationWithProject[]
  timeOffs: TimeOff[]
  onRefresh: () => void
}

export default function Timeline({ people, projects, allocations, timeOffs, onRefresh }: TimelineProps) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([])
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [visibleDate, setVisibleDate] = useState(new Date())

  // Fixed base date — never changes, whole range rendered once
  const baseDate = useMemo(() => subDays(new Date(), DAYS_BEFORE), [])
  const totalDays = DAYS_BEFORE + DAYS_AFTER + 1
  const [modal, setModal] = useState<{
    open: boolean
    allocation?: AllocationWithProject | null
    defaultPersonId?: string
    defaultStartDate?: string
  }>({ open: false })
  const [oooModal, setOooModal] = useState<{
    open: boolean
    timeOff?: TimeOff | null
    defaultPersonId?: string
    defaultStartDate?: string
  }>({ open: false })
  const [dragError, setDragError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const days = useMemo(
    () => eachDayOfInterval({ start: baseDate, end: addDays(baseDate, totalDays - 1) }),
    [baseDate, totalDays]
  )

  // dnd-kit sensor — activation distance of 5 px keeps a click (< 5 px movement) from
  // starting a drag, while a deliberate move gesture fires dnd-kit's onDragStart.
  // 5 px > the pan gesture's implicit 3 px threshold (didDrag.current) so block clicks
  // are never mistaken for drags by either gesture system.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // True for the duration of a dnd-kit drag, and briefly after it ends — long enough
  // to swallow the click event a pointerup can still trigger on the dragged block.
  // This is the explicit guard the plan called for instead of relying solely on
  // assumed dnd-kit click-suppression behavior.
  const dragActiveRef = useRef(false)

  function handleDragStart() {
    dragActiveRef.current = true
  }

  function clearDragActive() {
    setTimeout(() => { dragActiveRef.current = false }, 0)
  }

  async function handleDragEnd(event: DragEndEvent) {
    clearDragActive()

    const alloc = allocations.find((a) => String(a.id) === String(event.active.id))
    if (!alloc) return
    const dayOffset = Math.round(event.delta.x / DAY_WIDTH)
    if (dayOffset === 0) return

    const newStart = formatDate(addDays(new Date(alloc.start_date), dayOffset))
    const newEnd = formatDate(addDays(new Date(alloc.end_date), dayOffset))

    const supabase = createClient()
    const { error } = await supabase
      .from('allocations')
      .update({ start_date: newStart, end_date: newEnd })
      .eq('id', alloc.id)

    if (error) {
      console.error('Failed to persist allocation move:', error)
      setDragError('Nie udało się zapisać przesunięcia alokacji. Spróbuj ponownie.')
      return
    }

    setDragError('')
    onRefresh()
  }

  function handleDragCancel(_event: DragCancelEvent) {
    clearDragActive()
  }

  // Drag-to-scroll state
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartScrollLeft = useRef(0)
  const didDrag = useRef(false)

  function dateToScrollLeft(date: Date) {
    return Math.max(0, differenceInCalendarDays(date, baseDate)) * DAY_WIDTH
  }

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = dateToScrollLeft(new Date())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleScroll() {
    if (!scrollRef.current) return
    const offset = Math.floor(scrollRef.current.scrollLeft / DAY_WIDTH)
    setVisibleDate(addDays(baseDate, offset))
  }

  function handleMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('[data-block]')) return
    isDragging.current = true
    didDrag.current = false
    dragStartX.current = e.pageX
    dragStartScrollLeft.current = scrollRef.current?.scrollLeft ?? 0
    e.preventDefault()
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging.current || !scrollRef.current) return
    const dx = e.pageX - dragStartX.current
    if (Math.abs(dx) > 3) didDrag.current = true
    scrollRef.current.scrollLeft = dragStartScrollLeft.current - dx
  }

  function handleMouseUp() {
    isDragging.current = false
  }

  const filteredPeople = people.filter((p) => {
    const personRoles = p.role.split(',').map((r) => r.trim())
    const passRole = selectedRoles.length === 0 || selectedRoles.some((r) => personRoles.includes(r))
    const passPeople = selectedPeopleIds.length === 0 || selectedPeopleIds.includes(p.id)
    const passProject = selectedProjectIds.length === 0 || allocations.some(
      (a) => a.person_id === p.id && selectedProjectIds.includes(a.project_id)
    )
    return passRole && passPeople && passProject
  })

  // Precompute lanes + row heights for each person (allocations + time offs combined)
  const rowData = filteredPeople.map((person) => {
    const personAllocs = allocations.filter((a) => a.person_id === person.id)
    const personOffs = timeOffs.filter((t) => t.person_id === person.id)
    const laned = assignLanesAll(personAllocs, personOffs)
    const numLanes = laned.length > 0 ? Math.max(...laned.map((a) => a.lane)) + 1 : 1
    const rowHeight = calcRowHeight(numLanes)
    return { person, laned, personAllocs, personOffs, numLanes, rowHeight }
  })

  function openCreate(personId: string, date: string) {
    setModal({ open: true, allocation: null, defaultPersonId: personId, defaultStartDate: date })
  }

  function openEdit(alloc: AllocationWithProject) {
    setModal({ open: true, allocation: alloc })
  }

  function openEditOoo(t: TimeOff) {
    setOooModal({ open: true, timeOff: t })
  }

  function navigatePrev() {
    if (scrollRef.current) scrollRef.current.scrollLeft -= 7 * DAY_WIDTH
  }

  function navigateNext() {
    if (scrollRef.current) scrollRef.current.scrollLeft += 7 * DAY_WIDTH
  }

  function scrollToToday() {
    if (scrollRef.current) scrollRef.current.scrollLeft = dateToScrollLeft(new Date())
  }

  function handleMonthChange(date: Date) {
    if (scrollRef.current) scrollRef.current.scrollLeft = dateToScrollLeft(date)
  }

  // Group days into months for header
  const monthGroups: { label: string; count: number }[] = []
  for (const day of days) {
    const label = format(day, 'MMMM yyyy')
    const last = monthGroups[monthGroups.length - 1]
    if (last?.label === label) last.count++
    else monthGroups.push({ label, count: 1 })
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
    <div className="flex flex-col h-full">
      {dragError && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm shrink-0">
          <span>{dragError}</span>
          <button
            onClick={() => setDragError('')}
            className="text-red-400 hover:text-red-300 shrink-0"
          >
            ✕
          </button>
        </div>
      )}
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 h-14 border-b border-slate-800 bg-slate-950 shrink-0 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            onClick={navigatePrev}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <button
            onClick={scrollToToday}
            className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition"
          >
            Dziś
          </button>
          <button
            onClick={navigateNext}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        <MonthPicker anchor={visibleDate} onChange={handleMonthChange} />

        <PeopleFilter
          people={people}
          selected={selectedPeopleIds}
          onChange={setSelectedPeopleIds}
        />

        <ProjectFilter
          projects={projects}
          selected={selectedProjectIds}
          onChange={setSelectedProjectIds}
        />

        <SkillsFilter
          roles={ROLES}
          selected={selectedRoles}
          onChange={setSelectedRoles}
          peopleCounts={Object.fromEntries(
            ROLES.map((r) => [r, people.filter((p) => p.role.split(',').map((x) => x.trim()).includes(r)).length])
          )}
        />

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setOooModal({ open: true })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition"
            title="Dodaj nieobecność"
          >
            <span className="text-base leading-none">🏖️</span>
            OOO
          </button>

          <button
            onClick={() => setModal({ open: true })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Przydziel
          </button>
        </div>
      </div>

      {/* Grid — single scroll container (frozen-panes pattern) */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto"
        style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
        onScroll={handleScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Inner content: sidebar width + timeline width */}
        <div style={{ width: 224 + days.length * DAY_WIDTH, minHeight: '100%' }}>

          {/* ── Sticky header row ── */}
          <div className="flex sticky top-0 z-20">
            {/* Top-left corner: sticky top + left */}
            <div
              className="shrink-0 sticky left-0 z-30 bg-slate-950 border-b border-r border-slate-800 px-4 flex items-end pb-1"
              style={{ width: 224, height: 56 }}
            >
              <span className="text-xs text-slate-500 font-medium">
                ZESPÓŁ {(selectedRoles.length > 0 || selectedPeopleIds.length > 0 || selectedProjectIds.length > 0) && `· ${filteredPeople.length}`}
              </span>
            </div>
            {/* Month + day header */}
            <div className="bg-slate-950 border-b border-slate-800" style={{ width: days.length * DAY_WIDTH }}>
              <div className="flex h-7 border-b border-slate-800">
                {monthGroups.map(({ label, count }) => (
                  <div
                    key={label}
                    className="flex items-center px-3 text-xs font-semibold text-slate-400 border-r border-slate-800"
                    style={{ width: count * DAY_WIDTH }}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="flex h-[29px]">
                {days.map((day) => {
                  const weekend = isWeekend(day)
                  const today = isToday(day)
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'flex flex-col items-center justify-center border-r border-slate-800 text-xs shrink-0',
                        weekend ? 'bg-slate-900' : '',
                        today ? 'bg-indigo-950' : ''
                      )}
                      style={{ width: DAY_WIDTH }}
                    >
                      <span className={cn('text-[10px]', weekend ? 'text-slate-600' : 'text-slate-500')}>
                        {format(day, 'EEE')[0]}
                      </span>
                      <span className={cn(
                        'text-[11px] font-medium leading-none',
                        today ? 'text-indigo-400 font-bold' : weekend ? 'text-slate-600' : 'text-slate-300'
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Person rows ── */}
          {rowData.map(({ person, laned, personAllocs, personOffs, rowHeight }) => {
            const util = calcUtilization(personAllocs, days, person.capacity_hours_per_day, personOffs)
            const { allocated, free, allocatedHours, capacityHours, ooodays } = util
            const barColor = allocated > 100 ? '#ef4444' : allocated > 85 ? '#f59e0b' : '#10b981'

            return (
            <div key={person.id} className="flex border-b border-slate-800" style={{ height: rowHeight }}>

              {/* Frozen left cell */}
              <div
                className="shrink-0 sticky left-0 z-10 bg-slate-950 border-r border-slate-800 flex items-center px-4 gap-3"
                style={{ width: 224 }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                  style={{ backgroundColor: person.avatar_color ?? '#6366f1' }}
                >
                  {person.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate leading-tight">{person.full_name}</p>
                  <div className="mt-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-slate-500">{allocatedHours}h / {capacityHours}h</span>
                      <span className="text-[10px] font-medium" style={{ color: barColor }}
                        title={`${allocated}% zajęty · ${free}% wolny`}>
                        {free > 0 ? `${free}% wolny` : 'pełny'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(allocated, 100)}%`, backgroundColor: barColor }} />
                    </div>
                    {ooodays > 0 && (
                      <p className="text-[10px] text-slate-500 mt-0.5">🏖️ {ooodays} dni OOO</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Timeline cells */}
              <div
                className="relative flex"
                style={{ width: days.length * DAY_WIDTH, height: rowHeight }}
              >
              {/* Clickable day cells */}
              {days.map((day) => {
                const weekend = isWeekend(day)
                const today = isToday(day)
                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => !weekend && !didDrag.current && openCreate(person.id, format(day, 'yyyy-MM-dd'))}
                    className={cn(
                      'h-full border-r border-slate-800 shrink-0',
                      weekend
                        ? 'bg-slate-900/50'
                        : today
                        ? 'bg-indigo-950/30 cursor-pointer hover:bg-indigo-950/50'
                        : 'cursor-pointer hover:bg-slate-800/40'
                    )}
                    style={{ width: DAY_WIDTH }}
                  />
                )
              })}

              {/* Allocation blocks — one per lane */}
              {laned.map((item) => {
                const { left, width, visible } = getAllocationStyle(item, days, DAY_WIDTH)
                if (!visible) return null

                // Lane top = where the full LANE_HEIGHT slot starts
                const laneTop = ROW_PADDING + item.lane * (LANE_HEIGHT + LANE_GAP)

                // ── OOO block — always full lane height ──
                if (item.kind === 'timeoff') {
                  const { label, emoji } = TIME_OFF_LABELS[item.type]
                  return (
                    <div
                      key={`ooo-${item.id}`}
                      data-block
                      onClick={(e) => { e.stopPropagation(); if (!didDrag.current) openEditOoo(item) }}
                      className="absolute rounded cursor-pointer flex items-center px-2 gap-1 overflow-hidden hover:opacity-80 transition-opacity"
                      style={{
                        left, width, top: laneTop, height: LANE_HEIGHT,
                        background: `repeating-linear-gradient(45deg, #1e293b, #1e293b 4px, #253047 4px, #253047 8px)`,
                        borderLeft: '3px solid #475569',
                      }}
                      title={`${label} · ${item.notes ?? ''}`}
                    >
                      <span className="text-sm leading-none">{emoji}</span>
                      <span className="text-[11px] font-medium text-slate-300 truncate leading-none">{label}</span>
                    </div>
                  )
                }

                // ── Allocation block — height proportional to hours_per_day / 8h ──
                const project = item.project
                const bg = project?.color ?? '#6366f1'
                const isTentative = item.status === 'tentative'

                // Scale height: 8h = full LANE_HEIGHT, minimum 6px so it's always visible
                const ratio = Math.min(item.hours_per_day / 8, 1)
                const blockHeight = Math.max(6, Math.round(LANE_HEIGHT * ratio))
                // Center vertically within the lane slot
                const blockTop = laneTop + Math.round((LANE_HEIGHT - blockHeight) / 2)

                return (
                  <DraggableAllocBlock
                    key={`alloc-${item.id}`}
                    id={String(item.id)}
                    left={left}
                    width={width}
                    laneTop={laneTop}
                    blockTop={blockTop}
                    blockHeight={blockHeight}
                    bg={bg}
                    isTentative={isTentative}
                    hoursPerDay={item.hours_per_day}
                    projectName={project?.name ?? ''}
                    onClick={(e) => { e.stopPropagation(); if (!didDrag.current && !dragActiveRef.current) openEdit(item) }}
                  />
                )
              })}
              </div>{/* end timeline cells */}
            </div>/* end person row */
          )})}

          {filteredPeople.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-slate-500">
              Brak osób spełniających kryteria filtrowania
            </div>
          )}

        </div>{/* end inner content */}
      </div>{/* end single scroll container */}

      <AllocationModal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        onSaved={onRefresh}
        allocation={modal.allocation}
        defaultPersonId={modal.defaultPersonId}
        defaultStartDate={modal.defaultStartDate}
        people={people}
        projects={projects}
      />

      <TimeOffModal
        open={oooModal.open}
        onClose={() => setOooModal({ open: false })}
        onSaved={onRefresh}
        timeOff={oooModal.timeOff}
        defaultPersonId={oooModal.defaultPersonId}
        defaultStartDate={oooModal.defaultStartDate}
        people={people}
      />
    </div>
    </DndContext>
  )
}
