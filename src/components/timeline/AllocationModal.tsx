'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { formatDate, cn } from '@/lib/utils'
import { TIME_OFF_LABELS } from '@/lib/types'
import type { Allocation, TeamMember, Project, TimeOff } from '@/lib/types'

interface AllocationModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  allocation?: Allocation | null
  defaultPersonId?: string
  defaultStartDate?: string
  people: TeamMember[]
  projects: Project[]
}

type EntryKind = 'project' | 'timeoff'
const TIME_OFF_TYPES: TimeOff['type'][] = ['vacation', 'sick_leave', 'other']

export default function AllocationModal({
  open,
  onClose,
  onSaved,
  allocation,
  defaultPersonId,
  defaultStartDate,
  people,
  projects,
}: AllocationModalProps) {
  // What kind of entry is being created — project allocation or time off (urlop).
  // Mutually exclusive; only offered on create (editing is always a project alloc).
  const [kind, setKind] = useState<EntryKind>('project')
  const [personId, setPersonId] = useState(defaultPersonId ?? '')
  const [projectId, setProjectId] = useState('')
  const [projectQuery, setProjectQuery] = useState('')
  const [timeOffType, setTimeOffType] = useState<TimeOff['type']>('vacation')
  const [startDate, setStartDate] = useState(defaultStartDate ?? formatDate(new Date()))
  const [endDate, setEndDate] = useState(defaultStartDate ?? formatDate(new Date()))
  const [hoursPerDay, setHoursPerDay] = useState('8')
  const [status, setStatus] = useState<'confirmed' | 'tentative'>('confirmed')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (allocation) {
      setKind('project')
      setPersonId(allocation.person_id)
      setProjectId(allocation.project_id)
      setStartDate(allocation.start_date)
      setEndDate(allocation.end_date)
      setHoursPerDay(String(allocation.hours_per_day))
      setStatus(allocation.status ?? 'confirmed')
      setNotes(allocation.notes ?? '')
    } else {
      setKind('project')
      setPersonId(defaultPersonId ?? '')
      setProjectId('')
      setTimeOffType('vacation')
      setStartDate(defaultStartDate ?? formatDate(new Date()))
      setEndDate(defaultStartDate ?? formatDate(new Date()))
      setHoursPerDay('8')
      setStatus('confirmed')
      setNotes('')
    }
    setProjectQuery('')
    setError('')
  }, [allocation, defaultPersonId, defaultStartDate, open])

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(projectQuery.toLowerCase())
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!personId) { setError('Wybierz osobę.'); return }
    if (startDate > endDate) { setError('Data końca musi być po dacie startu.'); return }

    setLoading(true)
    const supabase = createClient()

    // ── Time off (urlop / L4 / nieobecność) → time_off table ──
    if (kind === 'timeoff' && !allocation) {
      const { error: dbError } = await supabase.from('time_off').insert({
        person_id: personId,
        type: timeOffType,
        start_date: startDate,
        end_date: endDate,
        notes: notes || null,
      })
      setLoading(false)
      if (dbError) { setError(dbError.message); return }
      onSaved()
      onClose()
      return
    }

    // ── Project allocation → allocations table ──
    if (!projectId) { setError('Wybierz projekt.'); return }

    const payload = {
      person_id: personId,
      project_id: projectId,
      start_date: startDate,
      end_date: endDate,
      hours_per_day: parseFloat(hoursPerDay),
      status,
      notes: notes || null,
    }

    // created_by/updated_by/updated_at are stamped server-side from the
    // authenticated session (see set_allocation_audit_fields trigger) — not
    // client-supplied, so a request can't be forged to attribute a change
    // to someone else, and every write path stays in sync.
    let dbError = null
    if (allocation) {
      const res = await supabase
        .from('allocations')
        .update(payload)
        .eq('id', allocation.id)
      dbError = res.error
    } else {
      const res = await supabase.from('allocations').insert(payload)
      dbError = res.error
    }

    setLoading(false)
    if (dbError) {
      console.error('Allocation save failed:', dbError)
      setError('Nie udało się zapisać alokacji. Spróbuj ponownie.')
      return
    }
    onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!allocation) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('allocations').delete().eq('id', allocation.id)
    setLoading(false)
    onSaved()
    onClose()
  }

  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }) : null

  const creatorName = allocation?.creator?.full_name || allocation?.creator?.email || null
  const editorName = allocation?.editor?.full_name || allocation?.editor?.email || null
  const createdAtLabel = fmtDate(allocation?.created_at)
  const updatedAtLabel = fmtDate(allocation?.updated_at)

  const isTimeOff = kind === 'timeoff' && !allocation
  const title = allocation
    ? 'Edytuj alokację'
    : isTimeOff
      ? 'Nowy urlop / nieobecność'
      : 'Nowa alokacja'

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Kind toggle — projekt vs urlop (create only, mutually exclusive) */}
        {!allocation && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Typ wpisu</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind('project')}
                className={cn(
                  'flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 transition text-sm font-semibold',
                  kind === 'project'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                )}
              >
                📁 Projekt
              </button>
              <button
                type="button"
                onClick={() => setKind('timeoff')}
                className={cn(
                  'flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 transition text-sm font-semibold',
                  kind === 'timeoff'
                    ? 'border-slate-400 bg-slate-700 text-white'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                )}
              >
                🏖️ Urlop
              </button>
            </div>
          </div>
        )}

        {/* Status toggle — project only */}
        {!isTimeOff && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Status projektu</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('confirmed')}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-3 rounded-xl border-2 transition text-left',
                  status === 'confirmed'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                )}
              >
                <div className={cn(
                  'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                  status === 'confirmed' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-500'
                )}>
                  {status === 'confirmed' && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  )}
                </div>
                <div>
                  <p className={cn('text-sm font-semibold', status === 'confirmed' ? 'text-emerald-400' : 'text-slate-300')}>
                    Confirmed
                  </p>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Klient podpisał umowę</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatus('tentative')}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-3 rounded-xl border-2 transition text-left',
                  status === 'tentative'
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                )}
              >
                <div className={cn(
                  'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                  status === 'tentative' ? 'border-amber-500 bg-amber-500' : 'border-slate-500'
                )}>
                  {status === 'tentative' && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01"/>
                    </svg>
                  )}
                </div>
                <div>
                  <p className={cn('text-sm font-semibold', status === 'tentative' ? 'text-amber-400' : 'text-slate-300')}>
                    Tentative
                  </p>
                  <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Czekamy na decyzję</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Time-off type selector — urlop only */}
        {isTimeOff && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Rodzaj nieobecności</label>
            <div className="grid grid-cols-3 gap-2">
              {TIME_OFF_TYPES.map((t) => {
                const { label, emoji } = TIME_OFF_LABELS[t]
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTimeOffType(t)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition',
                      timeOffType === t
                        ? 'border-slate-400 bg-slate-700'
                        : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                    )}
                  >
                    <span className="text-xl leading-none">{emoji}</span>
                    <span className={cn('text-xs font-medium', timeOffType === t ? 'text-white' : 'text-slate-400')}>
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Osoba</label>
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Wybierz osobę…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </div>

        {/* Projekt — searchable picker (project only) */}
        {!isTimeOff && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Projekt</label>
            <div className="bg-slate-800 border border-slate-600 rounded-lg overflow-hidden focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
                <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input
                  type="text"
                  value={projectQuery}
                  onChange={(e) => setProjectQuery(e.target.value)}
                  placeholder="Szukaj projektu…"
                  className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                />
                {projectQuery && (
                  <button type="button" onClick={() => setProjectQuery('')} className="text-slate-500 hover:text-white">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
              <div className="max-h-44 overflow-y-auto py-1">
                {filteredProjects.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-slate-500 text-center">Brak wyników</p>
                ) : (
                  filteredProjects.map((p) => {
                    const isSelected = projectId === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setProjectId(p.id)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-left transition hover:bg-slate-700',
                          isSelected ? 'bg-slate-700/60' : ''
                        )}
                      >
                        <span className={cn(
                          'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition',
                          isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600'
                        )}>
                          {isSelected && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                          )}
                        </span>
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color ?? '#6366f1' }} />
                        <span className={cn('text-sm truncate', isSelected ? 'text-white font-medium' : 'text-slate-300')}>
                          {p.name}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Data startu</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Data końca</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Godziny / dzień — project only */}
        {!isTimeOff && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Godziny / dzień</label>
            <input
              type="number"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(e.target.value)}
              min="0.5"
              max="24"
              step="0.5"
              required
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Notatki</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Opcjonalne notatki…"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none placeholder-slate-500"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          {allocation && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="text-red-400 hover:text-red-300 text-sm transition"
            >
              Usuń
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
            >
              {loading ? 'Zapisuję…' : allocation ? 'Zapisz' : 'Utwórz'}
            </button>
          </div>
        </div>

        {/* Audit footer — who last edited (and who first created) this allocation,
            so you know which manager to contact about the assignment. */}
        {allocation && (
          <div className="border-t border-slate-800 pt-3 space-y-1">
            <p className="text-xs text-slate-500">
              {editorName ? (
                <>Ostatnio edytowane przez <span className="text-slate-300 font-medium">{editorName}</span></>
              ) : (
                <span className="italic">Brak informacji o ostatniej edycji</span>
              )}
              {updatedAtLabel && <> · {updatedAtLabel}</>}
            </p>
            {creatorName && (
              <p className="text-[11px] text-slate-600">
                Utworzone przez {creatorName}{createdAtLabel && <> · {createdAtLabel}</>}
              </p>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}
