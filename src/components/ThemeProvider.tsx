'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

interface ThemeProviderProps {
  initialTheme: Theme
  profileId: string
  className?: string
  children: React.ReactNode
}

// Renders the themed ancestor element itself (not just a headless context):
// the `light` custom variant (globals.css) only activates under a `.light`
// ancestor, and that class has to live on a Client Component's own element
// to react to `setTheme` instantly. `initialTheme` comes from the profile
// already fetched server-side in (dashboard)/layout.tsx, so the very first
// render — server and client alike — already carries the right class with
// no flash and no client-side effect. Scoped here (not on <html>) so it
// unmounts cleanly when navigating away from the dashboard, leaving
// /auth/* always dark.
export default function ThemeProvider({ initialTheme, profileId, className, children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    const supabase = createClient()
    supabase
      .from('profiles')
      .update({ theme: next })
      .eq('id', profileId)
      .then(({ error }) => {
        if (error) console.error('Failed to save theme preference:', error.message)
      })
  }, [profileId])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className={cn(className, theme === 'light' && 'light')}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
