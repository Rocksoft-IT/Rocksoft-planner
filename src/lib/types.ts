export interface Profile {
  id: string
  email: string
  full_name: string
  role: string
  capacity_hours_per_day: number
  is_admin: boolean
  avatar_color: string
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: string
  full_name: string
  role: string
  email: string
  capacity_hours_per_day: number
  avatar_color: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  color: string
  description: string | null
  start_date: string | null
  end_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Allocation {
  id: string
  person_id: string
  project_id: string
  start_date: string
  end_date: string
  hours_per_day: number
  status: 'confirmed' | 'tentative'
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  // joined
  project?: Project
  person?: Profile
  creator?: { id: string; full_name: string; email: string } | null
  editor?: { id: string; full_name: string; email: string } | null
}

export interface AllocationWithProject extends Allocation {
  project: Project
}

export interface TimeOff {
  id: string
  person_id: string
  start_date: string
  end_date: string
  type: 'vacation' | 'sick_leave' | 'other'
  notes: string | null
  created_at: string
}

export const TIME_OFF_LABELS: Record<TimeOff['type'], { label: string; emoji: string; color: string }> = {
  vacation:   { label: 'Urlop',      emoji: '🏖️', color: '#64748b' },
  sick_leave: { label: 'L4',         emoji: '🤒', color: '#94a3b8' },
  other:      { label: 'Nieobecność',emoji: '📅', color: '#475569' },
}

export type ViewMode = 'week' | '3weeks' | 'month' | 'quarter'
