'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { formatDate, cn } from '@/lib/utils'
import type { Allocation, TeamMember, Project } from '@/lib/types'

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
  const [personId, setPersonId] = useState(defaultPersonId ?? '')
  const [projectId, setProjectId] = useState('')
  const [startDate, setStartDate] = useState(defaultStartDate ?? formatDate(new Date()))
  const [endDate, setEndDate] = useState(defaultStartDate ?? formatDate(new Date()))
  const [hoursPerDay, setHoursPerDay] = useState('8')
  const [status, setStatus] = useState<'confirmed' | 'tentative'>('confirmed')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (allocation) {
      setPersonId(allocation.person_id)
      setProjectId(allocation.project_id)
      setStartDate(allocation.start_date)
      setEndDate(allocation.end_date)
      setHoursPerDay(String(allocation.hours_per_day))
      setStatus(allocation.status ?? 'confirmed')
      setNotes(allocation.notes ?? '')
    } else {
      setPersonId(defaultPersonId ?? '')
      setProjectId('')
      setStartDate(defaultStartDate ?? formatDate(new Date()))
      setEndDate(defaultStartDate ?? formatDate(new Date()))
      setHoursPerDay('8')
      setStatus('confirmed')
      setNotes('')
    }
    setError('')
  }, [allocation, defaultPersonId, defaultStartDate, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!personId || !projectId) { setError('Wybierz osobę i projekt.'); return }
    if (startDate > endDate) { setError('Data końca musi być po dacie startu.'); return }

    setLoading(true)
    const supabase = createClient()

    const payload = {
      person_id: personId,
      project_id: projectId,
      start_date: startDate,
      end_date: endDate,
      hours_per_day: parseFloat(hoursPerDay),
      status,
      notes: notes || null,
    }

    // created_by/updated_by are stamped server-side from the authenticated
    // session (see set_allocation_audit_fields trigger) — not client-supplied,
    // so a request can't be forged to attribute a change to someone else.
    let dbError = null
    if (allocation) {
      const res = await supabase
        .from('allocations')
        .update({ ...payload, updated_at: new Date().toISOString() })
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={allocation ? 'Edytuj alokację' : 'Nowa alokacja'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Status toggle — prominently at the top */}
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

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Projekt</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Wybierz projekt…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

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
