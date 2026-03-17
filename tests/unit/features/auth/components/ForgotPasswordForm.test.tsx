import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockResetPasswordForEmail } = vi.hoisted(() => ({
  mockResetPasswordForEmail: vi.fn(),
}))

vi.mock('@/features/auth/api/auth', () => ({
  resetPasswordForEmail: mockResetPasswordForEmail,
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className} data-component="Link">
      {children}
    </a>
  ),
}))

import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm'

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('рендерит форму со стандартными элементами', () => {
    render(<ForgotPasswordForm />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Отправить ссылку' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Вернуться ко входу' })).toBeInTheDocument()
  })

  it('показывает ошибку при пустом email', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Введите email')
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('показывает ошибку при некорректном email', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText('Email'), 'notanemail')
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Введите корректный email')
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('показывает сетевую ошибку при сбое API', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'Network error' } })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Не удалось отправить письмо. Попробуйте позже.'
      )
    })
    expect(screen.queryByText('Письмо отправлено')).not.toBeInTheDocument()
  })

  it('всегда показывает успешное сообщение при валидном email (anti-enumeration)', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }))

    await waitFor(() => {
      expect(
        screen.getByText('Если email зарегистрирован, вы получите письмо со ссылкой для сброса пароля.')
      ).toBeInTheDocument()
    })
    expect(screen.getByText('Письмо отправлено')).toBeInTheDocument()
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com')
  })

  it('показывает ссылку возврата на login после отправки', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }))

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Вернуться ко входу' })).toBeInTheDocument()
    })
  })

  it('очищает ошибку валидации при вводе корректного email', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'valid@example.com')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('очищает ошибку валидации при любом вводе (включая некорректный email)', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'n')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('использует компонент Link для навигации (не нативный <a>)', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    // В форм-стане: ссылка "Вернуться ко входу" должна быть Link
    const formLink = screen.getByRole('link', { name: 'Вернуться ко входу' })
    expect(formLink).toHaveAttribute('data-component', 'Link')

    // Переход в success-стан
    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }))

    await waitFor(() => {
      const successLink = screen.getByRole('link', { name: 'Вернуться ко входу' })
      expect(successLink).toHaveAttribute('data-component', 'Link')
    })
  })

  it('показывает кнопку "Ввести другой email" после успешной отправки', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ввести другой email' })).toBeInTheDocument()
    })
  })

  it('возвращает форму при нажатии "Ввести другой email"', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ввести другой email' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Ввести другой email' }))

    expect(screen.getByRole('button', { name: 'Отправить ссылку' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('сбрасывает сетевую ошибку при повторной отправке с невалидным email', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'Network error' } })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    // Первый submit — получаем сетевую ошибку
    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Не удалось отправить письмо. Попробуйте позже.'
      )
    })

    // Очищаем поле и вводим невалидный email
    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), 'notanemail')
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }))

    // Сетевая ошибка должна исчезнуть, видна только ошибка валидации
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Введите корректный email')
    })
    expect(screen.queryByText('Не удалось отправить письмо. Попробуйте позже.')).not.toBeInTheDocument()
  })

})
