import { NextResponse, type NextRequest } from 'next/server'
import { requireApiKey } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// GET /api/employees
// Lists every team member with a summary of their skills / technologies.
export async function GET(request: NextRequest) {
  const denied = requireApiKey(request)
  if (denied) return denied

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('team_members')
    .select(
      `id, full_name, email, role,
       competencies:team_member_competencies(
         proficiency, years_experience,
         tag:competency_tags(kind, name, slug)
       )`
    )
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ employees: data ?? [] })
}
