import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_NEXT = ['/timeline', '/auth/reset-password']

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/timeline'
  const safNext = ALLOWED_NEXT.includes(next) ? next : '/timeline'

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${request.headers.get('x-forwarded-proto') ?? 'http'}://${request.headers.get('x-forwarded-host') ?? request.headers.get('host')}`

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${safNext}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`)
}
