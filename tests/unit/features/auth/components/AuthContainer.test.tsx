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

const { mockPush, mockReplace, mockSignInWithOtp, mockVerifyOtp, mockSearchParams } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockSignInWithOtp: vi.fn(),
  mockVerifyOtp: vi.fn(),
  mockSearchParams: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams(),
}))

vi.mock('@/features/auth/api/auth', () => ({
  signInWithOtp: mockSignInWithOtp,
  verifyOtp: mockVerifyOtp,
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

  it('рендерит заголовок и форму email на начальном шаге', () => {
    render(<AuthContainer />)

    expect(screen.getByText('Войти в клуб')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Получить код' })
    ).toBeInTheDocument()
  })

  it('переходит к шагу OTP после успешной отправки email', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<AuthContainer />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Получить код' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Код из письма')).toBeInTheDocument()
    })
    expect(mockSignInWithOtp).toHaveBeenCalledWith('test@example.com')
  })

  it('отображает введённый email на шаге OTP', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<AuthContainer />)

    await user.type(screen.getByLabelText('Email'), 'user@test.com')
    await user.click(screen.getByRole('button', { name: 'Получить код' }))

    await waitFor(() => {
      expect(screen.getByText(/user@test\.com/)).toBeInTheDocument()
    })
  })

  it('показывает сетевую ошибку при сбое signInWithOtp', async () => {
    mockSignInWithOtp.mockResolvedValue({
      error: { message: 'Network error', status: 500 },
    })
    const user = userEvent.setup()
    render(<AuthContainer />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Получить код' }))

    await waitFor(() => {
      expect(
        screen.getByText('Не удалось отправить письмо. Попробуйте ещё раз.')
      ).toBeInTheDocument()
    })
    // Остаёмся на шаге email
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('выполняет router.push("/feed") после успешной верификации OTP', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null })
    mockVerifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: null })
    const user = userEvent.setup()
    render(<AuthContainer />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Получить код' }))

    await waitFor(() =>
      expect(screen.getByLabelText('Код из письма')).toBeInTheDocument()
    )

    await user.type(screen.getByLabelText('Код из письма'), '123456')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/feed')
    })
  })

  it('показывает inline-ошибку при невалидном OTP (status 422)', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null })
    mockVerifyOtp.mockResolvedValue({
      error: { message: 'Token has expired or is invalid', status: 422 },
    })
    const user = userEvent.setup()
    render(<AuthContainer />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Получить код' }))

    await waitFor(() =>
      expect(screen.getByLabelText('Код из письма')).toBeInTheDocument()
    )

    await user.type(screen.getByLabelText('Код из письма'), '000000')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(
        screen.getByText(
          'Код неверный или просрочен. Проверьте письмо или запросите новый код.'
        )
      ).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('показывает сетевую ошибку при системном сбое verifyOtp', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null })
    mockVerifyOtp.mockResolvedValue({
      error: { message: 'Internal server error', status: 500 },
    })
    const user = userEvent.setup()
    render(<AuthContainer />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Получить код' }))

    await waitFor(() =>
      expect(screen.getByLabelText('Код из письма')).toBeInTheDocument()
    )

    await user.type(screen.getByLabelText('Код из письма'), '123456')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(
        screen.getByText('Что-то пошло не так. Попробуйте ещё раз.')
      ).toBeInTheDocument()
    })
  })

  it('обновляет Zustand store при успешном входе', async () => {
    const mockSession = { access_token: 'tok', user: { id: '42', email: 'test@example.com' } }
    mockSignInWithOtp.mockResolvedValue({ error: null })
    mockVerifyOtp.mockResolvedValue({ data: { session: mockSession, user: mockSession.user }, error: null })
    const user = userEvent.setup()
    render(<AuthContainer />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Получить код' }))

    await waitFor(() =>
      expect(screen.getByLabelText('Код из письма')).toBeInTheDocument()
    )

    await user.type(screen.getByLabelText('Код из письма'), '123456')
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
      screen.getByText('Ссылка недействительна. Запросите новый код.')
    ).toBeInTheDocument()
  })

  it('не показывает ошибку Magic Link при отсутствии параметра error', () => {
    render(<AuthContainer />)

    expect(
      screen.queryByText('Ссылка недействительна. Запросите новый код.')
    ).not.toBeInTheDocument()
  })

  it('кнопка "Войти" остаётся задизейблена после успешной верификации (isLoading=true до навигации)', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null })
    mockVerifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: null })
    const user = userEvent.setup()
    render(<AuthContainer />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Получить код' }))

    await waitFor(() =>
      expect(screen.getByLabelText('Код из письма')).toBeInTheDocument()
    )

    await user.type(screen.getByLabelText('Код из письма'), '123456')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/feed')
    })

    // После успешной верификации isLoading остаётся true — кнопка задизейблена
    expect(screen.getByRole('button', { name: 'Проверяем...' })).toBeDisabled()
  })

  it('очищает sticky ?error из URL при возврате на шаг email', async () => {
    mockSearchParams.mockReturnValue({
      get: (key: string) => (key === 'error' ? 'auth_callback_error' : null),
    })
    mockSignInWithOtp.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<AuthContainer />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Получить код' }))

    await waitFor(() =>
      expect(screen.getByLabelText('Код из письма')).toBeInTheDocument()
    )

    await user.click(screen.getByRole('button', { name: 'Изменить email' }))

    expect(mockReplace).toHaveBeenCalledWith('/login')
  })

  it('не вызывает router.replace при возврате без error-параметра в URL', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<AuthContainer />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Получить код' }))

    await waitFor(() =>
      expect(screen.getByLabelText('Код из письма')).toBeInTheDocument()
    )

    await user.click(screen.getByRole('button', { name: 'Изменить email' }))

    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('кнопка "Изменить email" возвращает на шаг email', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<AuthContainer />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Получить код' }))

    await waitFor(() =>
      expect(screen.getByLabelText('Код из письма')).toBeInTheDocument()
    )

    await user.click(screen.getByRole('button', { name: 'Изменить email' }))

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.queryByLabelText('Код из письма')).not.toBeInTheDocument()
  })

  it('кнопка "Отправить повторно" вызывает signInWithOtp с сохранённым email', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<AuthContainer />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Получить код' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Отправить повторно' })).toBeInTheDocument()
    )

    await user.click(screen.getByRole('button', { name: 'Отправить повторно' }))

    expect(mockSignInWithOtp).toHaveBeenCalledTimes(2)
    expect(mockSignInWithOtp).toHaveBeenLastCalledWith('test@example.com')
  })
})
