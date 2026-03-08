import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSetUser = vi.fn()
const mockSetSession = vi.fn()
let mockStoreUser: null | { id: string } = null

vi.mock('@/features/auth/store', () => ({
  useAuthStore: (
    selector: (state: {
      user: typeof mockStoreUser
      setUser: typeof mockSetUser
      setSession: typeof mockSetSession
    }) => unknown
  ) => selector({ user: mockStoreUser, setUser: mockSetUser, setSession: mockSetSession }),
}))

import { AuthProvider } from '@/features/auth/components/AuthProvider'
import type { Session, User } from '@supabase/supabase-js'

const mockUser = { id: '42', email: 'test@example.com' } as User
const mockSession = { access_token: 'tok', user: mockUser } as unknown as Session

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreUser = null
  })

  it('инициализирует store при пустом user в store', () => {
    render(
      <AuthProvider user={mockUser} session={mockSession}>
        <div>child</div>
      </AuthProvider>
    )

    expect(mockSetUser).toHaveBeenCalledWith(mockUser)
    expect(mockSetSession).toHaveBeenCalledWith(mockSession)
  })

  it('не перезаписывает store если user уже установлен', () => {
    mockStoreUser = { id: '42' }

    render(
      <AuthProvider user={mockUser} session={mockSession}>
        <div>child</div>
      </AuthProvider>
    )

    expect(mockSetUser).not.toHaveBeenCalled()
    expect(mockSetSession).not.toHaveBeenCalled()
  })

  it('рендерит children', () => {
    const { getByText } = render(
      <AuthProvider user={mockUser} session={mockSession}>
        <span>inner content</span>
      </AuthProvider>
    )

    expect(getByText('inner content')).toBeInTheDocument()
  })
})
