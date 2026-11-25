import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CONSENT_PATH } from '@/lib/oauth'
import { approveAuthorization, denyAuthorization } from './actions'

// OAuth consent screen: Supabase Auth (Authorization Path = /oauth/consent)
// sends the user here when a client such as Claude asks for access.
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string; error?: string }>
}) {
  const { authorization_id: authorizationId, error: decisionError } = await searchParams

  if (!authorizationId) {
    return <ConsentShell title="Brak żądania autoryzacji" message="Ten link nie zawiera identyfikatora autoryzacji. Spróbuj ponownie połączyć aplikację." />
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const next = `${CONSENT_PATH}?${new URLSearchParams({ authorization_id: authorizationId })}`
    redirect(`/auth/login?${new URLSearchParams({ next })}`)
  }

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)

  if (error || !data) {
    return (
      <ConsentShell
        title="Nie można przetworzyć żądania"
        message={`Żądanie autoryzacji jest nieprawidłowe albo wygasło. Spróbuj ponownie połączyć aplikację.${error ? ` (${error.message})` : ''}`}
      />
    )
  }

  // Already consented earlier.
  if (!('authorization_id' in data)) redirect(data.redirect_url)

  const clientName = data.client.name || 'Aplikacja zewnętrzna'

  return (
    <ConsentShell title={`${clientName} prosi o dostęp do Plannera`}>
      {decisionError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">
          Nie udało się zapisać decyzji: {decisionError}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-sm text-slate-300 space-y-3">
        <p>
          Zalogowany jako <span className="text-white font-medium">{data.user.email}</span>.
        </p>
        <p>
          Po zatwierdzeniu <span className="text-white font-medium">{clientName}</span> będzie mógł w Twoim imieniu
          odczytywać i zmieniać dane w Plannerze (projekty, przydziały, urlopy) z takimi samymi uprawnieniami jak Twoje konto.
        </p>
        {data.client.uri && (
          <p className="text-slate-500 break-all">Aplikacja: {data.client.uri}</p>
        )}
        <p className="text-slate-500 break-all">Przekierowanie do: {data.redirect_uri}</p>
      </div>

      <div className="flex gap-3 mt-6">
        <form action={denyAuthorization} className="flex-1">
          <input type="hidden" name="authorization_id" value={data.authorization_id} />
          <button
            type="submit"
            className="w-full border border-slate-700 hover:border-slate-500 text-slate-300 font-medium py-2.5 rounded-lg transition text-sm"
          >
            Odmów
          </button>
        </form>
        <form action={approveAuthorization} className="flex-1">
          <input type="hidden" name="authorization_id" value={data.authorization_id} />
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg transition text-sm"
          >
            Zezwól
          </button>
        </form>
      </div>
    </ConsentShell>
  )
}

function ConsentShell({ title, message, children }: { title: string; message?: string; children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="text-white font-semibold text-xl">Planner</span>
          <h1 className="text-xl font-bold text-white mt-4">{title}</h1>
          {message && <p className="text-slate-400 mt-2 text-sm">{message}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}
