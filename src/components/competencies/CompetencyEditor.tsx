'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { slugify } from '@/lib/competencies'
import ExperienceModal from './ExperienceModal'
import type { CompetencyKind, CompetencyTag, TeamMemberCompetency, ProjectExperience } from '@/lib/types'

interface CompetencyEditorProps {
  memberId: string
  initialTags: CompetencyTag[]
}

export default function CompetencyEditor({ memberId, initialTags }: CompetencyEditorProps) {
  const [allTags, setAllTags] = useState<CompetencyTag[]>(initialTags)
  const [competencies, setCompetencies] = useState<TeamMemberCompetency[]>([])
  const [experiences, setExperiences] = useState<ProjectExperience[]>([])
  const [loading, setLoading] = useState(true)
  const [expModalOpen, setExpModalOpen] = useState(false)
  const [editingExp, setEditingExp] = useState<ProjectExperience | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: comps }, { data: exps }] = await Promise.all([
      supabase
        .from('team_member_competencies')
        .select('*, tag:competency_tags(*)')
        .eq('team_member_id', memberId),
      supabase
        .from('project_experience')
        .select('*, tags:project_experience_tags(tag:competency_tags(*))')
        .eq('team_member_id', memberId)
        .order('start_date', { ascending: false, nullsFirst: false }),
    ])
    setCompetencies((comps ?? []) as TeamMemberCompetency[])
    // Flatten nested tag join into ProjectExperience.tags
    const flat = (exps ?? []).map((e: Record<string, unknown>) => ({
      ...e,
      tags: ((e.tags as { tag: CompetencyTag }[] | null) ?? []).map((r) => r.tag).filter(Boolean),
    })) as ProjectExperience[]
    setExperiences(flat)
    setLoading(false)
  }, [memberId])

  useEffect(() => { load() }, [load])

  async function ensureTag(kind: CompetencyKind, name: string): Promise<CompetencyTag | null> {
    const slug = slugify(name)
    if (!slug) return null
    const existing = allTags.find((t) => t.kind === kind && t.slug === slug)
    if (existing) return existing

    const supabase = createClient()
    const { data, error } = await supabase
      .from('competency_tags')
      .insert({ kind, name: name.trim(), slug, is_curated: false })
      .select('*')
      .single()
    if (error || !data) {
      // Likely a unique-conflict race — fetch the existing row.
      const { data: found } = await supabase
        .from('competency_tags').select('*').eq('kind', kind).eq('slug', slug).maybeSingle()
      if (found) { setAllTags((p) => [...p, found as CompetencyTag]); return found as CompetencyTag }
      return null
    }
    setAllTags((p) => [...p, data as CompetencyTag])
    return data as CompetencyTag
  }

  async function addCompetency(kind: CompetencyKind, name: string, proficiency: number | null, yearsExperience: number | null) {
    const tag = await ensureTag(kind, name)
    if (!tag) return
    if (competencies.some((c) => c.competency_tag_id === tag.id)) return
    const supabase = createClient()
    await supabase.from('team_member_competencies').insert({
      team_member_id: memberId,
      competency_tag_id: tag.id,
      proficiency,
      years_experience: yearsExperience,
    })
    await load()
  }

  async function removeCompetency(rowId: string) {
    const supabase = createClient()
    await supabase.from('team_member_competencies').delete().eq('id', rowId)
    await load()
  }

  if (loading) return <p className="text-slate-500 text-sm">Ładowanie…</p>

  const techOptions = allTags.filter((t) => t.kind === 'technology')

  return (
    <div className="space-y-8">
      <CompetencySection kind="skill" title="Umiejętności" competencies={competencies} allTags={allTags} onAdd={addCompetency} onRemove={removeCompetency} />
      <CompetencySection kind="technology" title="Technologie" competencies={competencies} allTags={allTags} onAdd={addCompetency} onRemove={removeCompetency} />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Doświadczenie projektowe</h3>
          <button
            onClick={() => { setEditingExp(null); setExpModalOpen(true) }}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition"
          >
            + Dodaj
          </button>
        </div>
        {experiences.length === 0 ? (
          <p className="text-slate-500 text-sm">Brak wpisów.</p>
        ) : (
          <ul className="space-y-2">
            {experiences.map((exp) => (
              <li key={exp.id} className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{exp.title}</p>
                    {exp.role && <p className="text-xs text-slate-400">{exp.role}</p>}
                    {exp.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{exp.description}</p>}
                    {(exp.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(exp.tags ?? []).map((t) => (
                          <span key={t.id} className="bg-slate-700 text-slate-300 text-[11px] px-2 py-0.5 rounded-full">{t.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setEditingExp(exp); setExpModalOpen(true) }} className="text-slate-400 hover:text-white text-xs shrink-0">Edytuj</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ExperienceModal
        open={expModalOpen}
        onClose={() => setExpModalOpen(false)}
        onSaved={load}
        memberId={memberId}
        techOptions={techOptions}
        experience={editingExp}
      />
    </div>
  )
}

interface CompetencySectionProps {
  kind: CompetencyKind
  title: string
  competencies: TeamMemberCompetency[]
  allTags: CompetencyTag[]
  onAdd: (kind: CompetencyKind, name: string, proficiency: number | null, yearsExperience: number | null) => void
  onRemove: (rowId: string) => void
}

function CompetencySection({ kind, title, competencies, allTags, onAdd, onRemove }: CompetencySectionProps) {
  const [name, setName] = useState('')
  const [proficiency, setProficiency] = useState('')
  const [years, setYears] = useState('')

  const mine = competencies.filter((c) => c.tag?.kind === kind)
  const listId = `datalist-${kind}`

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const parsedYears = years ? parseFloat(years) : NaN
    onAdd(
      kind,
      name,
      proficiency ? parseInt(proficiency, 10) : null,
      Number.isFinite(parsedYears) ? parsedYears : null
    )
    setName(''); setProficiency(''); setYears('')
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      <div className="flex flex-wrap gap-2 mb-3">
        {mine.length === 0 && <p className="text-slate-500 text-sm">Brak.</p>}
        {mine.map((c) => (
          <span key={c.id} className="group inline-flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 text-xs px-2.5 py-1 rounded-full">
            {c.tag?.name}
            {c.proficiency ? <span className="text-indigo-400/80">· {c.proficiency}/5</span> : null}
            {c.years_experience != null ? <span className="text-indigo-400/80">· {c.years_experience} l.</span> : null}
            <button onClick={() => onRemove(c.id)} className="text-indigo-400 hover:text-white" title="Usuń">×</button>
          </span>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          list={listId}
          placeholder={kind === 'skill' ? 'Dodaj umiejętność…' : 'Dodaj technologię…'}
          className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-500"
        />
        <datalist id={listId}>
          {allTags.filter((t) => t.kind === kind).map((t) => <option key={t.id} value={t.name} />)}
        </datalist>
        <select
          value={proficiency}
          onChange={(e) => setProficiency(e.target.value)}
          className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          title="Poziom (opcjonalnie)"
        >
          <option value="">Poziom</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5</option>)}
        </select>
        <input
          value={years}
          onChange={(e) => setYears(e.target.value)}
          type="number"
          min="0"
          max="50"
          step="0.5"
          placeholder="Lata"
          title="Lata doświadczenia (opcjonalnie)"
          className="w-20 bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-500"
        />
        <button type="submit" className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition">Dodaj</button>
      </form>
    </section>
  )
}
