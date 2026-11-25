import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { CONSENT_PATH } from '@/lib/oauth'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isAuthRoute = pathname.startsWith('/auth')
  const isPublicRoute = isAuthRoute || pathname === '/'

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    // Return to the OAuth consent screen after sign-in (see safeLoginNext).
    if (pathname === CONSENT_PATH) {
      url.search = `?${new URLSearchParams({ next: `${pathname}${request.nextUrl.search}` })}`
    }
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute && pathname !== '/auth/reset-password') {
    const url = request.nextUrl.clone()
    url.pathname = '/timeline'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  // /api/* is excluded — the public competency API authenticates via its own
  // API-key check (src/lib/api/auth.ts) and /api/mcp via OAuth bearer tokens,
  // not the browser session redirect. /.well-known/* is public OAuth metadata.
  matcher: ['/((?!api|\\.well-known|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
