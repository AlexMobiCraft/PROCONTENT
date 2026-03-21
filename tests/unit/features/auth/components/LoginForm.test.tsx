import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// Мок @base-ui/react/button — рендерим нативную кнопку
vi.mock('@base-ui/react/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode
    render?: unknown
  }) => <button {...props}>{children}</button>,
}))

import { LoginForm } from '@/features/auth/components/LoginForm'

describe('LoginForm', () => {
  it('рендерит поле email, пароля и кнопку отправки', () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={false} error={null} />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Geslo')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Prijava' })
    ).toBeInTheDocument()
  })

  it('вызывает onSubmit с введённым email и паролем при отправке формы', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} isLoading={false} error={null} />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Geslo'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Prijava' }))

    expect(onSubmit).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password123' })
  })

  it('показывает состояние загрузки: кнопка задизейблена и текст изменён', () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={true} error={null} />)

    const button = screen.getByRole('button', { name: 'Trenutek...' })
    expect(button).toBeDisabled()
  })

  it('поля задизейблены при isLoading=true', () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={true} error={null} />)

    expect(screen.getByLabelText('Email')).toBeDisabled()
    expect(screen.getByLabelText('Geslo')).toBeDisabled()
  })

  it('отображает inline-ошибку при наличии error prop', () => {
    render(
      <LoginForm
        onSubmit={vi.fn()}
        isLoading={false}
        error="Сетевая ошибка"
      />
    )

    const errorEl = screen.getByRole('alert')
    expect(errorEl).toHaveTextContent('Сетевая ошибка')
  })

  it('поле email имеет aria-invalid=true при наличии ошибки', () => {
    render(
      <LoginForm onSubmit={vi.fn()} isLoading={false} error="Ошибка" />
    )

    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('не отображает блок ошибки когда error=null', () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={false} error={null} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('не вызывает onSubmit при пустом email', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} isLoading={false} error={null} />)

    await user.type(screen.getByLabelText('Geslo'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Prijava' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Vnesite e-pošto')
  })

  it('не вызывает onSubmit при пустом пароле', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} isLoading={false} error={null} />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Prijava' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Vnesite geslo')
  })

  it('не вызывает onSubmit при невалидном email', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} isLoading={false} error={null} />)

    await user.type(screen.getByLabelText('Email'), 'не-email')
    await user.type(screen.getByLabelText('Geslo'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Prijava' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Vnesite veljavno e-pošto')
  })

  it('вызывает onSubmit при валидном email и пароле', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} isLoading={false} error={null} />)

    await user.type(screen.getByLabelText('Email'), 'valid@example.com')
    await user.type(screen.getByLabelText('Geslo'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Prijava' }))

    expect(onSubmit).toHaveBeenCalledWith({ email: 'valid@example.com', password: 'password123' })
  })

  it('очищает ошибку валидации при вводе в поле email', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} isLoading={false} error={null} />)

    // Вызываем ошибку валидации (пустая отправка)
    await user.click(screen.getByRole('button', { name: 'Prijava' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Начинаем вводить — ошибка должна исчезнуть
    await user.type(screen.getByLabelText('Email'), 'a')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('очищает ошибку валидации при вводе в поле пароля', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} isLoading={false} error={null} />)

    // Вызываем пустую отправку чтобы появилась ошибка
    await user.click(screen.getByRole('button', { name: 'Prijava' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Вводим что-то в пароль
    await user.type(screen.getByLabelText('Geslo'), '1')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
