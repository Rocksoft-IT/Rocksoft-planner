'use client'

import { useEffect, useRef, useState } from 'react'
import Modal from '@/components/ui/Modal'
import RoleSelect from '@/components/ui/RoleSelect'
import { createClient } from '@/lib/supabase/client'
import { AVATAR_COLORS, cn, themedInputClass, themedPlaceholderClass, themedLabelClass, dangerButtonClass, secondaryButtonClass } from '@/lib/utils'
import type { TeamMember } from '@/lib/types'

interface PersonModalProps {
  open: boolean
  onClose: () => void
  onSaved: (notice?: string) => void
  person?: TeamMember | null
}

export default function PersonModal({ open, onClose, onSaved, person }: PersonModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={person ? 'Edit person' : 'Add person'}>
      <PersonForm key={`${person?.id ?? 'new'}:${open}`} onClose={onClose} onSaved={onSaved} person={person} />
    </Modal>
  )
}

function PersonForm({ onClose, onSaved, person }: Omit<PersonModalProps, 'open'>) {
  const active = useRef(false)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  const [fullName, setFullName] = useState(person?.full_name ?? '')
  const [roles, setRoles] = useState<string[]>(person?.role ? person.role.split(',').map((r) => r.trim()).filter(Boolean) : [])
  const [email, setEmail] = useState(person?.email ?? '')
  const [capacity, setCapacity] = useState(String(person?.capacity_hours_per_day ?? 8))
  const [avatarColor, setAvatarColor] = useState(person?.avatar_color ?? AVATAR_COLORS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const base = {
      full_name: fullName,
      role: roles.join(', '),
      email,
      capacity_hours_per_day: parseFloat(capacity),
      avatar_color: avatarColor,
    }
    try {
      // A known ID lets us sync after insert without relying on SELECT permissions
      // on the write response. A failed lookup must never cause a second insert.
      const memberId = person?.id ?? crypto.randomUUID()
      const { error: dbError } = person
        ? await supabase.from('team_members').update(base).eq('id', memberId)
        : await supabase.from('team_members').insert({ ...base, id: memberId })
      if (dbError) { setError(dbError.message); return }

      let notice: string | undefined
      const emailChanged = person && person.email.trim().toLowerCase() !== email.trim().toLowerCase()
      const nameChanged = person && !email.trim() && person.full_name !== fullName
      if ((!person || emailChanged || nameChanged) && (email.trim() || fullName.trim())) {
        try {
          const response = await fetch('/api/integrations/entra/member', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId }), signal: AbortSignal.timeout(60_000),
          })
          if (!response.ok) throw new Error('Contract lookup failed')
          const result = await response.json()
          if (result.status !== 'synced') notice = 'Osoba została zapisana. Nie znaleziono jednoznacznego typu umowy w Entra ID.'
        } catch {
          notice = 'Osoba została zapisana. Nie udało się pobrać typu umowy z Entra ID. Odczyt zostanie ponowiony przy kolejnej synchronizacji.'
        }
      }
      onSaved(notice)
      // The Entra lookup can finish after the user opens a different form.
      // Refresh the saved profile without closing that newer form.
      if (active.current) onClose()
    } catch {
      setError('Nie udało się zapisać osoby. Spróbuj ponownie.')
    } finally {
      setLoading(false)
    }
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
    if (dbError) { setError(dbError.message); return }
    onSaved()
    if (active.current) onClose()
  }

  return (
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
          <label htmlFor="person-contract-type" className={cn(themedLabelClass, 'mb-1.5')}>Typ umowy</label>
          <input
            id="person-contract-type"
            value={person?.contract_type ?? '—'}
            readOnly
            className={themedInputClass}
          />
          <p className="text-xs text-slate-500 light:text-slate-600 mt-1.5">
            {person
              ? 'Typ umowy jest pobierany z Entra ID i aktualizowany na początku miesiąca.'
              : 'Typ umowy zostanie pobrany z Entra ID po dodaniu osoby, na podstawie e-maila lub unikalnego imienia i nazwiska.'}
          </p>
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
  )
}
