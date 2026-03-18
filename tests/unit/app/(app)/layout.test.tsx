import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRedirect = vi.hoisted(() => vi.fn())
const mockGetUser = vi.hoisted(() => vi.fn())
const mockGetSession = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
    },
  })),
}))

vi.mock('@/features/auth/components/AuthProvider', () => ({
  AuthProvider: ({
    user,
    session,
    children,
  }: {
    user: { id?: string }
    session: unknown
    children: React.ReactNode
  }) => (
    <div
      data-testid="auth-provider"
      data-user-id={user.id ?? ''}
      data-session-null={String(session === null)}
    >
      {children}
    </div>
  ),
}))

vi.mock('@/components/navigation/MobileNav', () => ({
  MobileNav: () => <div data-testid="mobile-nav" />,
}))

import AppLayout from '@/app/(app)/layout'

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
  })

  it('рендерит AuthProvider, children и MobileNav без лишнего getSession round-trip', async () => {
    const page = await AppLayout({ children: <div>child</div> })
    render(page)

    expect(screen.getByTestId('auth-provider')).toHaveAttribute('data-user-id', 'user-123')
    expect(screen.getByTestId('auth-provider')).toHaveAttribute('data-session-null', 'true')
    expect(screen.getByText('child')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument()
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  it('редиректит на /login если пользователь не авторизован', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    mockRedirect.mockImplementation(() => {
      throw new Error('REDIRECT')
    })

    await expect(AppLayout({ children: <div>child</div> })).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
})
