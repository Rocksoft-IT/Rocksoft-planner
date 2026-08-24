'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import RoleSelect from '@/components/ui/RoleSelect'
import { createClient } from '@/lib/supabase/client'
import { AVATAR_COLORS } from '@/lib/utils'
import type { TeamMember } from '@/lib/types'

interface PersonModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  person?: TeamMember | null
}

export default function PersonModal({ open, onClose, onSaved, person }: PersonModalProps) {
  const [fullName, setFullName] = useState(person?.full_name ?? '')
  const [roles, setRoles] = useState<string[]>(person?.role ? person.role.split(',').map((role) => role.trim()).filter(Boolean) : [])
  const [email, setEmail] = useState(person?.email ?? '')
  const [capacity, setCapacity] = useState(person ? String(person.capacity_hours_per_day) : '8')
  const [avatarColor, setAvatarColor] = useState(person?.avatar_color ?? AVATAR_COLORS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const payload = {
      full_name: fullName,
      role: roles.join(', '),
      email,
      capacity_hours_per_day: parseFloat(capacity),
      avatar_color: avatarColor,
    }

    const { error: dbError } = person
      ? await supabase.from('team_members').update(payload).eq('id', person.id)
      : await supabase.from('team_members').insert(payload)

    setLoading(false)
    if (dbError) { setError(dbError.message); return }
    onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!person) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('team_members').delete().eq('id', person.id)
    setLoading(false)
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={person ? 'Edit person' : 'Add person'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Jan Kowalski"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Stanowisko</label>
          <RoleSelect value={roles} onChange={setRoles} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jan@rocksoft.pl"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Dostępność (godziny/dzień)</label>
          <input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            min="1"
            max="24"
            step="0.5"
            required
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Avatar color</label>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAvatarColor(c)}
                className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${avatarColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          {person && (
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
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">Anuluj</button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
            >
              {loading ? 'Zapisuję…' : person ? 'Zapisz' : 'Dodaj osobę'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
