'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { formatDate, cn } from '@/lib/utils'
import { TIME_OFF_LABELS } from '@/lib/types'
import type { TimeOff, TeamMember } from '@/lib/types'

interface TimeOffModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  timeOff?: TimeOff | null
  defaultPersonId?: string
  defaultStartDate?: string
  people: TeamMember[]
}

const TYPES: TimeOff['type'][] = ['vacation', 'sick_leave', 'other']

export default function TimeOffModal({
  open, onClose, onSaved,
  timeOff, defaultPersonId, defaultStartDate, people,
}: TimeOffModalProps) {
  const [personId, setPersonId] = useState(timeOff?.person_id ?? defaultPersonId ?? '')
  const [type, setType] = useState<TimeOff['type']>(timeOff?.type ?? 'vacation')
  const [startDate, setStartDate] = useState(timeOff?.start_date ?? defaultStartDate ?? formatDate(new Date()))
  const [endDate, setEndDate] = useState(timeOff?.end_date ?? defaultStartDate ?? formatDate(new Date()))
  const [notes, setNotes] = useState(timeOff?.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!personId) { setError('Wybierz osobę.'); return }
    if (startDate > endDate) { setError('Data końca musi być po dacie startu.'); return }

    setLoading(true)
    const supabase = createClient()
    const payload = { person_id: personId, type, start_date: startDate, end_date: endDate, notes: notes || null }

    const { error: dbError } = timeOff
      ? await supabase.from('time_off').update(payload).eq('id', timeOff.id)
      : await supabase.from('time_off').insert(payload)

    setLoading(false)
    if (dbError) { setError(dbError.message); return }
    onSaved(); onClose()
  }

  async function handleDelete() {
    if (!timeOff) return
    setLoading(true)
    await createClient().from('time_off').delete().eq('id', timeOff.id)
    setLoading(false)
    onSaved(); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={timeOff ? 'Edytuj nieobecność' : 'Dodaj nieobecność'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>
        )}

        {/* Type selector */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Rodzaj nieobecności</label>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => {
              const { label, emoji } = TIME_OFF_LABELS[t]
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition',
                    type === t
                      ? 'border-slate-400 bg-slate-700'
                      : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                  )}
                >
                  <span className="text-xl leading-none">{emoji}</span>
                  <span className={cn('text-xs font-medium', type === t ? 'text-white' : 'text-slate-400')}>
                    {label}
                  </span>
                </button>
              )
            })}
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Data startu</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Data końca</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Notatki</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="Opcjonalne notatki…"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none placeholder-slate-500" />
        </div>

        <div className="flex items-center gap-3 pt-2">
          {timeOff && (
            <button type="button" onClick={handleDelete} disabled={loading}
              className="text-red-400 hover:text-red-300 text-sm transition">Usuń</button>
          )}
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">Anuluj</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
              {loading ? 'Zapisuję…' : timeOff ? 'Zapisz' : 'Dodaj'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
