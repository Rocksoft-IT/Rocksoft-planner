'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
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

  // Writes are serialized (never fired concurrently): if a save is already in
  // flight when the user toggles again, the new value is queued and sent only
  // once the in-flight write settles. Two concurrent update() calls can reach
  // Postgres out of order and leave the DB holding the older choice even
  // though the UI (and the user's actual last click) shows the newer one —
  // serializing means whichever request goes out last is always the latest one.
  const saveInFlightRef = useRef(false)
  const queuedThemeRef = useRef<Theme | null>(null)

  const persistTheme = useCallback((value: Theme, previous: Theme) => {
    saveInFlightRef.current = true
    const supabase = createClient()
    supabase
      .from('profiles')
      .update({ theme: value }, { count: 'exact' })
      .eq('id', profileId)
      .then(({ error, count }) => {
        saveInFlightRef.current = false
        const queued = queuedThemeRef.current
        queuedThemeRef.current = null

        // A missing profiles row (failed signup trigger, manually deleted row)
        // makes update() match 0 rows and still resolve with error: null — so
        // count has to be checked explicitly, or a toggle would silently no-op
        // forever with nothing ever logged.
        const failed = error ? error.message : count === 0 ? 'no profile row matched' : null
        if (failed) {
          console.error('Failed to save theme preference:', failed)
          if (queued !== null && queued !== value) {
            // A newer choice already superseded this failed one — keep
            // chasing that instead of rolling the UI back to a value the
            // user has already moved past.
            persistTheme(queued, previous)
          } else {
            // Nothing superseded this write — roll back the optimistic
            // switch instead of leaving the UI showing a theme that isn't
            // actually saved (it would otherwise silently revert on the
            // next reload with no explanation).
            setThemeState(previous)
          }
          return
        }

        if (queued !== null && queued !== value) persistTheme(queued, value)
      })
  }, [profileId])

  const setTheme = useCallback((next: Theme) => {
    if (next === theme) return
    const previous = theme
    setThemeState(next)
    if (saveInFlightRef.current) {
      queuedThemeRef.current = next
    } else {
      persistTheme(next, previous)
    }
  }, [theme, persistTheme])

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
