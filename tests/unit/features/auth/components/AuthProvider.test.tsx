import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSetUser = vi.fn()
const mockSetSession = vi.fn()
const mockSetReady = vi.fn()
let mockStoreUser: null | { id: string } = null
let mockStoreSession: null | { access_token: string } = null

vi.mock('@/features/auth/store', () => ({
  useAuthStore: Object.assign(
    (
      selector: (state: {
        user: typeof mockStoreUser
        session: typeof mockStoreSession
        setUser: typeof mockSetUser
        setSession: typeof mockSetSession
        setReady: typeof mockSetReady
      }) => unknown
    ) => selector({ user: mockStoreUser, session: mockStoreSession, setUser: mockSetUser, setSession: mockSetSession, setReady: mockSetReady }),
    {
      getState: () => ({
        user: mockStoreUser,
        session: mockStoreSession,
        setUser: mockSetUser,
        setSession: mockSetSession,
        setReady: mockSetReady,
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
    mockStoreSession = null
  })

  it('инициализирует store при пустом user в store', () => {
    render(
      <AuthProvider user={mockUser} session={mockSession}>
        <div>child</div>
      </AuthProvider>
    )

    expect(mockSetUser).toHaveBeenCalledWith(mockUser)
    expect(mockSetSession).toHaveBeenCalledWith(mockSession)
    expect(mockSetReady).toHaveBeenCalledWith(true)
  })

  it('не перезаписывает store если user с тем же id уже установлен', () => {
    mockStoreUser = { id: '42' }
    mockStoreSession = { access_token: 'tok' }

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

  it('инициализирует store в useEffect при монтировании', () => {
    // useEffect выполняется внутри act() при render() в Testing Library,
    // поэтому store заполнен сразу после render без явного waitFor
    render(
      <AuthProvider user={mockUser} session={mockSession}>
        <div>child</div>
      </AuthProvider>
    )

    expect(mockSetUser).toHaveBeenCalledWith(mockUser)
    expect(mockSetSession).toHaveBeenCalledWith(mockSession)
    expect(mockSetReady).toHaveBeenCalledWith(true)
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
