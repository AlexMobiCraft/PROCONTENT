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

const { mockPush, mockUpdatePassword } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockUpdatePassword: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/features/auth/api/auth', () => ({
  updatePassword: mockUpdatePassword,
}))

import { UpdatePasswordForm } from '@/features/auth/components/UpdatePasswordForm'

describe('UpdatePasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('рендерит форму установки пароля', () => {
    render(<UpdatePasswordForm />)
    expect(screen.getByLabelText('Новый пароль')).toBeInTheDocument()
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

  it('показывает ошибку сервера', async () => {
    mockUpdatePassword.mockResolvedValue({ error: { message: 'Server error' } })
    const user = userEvent.setup()
    render(<UpdatePasswordForm />)

    await user.type(screen.getByLabelText('Новый пароль'), 'validpassword')
    await user.click(screen.getByRole('button', { name: 'Сохранить и войти' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Не удалось обновить пароль. Попробуйте позже.')
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('редиректит на /feed при успешном обновлении пароля', async () => {
    mockUpdatePassword.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<UpdatePasswordForm />)

    await user.type(screen.getByLabelText('Новый пароль'), 'validpassword')
    await user.click(screen.getByRole('button', { name: 'Сохранить и войти' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/feed')
    })
  })
})
