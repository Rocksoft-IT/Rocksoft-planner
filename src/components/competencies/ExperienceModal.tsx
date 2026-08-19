'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import TagMultiSelect from './TagMultiSelect'
import { createClient } from '@/lib/supabase/client'
import type { CompetencyTag, ProjectExperience } from '@/lib/types'

interface ExperienceModalProps {
  onClose: () => void
  onSaved: () => void
  memberId: string
  techOptions: CompetencyTag[]
  experience?: ProjectExperience | null
}

// The parent mounts this fresh per open (keyed by experience id), so state is
// initialized straight from props — no prop→state syncing effect needed.
export default function ExperienceModal({ onClose, onSaved, memberId, techOptions, experience }: ExperienceModalProps) {
  const [title, setTitle] = useState(experience?.title ?? '')
  const [role, setRole] = useState(experience?.role ?? '')
  const [description, setDescription] = useState(experience?.description ?? '')
  const [startDate, setStartDate] = useState(experience?.start_date ?? '')
  const [endDate, setEndDate] = useState(experience?.end_date ?? '')
  const [techSlugs, setTechSlugs] = useState<string[]>((experience?.tags ?? []).map((t) => t.slug))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()

    // Single transactional RPC: upsert the row and reconcile its tags atomically,
    // so a failure can't leave a saved experience with the wrong (or no) tags.
    const tagIds = techOptions.filter((t) => techSlugs.includes(t.slug)).map((t) => t.id)
    const { error: err } = await supabase.rpc('save_project_experience', {
      p_experience_id: experience?.id ?? null,
      p_member_id: memberId,
      p_title: title,
      p_role: role || null,
      p_description: description || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_tag_ids: tagIds,
    })
    if (err) { setError(err.message); setLoading(false); return }

    setLoading(false)
    onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!experience) return
    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('project_experience').delete().eq('id', experience.id)
    if (err) { setError(err.message); setLoading(false); return }
    setLoading(false)
    onSaved()
    onClose()
  }

  const inputCls =
    'w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-500'

  return (
    <Modal open onClose={onClose} title={experience ? 'Edytuj doświadczenie' : 'Dodaj doświadczenie'} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Projekt / tytuł</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="np. Konfigurator 3D dla producenta mebli" className={inputCls} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Rola</label>
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="np. Frontend Developer" className={inputCls} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Opis</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Czym się zajmowałeś/aś, co powstało…" className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Od</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Do</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Technologie</label>
          <TagMultiSelect options={techOptions} value={techSlugs} onChange={setTechSlugs} placeholder="Wybierz technologie…" />
        </div>

        <div className="flex items-center gap-3 pt-2">
          {experience && (
            <button type="button" onClick={handleDelete} disabled={loading} className="text-red-400 hover:text-red-300 text-sm transition">Usuń</button>
          )}
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">Anuluj</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
              {loading ? 'Zapisuję…' : 'Zapisz'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
