'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import ColorPicker from '@/components/ui/ColorPicker'
import { createClient } from '@/lib/supabase/client'
import { PROJECT_COLORS } from '@/lib/utils'
import type { Project } from '@/lib/types'

interface ProjectModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  project?: Project | null
}

export default function ProjectModal({ open, onClose, onSaved, project }: ProjectModalProps) {
  const [name, setName] = useState(project?.name ?? '')
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0])
  const [description, setDescription] = useState(project?.description ?? '')
  const [startDate, setStartDate] = useState(project?.start_date ?? '')
  const [endDate, setEndDate] = useState(project?.end_date ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const payload = {
      name,
      color,
      description: description || null,
      start_date: startDate || null,
      end_date: endDate || null,
    }

    const { error: dbError } = project
      ? await supabase.from('projects').update(payload).eq('id', project.id)
      : await supabase.from('projects').insert(payload)

    setLoading(false)
    if (dbError) { setError(dbError.message); return }
    onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!project) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('projects').delete().eq('id', project.id)
    setLoading(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={project ? 'Edit project' : 'New project'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Project name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Acme Banking App"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Color</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional description…"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none placeholder-slate-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">End date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          {project && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="text-red-400 hover:text-red-300 text-sm transition"
            >
              Delete
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">Cancel</button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
            >
              {loading ? 'Saving…' : project ? 'Update' : 'Create project'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
