import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { CONSENT_PATH, safeLoginNext } from '@/lib/oauth'

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
    url.search = ''
    // OAuth consent (e.g. connecting Claude): come back to it after sign-in.
    // The login page only honours this exact path (safeLoginNext).
    if (pathname === CONSENT_PATH) {
      url.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    }
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute && pathname !== '/auth/reset-password') {
    const url = request.nextUrl.clone()
    url.search = ''
    const next = safeLoginNext(request.nextUrl.searchParams.get('next'))
    if (next) return NextResponse.redirect(new URL(next, request.url))
    url.pathname = '/timeline'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  // /api/* is excluded — the public competency API authenticates via its own
  // API-key check (src/lib/api/auth.ts), and /api/mcp via OAuth bearer tokens,
  // not the browser session redirect. /.well-known/* is public OAuth discovery
  // metadata for MCP clients and must never redirect to the login page.
  matcher: ['/((?!api|\\.well-known|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
