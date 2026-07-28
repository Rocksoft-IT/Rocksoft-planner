'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import TagMultiSelect from './TagMultiSelect'
import { createClient } from '@/lib/supabase/client'
import type { CompetencyTag, ProjectExperience } from '@/lib/types'

interface ExperienceModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  memberId: string
  techOptions: CompetencyTag[]
  experience?: ProjectExperience | null
}

export default function ExperienceModal({ open, onClose, onSaved, memberId, techOptions, experience }: ExperienceModalProps) {
  const [title, setTitle] = useState('')
  const [role, setRole] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [techSlugs, setTechSlugs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (experience) {
      setTitle(experience.title)
      setRole(experience.role ?? '')
      setDescription(experience.description ?? '')
      setStartDate(experience.start_date ?? '')
      setEndDate(experience.end_date ?? '')
      setTechSlugs((experience.tags ?? []).map((t) => t.slug))
    } else {
      setTitle(''); setRole(''); setDescription(''); setStartDate(''); setEndDate(''); setTechSlugs([])
    }
    setError('')
  }, [experience, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()

    const payload = {
      team_member_id: memberId,
      title,
      role: role || null,
      description: description || null,
      start_date: startDate || null,
      end_date: endDate || null,
    }

    let experienceId = experience?.id ?? null
    if (experienceId) {
      const { error: e1 } = await supabase.from('project_experience').update(payload).eq('id', experienceId)
      if (e1) { setError(e1.message); setLoading(false); return }
    } else {
      const { data, error: e1 } = await supabase.from('project_experience').insert(payload).select('id').single()
      if (e1 || !data) { setError(e1?.message ?? 'Nie udało się zapisać.'); setLoading(false); return }
      experienceId = data.id
    }

    // Reconcile technology tags for this experience entry.
    await supabase.from('project_experience_tags').delete().eq('experience_id', experienceId)
    const tagIds = techOptions.filter((t) => techSlugs.includes(t.slug)).map((t) => t.id)
    if (tagIds.length > 0) {
      const rows = tagIds.map((competency_tag_id) => ({ experience_id: experienceId, competency_tag_id }))
      const { error: e2 } = await supabase.from('project_experience_tags').insert(rows)
      if (e2) { setError(e2.message); setLoading(false); return }
    }

    setLoading(false)
    onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!experience) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('project_experience').delete().eq('id', experience.id)
    setLoading(false)
    onSaved()
    onClose()
  }

  const inputCls =
    'w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-500'

  return (
    <Modal open={open} onClose={onClose} title={experience ? 'Edytuj doświadczenie' : 'Dodaj doświadczenie'} className="max-w-lg">
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
