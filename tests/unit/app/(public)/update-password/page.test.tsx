import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRedirect = vi.hoisted(() => vi.fn())
const mockGetUser = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}))

vi.mock('@/features/auth/components/UpdatePasswordForm', () => ({
  UpdatePasswordForm: () => <div data-testid="update-password-form" />,
}))

import UpdatePasswordPage from '@/app/(public)/update-password/page'
import { render, screen } from '@testing-library/react'

describe('UpdatePasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
  })

  it('рендерит UpdatePasswordForm при наличии сессии', async () => {
    const page = await UpdatePasswordPage()
    render(page)
    expect(screen.getByTestId('update-password-form')).toBeInTheDocument()
  })

  it('редиректит на /login при отсутствии авторизованного пользователя', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    mockRedirect.mockImplementation(() => {
      throw new Error('REDIRECT')
    })

    await expect(UpdatePasswordPage()).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
})
