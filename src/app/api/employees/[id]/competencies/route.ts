import { NextResponse, type NextRequest } from 'next/server'
import { requireApiKey } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// GET /api/employees/:id/competencies
// Full competency + project-experience detail for one team member.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireApiKey(request)
  if (denied) return denied

  const { id } = await params
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'Employee id must be a valid UUID.' }, { status: 400 })
  }
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('team_members')
    .select(
      `id, full_name, email, role,
       competencies:team_member_competencies(
         id, proficiency, years_experience,
         tag:competency_tags(kind, name, slug)
       ),
       experience:project_experience(
         id, title, role, description, start_date, end_date, project_id,
         tags:project_experience_tags(tag:competency_tags(kind, name, slug))
       )`
    )
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 })

  return NextResponse.json({ employee: data })
}
