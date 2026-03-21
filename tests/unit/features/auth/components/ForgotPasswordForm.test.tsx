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
    expect(screen.getByRole('button', { name: 'Pošlji povezavo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nazaj na prijavo' })).toBeInTheDocument()
  })

  it('показывает ошибку при пустом email', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.click(screen.getByRole('button', { name: 'Pošlji povezavo' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Vnesite e-pošto')
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('показывает ошибку при некорректном email', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText('Email'), 'notanemail')
    await user.click(screen.getByRole('button', { name: 'Pošlji povezavo' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Vnesite veljavno e-pošto')
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('показывает сетевую ошибку при сбое API', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'Network error' } })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Pošlji povezavo' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Pošiljanje ni uspelo. Poskusite pozneje.'
      )
    })
    expect(screen.queryByText('Sporočilo poslano')).not.toBeInTheDocument()
  })

  it('всегда показывает успешное сообщение при валидном email (anti-enumeration)', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Pošlji povezavo' }))

    await waitFor(() => {
      expect(
        screen.getByText('Če je e-pošta registrirana, boste prejeli sporočilo s povezavo za ponastavitev gesla.')
      ).toBeInTheDocument()
    })
    expect(screen.getByText('Sporočilo poslano')).toBeInTheDocument()
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com')
  })

  it('показывает ссылку возврата на login после отправки', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Pošlji povezavo' }))

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Nazaj na prijavo' })).toBeInTheDocument()
    })
  })

  it('очищает ошибку валидации при любом вводе', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.click(screen.getByRole('button', { name: 'Pošlji povezavo' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'n')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('использует компонент Link для навигации (не нативный <a>)', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    // В форм-стане: ссылка "Nazaj na prijavo" должна быть Link
    const formLink = screen.getByRole('link', { name: 'Nazaj na prijavo' })
    expect(formLink).toHaveAttribute('data-component', 'Link')

    // Переход в success-стан
    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Pošlji povezavo' }))

    await waitFor(() => {
      const successLink = screen.getByRole('link', { name: 'Nazaj na prijavo' })
      expect(successLink).toHaveAttribute('data-component', 'Link')
    })
  })

  it('показывает кнопку "Vnesi drugo e-pošto" после успешной отправки', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Pošlji povezavo' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Vnesi drugo e-pošto' })).toBeInTheDocument()
    })
  })

  it('возвращает форму при нажатии "Vnesi drugo e-pošto"', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Pošlji povezavo' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Vnesi drugo e-pošto' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Vnesi drugo e-pošto' }))

    expect(screen.getByRole('button', { name: 'Pošlji povezavo' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('сбрасывает сетевую ошибку при вводе в поле email (onChange)', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'Network error' } })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    // Первый submit — получаем сетевую ошибку
    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Pošlji povezavo' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Pošiljanje ni uspelo. Poskusite pozneje.'
      )
    })

    // Вводим символ — сетевая ошибка исчезает
    await user.type(screen.getByLabelText('Email'), 'x')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('сбрасывает сетевую ошибку при повторной отправке с невалидным email', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'Network error' } })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    // Первый submit — получаем сетевую ошибку
    await user.type(screen.getByLabelText('Email'), 'user@example.com')
    await user.click(screen.getByRole('button', { name: 'Pošlji povezavo' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Pošiljanje ni uspelo. Poskusite pozneje.'
      )
    })

    // Очищаем поле и вводим невалидный email
    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), 'notanemail')
    await user.click(screen.getByRole('button', { name: 'Pošlji povezavo' }))

    // Сетевая ошибка должна исчезнуть, видна только ошибка валидации
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Vnesite veljavno e-pošto')
    })
    expect(screen.queryByText('Pošiljanje ni uspelo. Poskusite pozneje.')).not.toBeInTheDocument()
  })
})
