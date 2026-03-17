import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@base-ui/react/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode
    render?: unknown
  }) => <button {...props}>{children}</button>,
}))

const { mockPush, mockRefresh, mockUpdatePassword, mockSetUser, mockSetSession, mockGetSession } =
  vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockRefresh: vi.fn(),
    mockUpdatePassword: vi.fn(),
    mockSetUser: vi.fn(),
    mockSetSession: vi.fn(),
    mockGetSession: vi.fn(),
  }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

vi.mock('@/features/auth/api/auth', () => ({
  updatePassword: mockUpdatePassword,
  getSession: mockGetSession,
}))

vi.mock('@/features/auth/store', () => ({
  useAuthStore: () => ({ setUser: mockSetUser, setSession: mockSetSession }),
}))

import { UpdatePasswordForm } from '@/features/auth/components/UpdatePasswordForm'

const mockSession = { access_token: 'token', user: { id: 'user-123', email: 'user@example.com' } }

describe('UpdatePasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('рендерит форму установки пароля с двумя полями', () => {
    render(<UpdatePasswordForm />)
    expect(screen.getByLabelText('Новый пароль')).toBeInTheDocument()
    expect(screen.getByLabelText('Подтвердите пароль')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сохранить и войти' })).toBeInTheDocument()
  })

  it('показывает ошибку при пустом пароле', async () => {
    const user = userEvent.setup()
    render(<UpdatePasswordForm />)

    await user.click(screen.getByRole('button', { name: 'Сохранить и войти' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Введите новый пароль')
    expect(mockUpdatePassword).not.toHaveBeenCalled()
  })

  it('показывает ошибку если пароль короче 6 символов', async () => {
    const user = userEvent.setup()
    render(<UpdatePasswordForm />)

    await user.type(screen.getByLabelText('Новый пароль'), '12345')
    await user.click(screen.getByRole('button', { name: 'Сохранить и войти' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Пароль должен быть не короче 6 символов')
    expect(mockUpdatePassword).not.toHaveBeenCalled()
  })

  it('показывает ошибку если пароли не совпадают', async () => {
    const user = userEvent.setup()
    render(<UpdatePasswordForm />)

    await user.type(screen.getByLabelText('Новый пароль'), 'validpassword')
    await user.type(screen.getByLabelText('Подтвердите пароль'), 'differentpassword')
    await user.click(screen.getByRole('button', { name: 'Сохранить и войти' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Пароли не совпадают')
    expect(mockUpdatePassword).not.toHaveBeenCalled()
  })

  it('показывает ошибку сервера (детальное сообщение из API)', async () => {
    mockUpdatePassword.mockResolvedValue({ error: { message: 'Server error' } })
    const user = userEvent.setup()
    render(<UpdatePasswordForm />)

    await user.type(screen.getByLabelText('Новый пароль'), 'validpassword')
    await user.type(screen.getByLabelText('Подтвердите пароль'), 'validpassword')
    await user.click(screen.getByRole('button', { name: 'Сохранить и войти' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error')
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('показывает уведомление "Пароль обновлён" при успешном обновлении', async () => {
    mockUpdatePassword.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<UpdatePasswordForm />)

    await user.type(screen.getByLabelText('Новый пароль'), 'validpassword')
    await user.type(screen.getByLabelText('Подтвердите пароль'), 'validpassword')
    await user.click(screen.getByRole('button', { name: 'Сохранить и войти' }))

    await waitFor(() => {
      expect(screen.getByText('Пароль обновлён')).toBeInTheDocument()
    })
    expect(screen.getByText(/успешно изменён/)).toBeInTheDocument()
  })

  it('редиректит на /feed после задержки и вызывает router.refresh() внутри таймера', async () => {
    mockUpdatePassword.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<UpdatePasswordForm />)

    await user.type(screen.getByLabelText('Новый пароль'), 'validpassword')
    await user.type(screen.getByLabelText('Подтвердите пароль'), 'validpassword')
    await user.click(screen.getByRole('button', { name: 'Сохранить и войти' }))

    // Сначала появляется сообщение об успехе — redirect и refresh ещё не вызваны
    await waitFor(() => expect(screen.getByText('Пароль обновлён')).toBeInTheDocument())
    expect(mockPush).not.toHaveBeenCalledWith('/feed')
    expect(mockRefresh).not.toHaveBeenCalled()

    // Через 2 секунды router.push и router.refresh срабатывают вместе (внутри setTimeout)
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/feed'), { timeout: 3000 })
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('устанавливает session в null если getSession вернул ошибку', async () => {
    mockUpdatePassword.mockResolvedValue({ error: null, data: { user: mockSession.user } })
    mockGetSession.mockResolvedValue({ data: null, error: { message: 'Session error' } })
    const user = userEvent.setup()
    render(<UpdatePasswordForm />)

    await user.type(screen.getByLabelText('Новый пароль'), 'validpassword')
    await user.type(screen.getByLabelText('Подтвердите пароль'), 'validpassword')
    await user.click(screen.getByRole('button', { name: 'Сохранить и войти' }))

    await waitFor(() => {
      expect(mockSetSession).toHaveBeenCalledWith(null)
    })
    expect(mockSetUser).toHaveBeenCalledWith(mockSession.user)
  })

  it('синхронизирует session в useAuthStore после успешного обновления пароля', async () => {
    const mockSessionObj = { access_token: 'tok', user: { id: 'user-123' } }
    mockUpdatePassword.mockResolvedValue({ error: null, data: { user: mockSession.user } })
    mockGetSession.mockResolvedValue({ data: { session: mockSessionObj }, error: null })
    const user = userEvent.setup()
    render(<UpdatePasswordForm />)

    await user.type(screen.getByLabelText('Новый пароль'), 'validpassword')
    await user.type(screen.getByLabelText('Подтвердите пароль'), 'validpassword')
    await user.click(screen.getByRole('button', { name: 'Сохранить и войти' }))

    await waitFor(() => {
      expect(mockSetSession).toHaveBeenCalledWith(mockSessionObj)
    })
  })

  it('обновляет useAuthStore после успешного обновления пароля', async () => {
    mockUpdatePassword.mockResolvedValue({ error: null, data: { user: mockSession.user } })
    const user = userEvent.setup()
    render(<UpdatePasswordForm />)

    await user.type(screen.getByLabelText('Новый пароль'), 'validpassword')
    await user.type(screen.getByLabelText('Подтвердите пароль'), 'validpassword')
    await user.click(screen.getByRole('button', { name: 'Сохранить и войти' }))

    await waitFor(() => {
      expect(mockSetUser).toHaveBeenCalledWith(mockSession.user)
    })
  })

  it('редиректит на /login?error=link-expired при истёкшем токене', async () => {
    mockUpdatePassword.mockResolvedValue({ error: { message: 'Invalid token' } })
    const user = userEvent.setup()
    render(<UpdatePasswordForm />)

    await user.type(screen.getByLabelText('Новый пароль'), 'validpassword')
    await user.type(screen.getByLabelText('Подтвердите пароль'), 'validpassword')
    await user.click(screen.getByRole('button', { name: 'Сохранить и войти' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login?error=link-expired')
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('редиректит на /login?error=link-expired при истёкшей сессии', async () => {
    mockUpdatePassword.mockResolvedValue({ error: { message: 'Auth session missing' } })
    const user = userEvent.setup()
    render(<UpdatePasswordForm />)

    await user.type(screen.getByLabelText('Новый пароль'), 'validpassword')
    await user.type(screen.getByLabelText('Подтвердите пароль'), 'validpassword')
    await user.click(screen.getByRole('button', { name: 'Сохранить и войти' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login?error=link-expired')
    })
  })

  it('показывает inline ошибку при обычной серверной ошибке (не expired) — выводит apiError.message', async () => {
    mockUpdatePassword.mockResolvedValue({ error: { message: 'Database error' } })
    const user = userEvent.setup()
    render(<UpdatePasswordForm />)

    await user.type(screen.getByLabelText('Новый пароль'), 'validpassword')
    await user.type(screen.getByLabelText('Подтвердите пароль'), 'validpassword')
    await user.click(screen.getByRole('button', { name: 'Сохранить и войти' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Database error')
    })
    expect(mockPush).not.toHaveBeenCalled()
  })
})
