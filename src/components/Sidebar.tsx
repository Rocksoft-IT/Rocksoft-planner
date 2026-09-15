'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/ThemeProvider'
import type { Profile } from '@/lib/types'

const NAV = [
  {
    href: '/timeline',
    label: 'Timeline',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
      </svg>
    ),
  },
  {
    href: '/people',
    label: 'People',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>
    ),
  },
  {
    href: '/projects',
    label: 'Projects',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
      </svg>
    ),
  },
  {
    href: '/competencies',
    label: 'Kompetencje',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    ),
  },
]

interface SidebarProps {
  profile: Profile | null
}

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <aside className="w-16 lg:w-56 bg-slate-950 light:bg-white border-r border-slate-800 light:border-slate-200 flex flex-col h-screen shrink-0 sticky top-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-3 lg:px-4 border-b border-slate-800 light:border-slate-200 shrink-0">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-5 h-5">
            <path d="M8 2v3M16 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
          </svg>
        </div>
        <span className="ml-2.5 font-semibold text-white light:text-slate-900 hidden lg:block">Planner</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-2 lg:px-3 py-2.5 rounded-lg transition-colors text-sm font-medium group',
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 light:text-slate-500 hover:text-white light:hover:text-slate-900 hover:bg-slate-800 light:hover:bg-slate-100'
              )}
            >
              <span className={cn(active ? 'text-white' : 'text-slate-500 light:text-slate-400 group-hover:text-white light:group-hover:text-slate-900')}>{icon}</span>
              <span className="hidden lg:block">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-2 lg:p-3 border-t border-slate-800 light:border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                title="Theme"
                className="flex items-center gap-2.5 flex-1 min-w-0 -m-1 p-1 rounded-lg hover:bg-slate-800 light:hover:bg-slate-100 transition-colors text-left outline-none"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                  style={{ backgroundColor: profile?.avatar_color ?? '#6366f1' }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0 hidden lg:block">
                  <p className="text-sm font-medium text-white light:text-slate-900 truncate">{profile?.full_name ?? 'User'}</p>
                  <p className="text-xs text-slate-500 light:text-slate-400 truncate">{profile?.role ?? ''}</p>
                </div>
              </button>
            </DropdownMenu.Trigger>
            {/* No DropdownMenu.Portal: Modal.tsx renders in-tree too (no portal), which
                is what lets a `.light` class scoped to a dashboard ancestor reach every
                overlay despite `fixed` positioning. Portaling this menu to <body> would
                render it outside that ancestor and break `light:` overrides on it. Radix's
                Popper positioning is `position: fixed` regardless, so it still escapes the
                sidebar's own layout without needing a portal. */}
            <DropdownMenu.Content
              side="top"
              align="start"
              sideOffset={8}
              className="z-50 min-w-40 rounded-lg border border-slate-700 light:border-slate-200 bg-slate-800 light:bg-white p-1 shadow-2xl"
            >
              <DropdownMenu.Label className="px-2 py-1.5 text-xs font-medium text-slate-500 light:text-slate-400">
                Theme
              </DropdownMenu.Label>
              <DropdownMenu.RadioGroup value={theme} onValueChange={(value) => setTheme(value as 'light' | 'dark')}>
                <DropdownMenu.RadioItem
                  value="dark"
                  className={cn(
                    'flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer outline-none',
                    'text-slate-300 light:text-slate-700',
                    'hover:bg-slate-700 light:hover:bg-slate-100 data-[highlighted]:bg-slate-700 light:data-[highlighted]:bg-slate-100'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                    </svg>
                    Dark
                  </span>
                  <DropdownMenu.ItemIndicator>
                    <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5"/>
                    </svg>
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
                <DropdownMenu.RadioItem
                  value="light"
                  className={cn(
                    'flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer outline-none',
                    'text-slate-300 light:text-slate-700',
                    'hover:bg-slate-700 light:hover:bg-slate-100 data-[highlighted]:bg-slate-700 light:data-[highlighted]:bg-slate-100'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <circle cx="12" cy="12" r="4"/>
                      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                    </svg>
                    Light
                  </span>
                  <DropdownMenu.ItemIndicator>
                    <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5"/>
                    </svg>
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="text-slate-500 light:text-slate-400 hover:text-white light:hover:text-slate-900 transition hidden lg:block shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
