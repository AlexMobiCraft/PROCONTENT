import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@base-ui/react/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode
    render?: unknown
  }) => <button {...props}>{children}</button>,
}))

const { mockPush, mockReplace, mockSignInWithPassword, mockSearchParams } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockSearchParams: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams(),
}))

vi.mock('@/features/auth/api/auth', () => ({
  signInWithPassword: mockSignInWithPassword,
}))

const mockSetUser = vi.fn()
const mockSetSession = vi.fn()

vi.mock('@/features/auth/store', () => ({
  useAuthStore: (selector: (state: { setUser: typeof mockSetUser; setSession: typeof mockSetSession }) => unknown) =>
    selector({ setUser: mockSetUser, setSession: mockSetSession }),
}))

import { AuthContainer } from '@/features/auth/components/AuthContainer'

describe('AuthContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSetUser.mockReset()
    mockSetSession.mockReset()
    mockReplace.mockReset()
    // По умолчанию нет параметров в URL
    mockSearchParams.mockReturnValue({ get: () => null })
  })

  it('рендерит заголовок и форму логина', () => {
    render(<AuthContainer />)

    expect(screen.getByText('Вход')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Пароль')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Войти' })
    ).toBeInTheDocument()
  })

  it('показывает сетевую ошибку при сбое', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: 'Network error', status: 500 },
    })
    const user = userEvent.setup()
    render(<AuthContainer />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(
        screen.getByText('Что-то пошло не так. Попробуйте ещё раз.')
      ).toBeInTheDocument()
    })
  })

  it('выполняет router.push("/feed") после успешной авторизации', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: null, user: null }, error: null })
    const user = userEvent.setup()
    render(<AuthContainer />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/feed')
    })
  })

  it('показывает inline-ошибку "Неверный email или пароль" (status 400 Invalid login credentials)', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials', status: 400 },
    })
    const user = userEvent.setup()
    render(<AuthContainer />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Пароль'), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(
        screen.getByText('Неверный email или пароль')
      ).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('обновляет Zustand store при успешном входе', async () => {
    const mockSession = { access_token: 'tok', user: { id: '42', email: 'test@example.com' } }
    mockSignInWithPassword.mockResolvedValue({ data: { session: mockSession, user: mockSession.user }, error: null })
    const user = userEvent.setup()
    render(<AuthContainer />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(mockSetUser).toHaveBeenCalledWith(mockSession.user)
      expect(mockSetSession).toHaveBeenCalledWith(mockSession)
    })
  })

  it('показывает ошибку при ?error=auth_callback_error в URL', () => {
    mockSearchParams.mockReturnValue({
      get: (key: string) => (key === 'error' ? 'auth_callback_error' : null),
    })
    render(<AuthContainer />)

    expect(
      screen.getByText('Ссылка недействительна. Запросите новую или войдите по паролю.')
    ).toBeInTheDocument()
  })

  it('не показывает ошибку Magic Link при отсутствии параметра error', () => {
    render(<AuthContainer />)

    expect(
      screen.queryByText('Ссылка недействительна. Запросите новую или войдите по паролю.')
    ).not.toBeInTheDocument()
  })

  it('кнопка "Войти" остаётся задизейблена после успешного входа (isLoading=true до навигации)', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: null, user: null }, error: null })
    const user = userEvent.setup()
    render(<AuthContainer />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Пароль'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/feed')
    })

    expect(screen.getByRole('button', { name: 'Секунду...' })).toBeDisabled()
  })
})
