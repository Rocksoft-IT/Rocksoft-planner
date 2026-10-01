import nextEnv from '@next/env'
import { fileURLToPath } from 'node:url'

// Cron can start in the user's home directory. Always load the app's own env.
const projectRoot = fileURLToPath(new URL('../', import.meta.url))
nextEnv.loadEnvConfig(projectRoot)

try {
  const secret = process.env.CRON_SECRET
  if (!secret?.trim()) throw new Error('Ustaw CRON_SECRET w lokalnym pliku .env lub .env.local.')
  const target = new URL('/api/integrations/entra/sync', process.argv[2] ?? (process.env.ENTRA_SYNC_URL?.trim() || 'http://localhost:3000'))
  if (target.protocol !== 'https:' && !(target.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))) {
    throw new Error('Użyj HTTPS lub lokalnego adresu serwera Plannera.')
  }
  const response = await fetch(target, {
    method: 'POST', headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(120_000), redirect: 'error',
  })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`Planner nie zwrócił odpowiedzi API (${response.status}). Sprawdź adres serwera.`)
  }
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? `Synchronizacja nie powiodła się (${response.status}).`)
  console.log('Zaktualizowane profile Entra:', result.updated)
  console.log('Pominięte rekordy:', result.skipped)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Synchronizacja nie powiodła się.')
  process.exitCode = 1
}
