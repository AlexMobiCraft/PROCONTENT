import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRedirect, mockGetSession } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockGetSession: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getSession: mockGetSession },
  }),
}))

vi.mock('@/features/auth/components/UpdatePasswordForm', () => ({
  UpdatePasswordForm: () => <div data-testid="update-password-form" />,
}))

import UpdatePasswordPage from '@/app/(public)/update-password/page'

describe('UpdatePasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('рендерит UpdatePasswordForm при наличии активной сессии', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-123' }, access_token: 'token' } },
    })

    const page = await UpdatePasswordPage()
    render(page)

    expect(screen.getByTestId('update-password-form')).toBeInTheDocument()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('редиректит на /login при отсутствии сессии', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    await UpdatePasswordPage()

    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
})
