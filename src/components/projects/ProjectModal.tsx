'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import ColorPicker from '@/components/ui/ColorPicker'
import { createClient } from '@/lib/supabase/client'
import { PROJECT_COLORS, cn, themedInputClass, themedPlaceholderClass, themedLabelClass, dangerButtonClass, secondaryButtonClass } from '@/lib/utils'
import type { Project } from '@/lib/types'

interface ProjectModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  project?: Project | null
}

export default function ProjectModal({ open, onClose, onSaved, project }: ProjectModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PROJECT_COLORS[0])
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (project) {
      setName(project.name)
      setColor(project.color)
      setDescription(project.description ?? '')
      setStartDate(project.start_date ?? '')
      setEndDate(project.end_date ?? '')
    } else {
      setName('')
      setColor(PROJECT_COLORS[0])
      setDescription('')
      setStartDate('')
      setEndDate('')
    }
    setError('')
  }, [project, open])

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
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 light:text-red-600 text-sm">{error}</div>
        )}

        <div>
          <label className={cn(themedLabelClass, 'mb-1.5')}>Project name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Acme Banking App"
            className={cn(themedInputClass, themedPlaceholderClass)}
          />
        </div>

        <div>
          <label className={cn(themedLabelClass, 'mb-2')}>Color</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        <div>
          <label className={cn(themedLabelClass, 'mb-1.5')}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional description…"
            className={cn(themedInputClass, 'resize-none', themedPlaceholderClass)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={cn(themedLabelClass, 'mb-1.5')}>Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={themedInputClass}
            />
          </div>
          <div>
            <label className={cn(themedLabelClass, 'mb-1.5')}>End date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={themedInputClass}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          {project && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className={dangerButtonClass}
            >
              Delete
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
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
