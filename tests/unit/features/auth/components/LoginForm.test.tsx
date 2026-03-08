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
  it('рендерит поле email и кнопку отправки', () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={false} error={null} />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Получить код' })
    ).toBeInTheDocument()
  })

  it('рендерит подпись под формой', () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={false} error={null} />)

    expect(
      screen.getByText('Мы отправим ссылку на ваш email')
    ).toBeInTheDocument()
  })

  it('вызывает onSubmit с введённым email при отправке формы', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} isLoading={false} error={null} />)

    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Получить код' }))

    expect(onSubmit).toHaveBeenCalledWith('test@example.com')
  })

  it('показывает состояние загрузки: кнопка задизейблена и текст изменён', () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={true} error={null} />)

    const button = screen.getByRole('button', { name: 'Отправляем...' })
    expect(button).toBeDisabled()
  })

  it('поле email задизейблено при isLoading=true', () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={true} error={null} />)

    expect(screen.getByLabelText('Email')).toBeDisabled()
  })

  it('отображает inline-ошибку при наличии error prop', () => {
    render(
      <LoginForm
        onSubmit={vi.fn()}
        isLoading={false}
        error="Введите корректный email"
      />
    )

    const errorEl = screen.getByRole('alert')
    expect(errorEl).toHaveTextContent('Введите корректный email')
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
})
