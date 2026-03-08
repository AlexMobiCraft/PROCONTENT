import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSetUser = vi.fn()
const mockSetSession = vi.fn()
let mockStoreUser: null | { id: string } = null

vi.mock('@/features/auth/store', () => ({
  useAuthStore: Object.assign(
    (
      selector: (state: {
        user: typeof mockStoreUser
        setUser: typeof mockSetUser
        setSession: typeof mockSetSession
      }) => unknown
    ) => selector({ user: mockStoreUser, setUser: mockSetUser, setSession: mockSetSession }),
    {
      getState: () => ({
        user: mockStoreUser,
        setUser: mockSetUser,
        setSession: mockSetSession,
      }),
    }
  ),
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

  it('не перезаписывает store если user с тем же id уже установлен', () => {
    mockStoreUser = { id: '42' }

    render(
      <AuthProvider user={mockUser} session={mockSession}>
        <div>child</div>
      </AuthProvider>
    )

    expect(mockSetUser).not.toHaveBeenCalled()
    expect(mockSetSession).not.toHaveBeenCalled()
  })

  it('перезаписывает store если id пользователя изменился', () => {
    mockStoreUser = { id: 'old-id' }

    render(
      <AuthProvider user={mockUser} session={mockSession}>
        <div>child</div>
      </AuthProvider>
    )

    expect(mockSetUser).toHaveBeenCalledWith(mockUser)
    expect(mockSetSession).toHaveBeenCalledWith(mockSession)
  })

  it('инициализирует store синхронно — без waitFor', () => {
    // Проверяем, что store заполнен сразу после render, без useEffect
    render(
      <AuthProvider user={mockUser} session={mockSession}>
        <div>child</div>
      </AuthProvider>
    )

    // Без waitFor: store должен быть заполнен в момент рендера
    expect(mockSetUser).toHaveBeenCalledWith(mockUser)
    expect(mockSetSession).toHaveBeenCalledWith(mockSession)
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
