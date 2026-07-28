'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import TagMultiSelect from '@/components/competencies/TagMultiSelect'
import CompetencyEditor from '@/components/competencies/CompetencyEditor'
import type { CompetencyTag, TeamMember, ExpertSearchResult } from '@/lib/types'

interface CompetenciesClientProps {
  tags: CompetencyTag[]
  members: TeamMember[]
  myMemberId: string | null
  isAdmin: boolean
}

type Tab = 'search' | 'edit'

export default function CompetenciesClient({ tags, members, myMemberId, isAdmin }: CompetenciesClientProps) {
  const [tab, setTab] = useState<Tab>('search')

  const skillOptions = tags.filter((t) => t.kind === 'skill')
  const techOptions = tags.filter((t) => t.kind === 'technology')

  // Search state
  const [skillSlugs, setSkillSlugs] = useState<string[]>([])
  const [techSlugs, setTechSlugs] = useState<string[]>([])
  const [text, setText] = useState('')
  const [results, setResults] = useState<ExpertSearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)

  // Edit state — admins can edit anyone; everyone else edits their own record.
  const [editMemberId, setEditMemberId] = useState<string | null>(myMemberId)

  async function runSearch() {
    setSearching(true)
    const supabase = createClient()
    const { data } = await supabase.rpc('search_experts', {
      p_skill_slugs: skillSlugs,
      p_tech_slugs: techSlugs,
      p_query: text.trim() || null,
    })
    setResults((data ?? []) as ExpertSearchResult[])
    setSearching(false)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-8 py-8">
      <h1 className="text-xl font-semibold text-white mb-1">Baza kompetencji</h1>
      <p className="text-sm text-slate-400 mb-6">Wyszukuj ekspertów i uzupełniaj swoje kompetencje.</p>

      <div className="flex gap-1 mb-6 border-b border-slate-800">
        <TabButton active={tab === 'search'} onClick={() => setTab('search')}>Wyszukiwarka</TabButton>
        <TabButton active={tab === 'edit'} onClick={() => setTab('edit')}>Moje kompetencje</TabButton>
      </div>

      {tab === 'search' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Umiejętności</label>
            <TagMultiSelect options={skillOptions} value={skillSlugs} onChange={setSkillSlugs} placeholder="Dowolne umiejętności…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Technologie</label>
            <TagMultiSelect options={techOptions} value={techSlugs} onChange={setTechSlugs} placeholder="Dowolne technologie…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Opis / słowa kluczowe</label>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
              placeholder="np. konfigurator 3D, e-commerce…"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
            />
          </div>
          <button
            onClick={runSearch}
            disabled={searching}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
          >
            {searching ? 'Szukam…' : 'Szukaj ekspertów'}
          </button>

          {results !== null && (
            <div className="pt-2">
              {results.length === 0 ? (
                <p className="text-slate-500 text-sm">Brak dopasowań.</p>
              ) : (
                <ul className="space-y-2">
                  {results.map((r) => (
                    <li key={r.team_member_id} className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">{r.full_name}</p>
                          <p className="text-xs text-slate-400">{r.role || r.email}</p>
                        </div>
                        <span className="text-xs text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full shrink-0">
                          {Math.round(r.score * 100) / 100} pkt
                        </span>
                      </div>
                      {r.matched.skills_technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {r.matched.skills_technologies.map((m) => (
                            <span key={m.slug} className="bg-slate-700 text-slate-300 text-[11px] px-2 py-0.5 rounded-full">{m.name}</span>
                          ))}
                        </div>
                      )}
                      {r.matched.experience.length > 0 && (
                        <p className="text-[11px] text-slate-500 mt-2">
                          Doświadczenie: {r.matched.experience.map((e) => e.title).join(', ')}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'edit' && (
        <div className="space-y-5">
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Edytuj osobę (admin)</label>
              <select
                value={editMemberId ?? ''}
                onChange={(e) => setEditMemberId(e.target.value || null)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="">— wybierz —</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
          )}

          {editMemberId ? (
            <CompetencyEditor key={editMemberId} memberId={editMemberId} initialTags={tags} />
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-amber-300 text-sm">
              Twoje konto nie jest powiązane z osobą w zespole (brak dopasowania po adresie e-mail).
              {isAdmin ? ' Wybierz osobę powyżej.' : ' Skontaktuj się z administratorem, aby powiązać profil.'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition',
        active ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-white'
      )}
    >
      {children}
    </button>
  )
}
