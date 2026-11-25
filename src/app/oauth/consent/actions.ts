'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CONSENT_PATH } from '@/lib/oauth'

// Supabase Auth records the decision and returns the client's redirect URL.
async function decide(formData: FormData, approve: boolean) {
  const authorizationId = String(formData.get('authorization_id') ?? '')
  if (!authorizationId) redirect(CONSENT_PATH)

  const supabase = await createClient()
  const { data, error } = approve
    ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
    : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true })

  if (error || !data?.redirect_url) {
    const params = new URLSearchParams({ authorization_id: authorizationId, error: error?.message ?? 'unknown_error' })
    redirect(`${CONSENT_PATH}?${params}`)
  }

  redirect(data.redirect_url)
}

export async function approveAuthorization(formData: FormData) {
  await decide(formData, true)
}

export async function denyAuthorization(formData: FormData) {
  await decide(formData, false)
}
