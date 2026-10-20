import { addDays, format, startOfWeek } from 'date-fns'
import { AVATAR_COLORS, PROJECT_COLORS } from '../../src/lib/utils'
import { CONTRACT_TYPES, type AllocationWithProject, type Project, type TeamMember, type TimeOff } from '../../src/lib/types'

const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
const start = format(monday, 'yyyy-MM-dd')
const end = format(addDays(monday, 18), 'yyyy-MM-dd')
const timestamps = { created_at: start, updated_at: start }

export const projects: Project[] = [...PROJECT_COLORS, '#112244', '#ffffff', '#000000'].map((color, i) => ({
  id: `project-${i}`, name: `Projekt ${i + 1}`, color,
  description: 'Opis projektu i jego zakresu', start_date: start, end_date: end,
  created_by: null, ...timestamps,
}))

export const people: TeamMember[] = projects.map((_, i) => ({
  id: `person-${i}`, full_name: `Osoba ${i + 1}`, role: i % 3 ? 'Developer' : '',
  email: i % 3 ? `osoba${i + 1}@example.test` : '', capacity_hours_per_day: i === 5 ? 0 : i === 3 ? 2 : 8,
  avatar_color: AVATAR_COLORS[i % AVATAR_COLORS.length], contract_type: CONTRACT_TYPES[i % CONTRACT_TYPES.length],
  ...timestamps,
}))

// 1h, 2h, full, overload, zero capacity, tentative and free people.
export const allocations: AllocationWithProject[] = projects.flatMap((project, i) => i === 6 ? [] : [{
  id: `allocation-${i}`, person_id: people[i].id, project_id: project.id, project,
  start_date: start, end_date: end, hours_per_day: i === 3 ? 2 : [1, 2, 7, 8, 10, 1][i % 6],
  status: i === 0 || (i >= 7 && i % 3 === 0) ? 'tentative' as const : 'confirmed' as const,
  notes: null, created_by: null, updated_by: null, ...timestamps,
}])

export const timeOffs: TimeOff[] = [{
  id: 'timeoff', person_id: people[6].id, type: 'vacation',
  start_date: start, end_date: end, notes: null, created_at: start,
}]

export const tags = [
  { id: 'skill', name: 'Analiza', slug: 'analiza', kind: 'skill' as const },
  { id: 'technology', name: 'React', slug: 'react', kind: 'technology' as const },
].map((tag) => ({ ...tag, is_curated: true, created_by: null, updated_by: null, ...timestamps }))

export const competencies = tags.map((tag) => ({
  id: tag.id, team_member_id: people[0].id, competency_tag_id: tag.id,
  proficiency: 4, years_experience: 3, tag, ...timestamps,
}))

export const experiences = [{
  id: 'experience', title: 'Platforma 3D', role: 'Developer', description: 'Konfigurator produktu',
  start_date: start, end_date: end, tags: [{ tag: tags[1] }],
}]

export const results = [{
  team_member_id: people[0].id, full_name: people[0].full_name, email: people[0].email,
  role: 'Developer', score: 2.5,
  matched: { skills_technologies: tags, experience: [{ id: 'experience', title: 'Platforma 3D', role: 'Developer' }] },
}]
