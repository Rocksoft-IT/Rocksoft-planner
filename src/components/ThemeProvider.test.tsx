import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ThemeProvider, { useTheme } from './ThemeProvider'
import { createClient } from '@/lib/supabase/client'

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

type UpdateResult = { error: { message: string } | null; count: number | null }

// Each update({theme}).eq(id) call resolves via a caller-controlled promise
// instead of firing immediately, so tests can choose the order responses
// arrive in — the whole point of the sequencing fix under test.
function mockSupabase() {
  const calls: { theme: string; resolve: (r: UpdateResult) => void }[] = []
  const update = vi.fn((payload: { theme: string }) => ({
    eq: vi.fn(
      () =>
        new Promise<UpdateResult>((resolve) => {
          calls.push({ theme: payload.theme, resolve })
        })
    ),
  }))
  const from = vi.fn(() => ({ update }))
  vi.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>)
  return { calls, update }
}

function Consumer() {
  const { theme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme('light')}>light</button>
      <button onClick={() => setTheme('dark')}>dark</button>
    </div>
  )
}

function renderProvider(initialTheme: 'light' | 'dark' = 'dark') {
  return render(
    <ThemeProvider initialTheme={initialTheme} profileId="profile-1" className="wrapper">
      <Consumer />
    </ThemeProvider>
  )
}

describe('ThemeProvider', () => {
  it('does not apply the .light class when the theme is dark', () => {
    const { container } = renderProvider('dark')
    expect(container.querySelector('.wrapper')).not.toHaveClass('light')
  })

  it('applies the .light class when the theme is light', () => {
    const { container } = renderProvider('light')
    expect(container.querySelector('.wrapper')).toHaveClass('light')
  })

  it('optimistically switches theme and keeps it after a successful save', async () => {
    const user = userEvent.setup()
    const { calls } = mockSupabase()
    renderProvider('dark')

    await user.click(screen.getByText('light'))
    expect(screen.getByTestId('theme')).toHaveTextContent('light')

    expect(calls).toHaveLength(1)
    expect(calls[0].theme).toBe('light')
    calls[0].resolve({ error: null, count: 1 })

    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('light'))
  })

  it('rolls back to the previous theme when the save fails', async () => {
    const user = userEvent.setup()
    const { calls } = mockSupabase()
    renderProvider('dark')

    await user.click(screen.getByText('light'))
    expect(screen.getByTestId('theme')).toHaveTextContent('light')

    calls[0].resolve({ error: { message: 'network error' }, count: null })

    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('dark'))
  })

  it('treats a 0-row match the same as a write error and rolls back', async () => {
    const user = userEvent.setup()
    const { calls } = mockSupabase()
    renderProvider('dark')

    await user.click(screen.getByText('light'))
    calls[0].resolve({ error: null, count: 0 })

    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('dark'))
  })

  it('serializes rapid toggles instead of firing overlapping writes', async () => {
    const user = userEvent.setup()
    const { calls, update } = mockSupabase()
    renderProvider('dark')

    // Toggle to light, then to dark again before the first write resolves.
    await user.click(screen.getByText('light'))
    await user.click(screen.getByText('dark'))

    // The second toggle must be queued, not fired as a second concurrent
    // request — only one update() call should exist while the first is
    // still in flight.
    expect(update).toHaveBeenCalledTimes(1)
    expect(calls[0].theme).toBe('light')
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')

    // Resolving the first (now-stale) write should trigger the queued one.
    calls[0].resolve({ error: null, count: 1 })
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
    expect(calls[1].theme).toBe('dark')

    calls[1].resolve({ error: null, count: 1 })
    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('dark'))
  })

  it('retries a superseding queued choice instead of rolling back past it', async () => {
    const user = userEvent.setup()
    const { calls, update } = mockSupabase()
    renderProvider('dark')

    await user.click(screen.getByText('light')) // fires write #1 (light)
    await user.click(screen.getByText('dark')) // queues (dark)

    // Write #1 fails, but a newer choice (dark) is already queued, so the UI
    // should keep chasing that instead of snapping back to the pre-#1 value.
    calls[0].resolve({ error: { message: 'network error' }, count: null })

    await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
    expect(calls[1].theme).toBe('dark')
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')

    calls[1].resolve({ error: null, count: 1 })
    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('dark'))
  })
})
