import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@base-ui/react/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode
    render?: unknown
  }) => <button {...props}>{children}</button>,
}))

const { mockPush, mockSignOut } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSignOut: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/features/auth/api/auth', () => ({
  signOut: mockSignOut,
}))

const mockClearAuth = vi.fn()

vi.mock('@/features/auth/store', () => ({
  useAuthStore: (selector: (state: { clearAuth: typeof mockClearAuth }) => unknown) =>
    selector({ clearAuth: mockClearAuth }),
}))

import FeedPage from '@/app/(app)/feed/page'

describe('FeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue({})
  })

  it('рендерит заголовок и кнопку выхода', () => {
    render(<FeedPage />)

    expect(screen.getByRole('heading', { name: 'Лента' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument()
  })

  it('при клике "Выйти" вызывает signOut, clearAuth и push', async () => {
    const user = userEvent.setup()
    render(<FeedPage />)

    await user.click(screen.getByRole('button', { name: 'Выйти' }))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledOnce()
      expect(mockClearAuth).toHaveBeenCalledOnce()
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })
})
