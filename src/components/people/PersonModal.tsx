'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import RoleSelect from '@/components/ui/RoleSelect'
import { createClient } from '@/lib/supabase/client'
import { AVATAR_COLORS, cn, themedInputClass, themedPlaceholderClass, themedLabelClass, dangerButtonClass, secondaryButtonClass } from '@/lib/utils'
import type { TeamMember } from '@/lib/types'

interface PersonModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  person?: TeamMember | null
}

export default function PersonModal({ open, onClose, onSaved, person }: PersonModalProps) {
  const [fullName, setFullName] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [email, setEmail] = useState('')
  const [capacity, setCapacity] = useState('8')
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (person) {
      setFullName(person.full_name)
      setRoles(person.role ? person.role.split(',').map((r) => r.trim()).filter(Boolean) : [])
      setEmail(person.email)
      setCapacity(String(person.capacity_hours_per_day))
      setAvatarColor(person.avatar_color)
    } else {
      setFullName('')
      setRoles([])
      setEmail('')
      setCapacity('8')
      setAvatarColor(AVATAR_COLORS[0])
    }
    setError('')
  }, [person, open])

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
    if (dbError) {
      console.error('Person save failed:', dbError)
      setError('Nie udało się zapisać danych osoby. Spróbuj ponownie.')
      return
    }
    onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!person) return
    // Every table named here really is removed: allocations / time_off by the rpc,
    // competencies + project experience by ON DELETE CASCADE on team_members(id).
    // This dialog is the only guard on an irreversible delete, so it names all of them.
    if (!confirm(`Usunąć ${person.full_name}? Zniknie z listy wraz ze wszystkimi alokacjami, nieobecnościami, kompetencjami i doświadczeniem projektowym. Tej operacji nie można cofnąć.`)) return
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: dbError } = await supabase.rpc('delete_team_member', { p_id: person.id })
    setLoading(false)
    if (dbError) {
      console.error('Person delete failed:', dbError)
      setError('Nie udało się usunąć osoby. Spróbuj ponownie.')
      return
    }
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={person ? 'Edit person' : 'Add person'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 light:text-red-600 text-sm">{error}</div>
        )}

        <div>
          <label className={cn(themedLabelClass, 'mb-1.5')}>Full name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Jan Kowalski"
            className={cn(themedInputClass, themedPlaceholderClass)}
          />
        </div>

        <div>
          <label className={cn(themedLabelClass, 'mb-1.5')}>Stanowisko</label>
          <RoleSelect value={roles} onChange={setRoles} />
        </div>

        <div>
          <label className={cn(themedLabelClass, 'mb-1.5')}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jan@rocksoft.pl"
            className={cn(themedInputClass, themedPlaceholderClass)}
          />
        </div>

        <div>
          <label className={cn(themedLabelClass, 'mb-1.5')}>Dostępność (godziny/dzień)</label>
          <input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            min="1"
            max="24"
            step="0.5"
            required
            className={themedInputClass}
          />
        </div>

        <div>
          <label className={cn(themedLabelClass, 'mb-2')}>Avatar color</label>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAvatarColor(c)}
                className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${avatarColor === c ? 'ring-2 ring-white light:ring-slate-900 ring-offset-2 ring-offset-slate-900 light:ring-offset-white scale-110' : ''}`}
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
              className={dangerButtonClass}
            >
              Usuń
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose} className={secondaryButtonClass}>Anuluj</button>
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
