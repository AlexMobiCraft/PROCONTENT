import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommentForm } from '@/features/comments/components/CommentForm'

describe('CommentForm', () => {
  it('рендерит textarea и кнопку отправки', () => {
    render(<CommentForm onSubmit={vi.fn()} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pošlji' })).toBeInTheDocument()
  })

  it('textarea имеет дефолтный placeholder', () => {
    render(<CommentForm onSubmit={vi.fn()} />)
    expect(screen.getByPlaceholderText('Napišite komentar...')).toBeInTheDocument()
  })

  it('кнопка disabled при пустом textarea', () => {
    render(<CommentForm onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Pošlji' })).toBeDisabled()
  })

  it('кнопка disabled если textarea содержит только пробелы', async () => {
    const user = userEvent.setup()
    render(<CommentForm onSubmit={vi.fn()} />)
    await user.type(screen.getByRole('textbox'), '   ')
    expect(screen.getByRole('button', { name: 'Pošlji' })).toBeDisabled()
  })

  it('кнопка enabled при непустом тексте', async () => {
    const user = userEvent.setup()
    render(<CommentForm onSubmit={vi.fn()} />)
    await user.type(screen.getByRole('textbox'), 'Hello')
    expect(screen.getByRole('button', { name: 'Pošlji' })).toBeEnabled()
  })

  it('вызывает onSubmit с обрезанным текстом', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<CommentForm onSubmit={onSubmit} />)
    await user.type(screen.getByRole('textbox'), '  Komentar  ')
    await user.click(screen.getByRole('button', { name: 'Pošlji' }))
    expect(onSubmit).toHaveBeenCalledWith('Komentar')
  })

  it('очищает textarea после успешной отправки', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<CommentForm onSubmit={onSubmit} />)
    await user.type(screen.getByRole('textbox'), 'Komentar')
    await user.click(screen.getByRole('button', { name: 'Pošlji' }))
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''))
  })

  it('кнопка disabled во время отправки (isSubmitting)', async () => {
    let resolveSubmit!: () => void
    const onSubmit = vi.fn().mockImplementation(
      () => new Promise<void>((res) => { resolveSubmit = res })
    )
    const user = userEvent.setup()
    render(<CommentForm onSubmit={onSubmit} />)
    await user.type(screen.getByRole('textbox'), 'Komentar')
    await user.click(screen.getByRole('button', { name: 'Pošlji' }))

    expect(screen.getByRole('button', { name: 'Pošiljanje...' })).toBeDisabled()

    resolveSubmit()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pošlji' })).toBeInTheDocument())
  })

  it('не вызывает onSubmit при нажатии на disabled кнопку', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<CommentForm onSubmit={onSubmit} />)
    // Кнопка disabled — textarea пустой
    await user.click(screen.getByRole('button', { name: 'Pošlji' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('поддерживает кастомный placeholder', () => {
    render(<CommentForm onSubmit={vi.fn()} placeholder="Napišite odgovor..." />)
    expect(screen.getByPlaceholderText('Napišite odgovor...')).toBeInTheDocument()
  })

  it('submit по Enter не сработает (form submit через button)', async () => {
    // textarea не сабмитит форму по Enter (многострочное поле)
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<CommentForm onSubmit={onSubmit} />)
    await user.type(screen.getByRole('textbox'), 'Komentar')
    await user.keyboard('{Enter}')
    // Enter в textarea добавляет перевод строки, не сабмитит
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
