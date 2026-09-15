import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import ThemeProvider from '@/components/ThemeProvider'
import type { Profile } from '@/lib/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const initialTheme = profile?.theme === 'light' ? 'light' : 'dark'

  return (
    <ThemeProvider
      initialTheme={initialTheme}
      profileId={user.id}
      className="flex h-screen bg-slate-900 overflow-hidden"
    >
      <Sidebar profile={profile as Profile | null} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </ThemeProvider>
  )
}
