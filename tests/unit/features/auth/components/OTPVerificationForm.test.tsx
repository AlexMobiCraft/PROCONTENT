import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@base-ui/react/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode
    render?: unknown
  }) => <button {...props}>{children}</button>,
}))

import { OTPVerificationForm } from '@/features/auth/components/OTPVerificationForm'

const defaultProps = {
  email: 'test@example.com',
  onSubmit: vi.fn(),
  onResend: vi.fn(),
  isLoading: false,
  error: null,
}

describe('OTPVerificationForm', () => {
  it('рендерит поле OTP, кнопку входа и ссылку повторной отправки', () => {
    render(<OTPVerificationForm {...defaultProps} />)

    expect(screen.getByLabelText('Код из письма')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Отправить повторно' })
    ).toBeInTheDocument()
  })

  it('отображает email в тексте подсказки', () => {
    render(<OTPVerificationForm {...defaultProps} />)

    expect(screen.getByText(/test@example\.com/)).toBeInTheDocument()
  })

  it('вызывает onSubmit с введённым кодом', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<OTPVerificationForm {...defaultProps} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Код из письма'), '123456')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(onSubmit).toHaveBeenCalledWith('123456')
  })

  it('вызывает onResend при клике на "Отправить повторно"', async () => {
    const user = userEvent.setup()
    const onResend = vi.fn()
    render(<OTPVerificationForm {...defaultProps} onResend={onResend} />)

    await user.click(screen.getByRole('button', { name: 'Отправить повторно' }))

    expect(onResend).toHaveBeenCalledOnce()
  })

  it('показывает состояние загрузки: кнопка задизейблена и текст изменён', () => {
    render(<OTPVerificationForm {...defaultProps} isLoading={true} />)

    expect(screen.getByRole('button', { name: 'Проверяем...' })).toBeDisabled()
  })

  it('кнопка "Отправить повторно" задизейблена при isLoading=true', () => {
    render(<OTPVerificationForm {...defaultProps} isLoading={true} />)

    expect(
      screen.getByRole('button', { name: 'Отправить повторно' })
    ).toBeDisabled()
  })

  it('отображает inline-ошибку при наличии error prop', () => {
    render(
      <OTPVerificationForm
        {...defaultProps}
        error="Код неверный или просрочен"
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Код неверный или просрочен'
    )
  })

  it('поле OTP имеет aria-invalid=true при наличии ошибки', () => {
    render(
      <OTPVerificationForm {...defaultProps} error="Ошибка" />
    )

    expect(screen.getByLabelText('Код из письма')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
  })

  it('не отображает блок ошибки когда error=null', () => {
    render(<OTPVerificationForm {...defaultProps} error={null} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('поле принимает только цифры (inputMode numeric)', () => {
    render(<OTPVerificationForm {...defaultProps} />)

    const input = screen.getByLabelText('Код из письма')
    expect(input).toHaveAttribute('inputMode', 'numeric')
    expect(input).toHaveAttribute('maxLength', '6')
  })

  it('поле OTP имеет autoComplete="one-time-code" для мобильного UX', () => {
    render(<OTPVerificationForm {...defaultProps} />)

    expect(screen.getByLabelText('Код из письма')).toHaveAttribute(
      'autoComplete',
      'one-time-code'
    )
  })

  it('не вызывает onSubmit при пустом OTP', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<OTPVerificationForm {...defaultProps} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('не вызывает onSubmit при OTP меньше 6 цифр', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<OTPVerificationForm {...defaultProps} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Код из письма'), '123')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('вызывает onSubmit при ровно 6 цифрах', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<OTPVerificationForm {...defaultProps} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Код из письма'), '654321')
    await user.click(screen.getByRole('button', { name: 'Войти' }))

    expect(onSubmit).toHaveBeenCalledWith('654321')
  })
})
