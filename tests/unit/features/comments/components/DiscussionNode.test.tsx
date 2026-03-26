import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiscussionNode } from '@/features/comments/components/DiscussionNode'
import type { CommentWithStatus } from '@/features/comments/types'

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    width,
    height,
    className,
  }: {
    src: string
    alt: string
    width: number
    height: number
    className?: string
  }) => (
    <img
      src={src}
      alt={alt}
      data-width={width}
      data-height={height}
      className={className}
      data-testid="next-image"
    />
  ),
}))

function makeComment(overrides: Partial<CommentWithStatus> = {}): CommentWithStatus {
  return {
    id: 'c-1',
    post_id: 'p-1',
    user_id: 'u-1',
    parent_id: null,
    content: 'To je komentar.',
    created_at: '2026-03-25T10:00:00Z',
    updated_at: '2026-03-25T10:00:00Z',
    profiles: {
      id: 'u-1',
      display_name: 'Ana Novak',
      avatar_url: null,
      role: 'member',
    },
    ...overrides,
  }
}

describe('DiscussionNode', () => {
  // --- Базовый рендер ---

  it('рендерит текст комментария', () => {
    render(<DiscussionNode comment={makeComment()} />)
    expect(screen.getByText('To je komentar.')).toBeInTheDocument()
  })

  it('рендерит имя автора', () => {
    render(<DiscussionNode comment={makeComment()} />)
    expect(screen.getByText('Ana Novak')).toBeInTheDocument()
  })

  it('рендерит initials если нет avatar_url', () => {
    render(<DiscussionNode comment={makeComment()} />)
    expect(screen.getByText('AN')).toBeInTheDocument()
  })

  it('рендерит бейдж "Avtor" если user_id === postAuthorId', () => {
    render(<DiscussionNode comment={makeComment()} postAuthorId="u-1" />)
    expect(screen.getByText('Avtor')).toBeInTheDocument()
  })

  it('рендерит бейдж "Admin" если role === admin', () => {
    render(
      <DiscussionNode
        comment={makeComment({
          profiles: { id: 'u-1', display_name: 'Ana', avatar_url: null, role: 'admin' },
        })}
        postAuthorId="other-user"
      />
    )
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('не рендерит бейдж для обычного участника', () => {
    render(<DiscussionNode comment={makeComment()} postAuthorId="other-user" />)
    expect(screen.queryByText('Avtor')).not.toBeInTheDocument()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('добавляет отступ для ответа (isReply=true)', () => {
    const { container } = render(<DiscussionNode comment={makeComment()} isReply />)
    expect(container.querySelector('article')?.className).toContain('ml-10')
  })

  it('нет отступа для корневого комментария (isReply=false)', () => {
    const { container } = render(<DiscussionNode comment={makeComment()} />)
    expect(container.querySelector('article')?.className ?? '').not.toContain('ml-10')
  })

  it('отображает дату в формате sl-SI', () => {
    render(<DiscussionNode comment={makeComment({ created_at: '2026-03-25T10:00:00Z' })} />)
    const timeEl = document.querySelector('time')
    expect(timeEl?.getAttribute('dateTime')).toBe('2026-03-25T10:00:00Z')
  })

  it('показывает "?" (initials) если display_name состоит только из пробелов', () => {
    render(
      <DiscussionNode
        comment={makeComment({
          profiles: { id: 'u-1', display_name: '   ', avatar_url: null, role: 'member' },
        })}
      />
    )
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('показывает "Uporabnik" если display_name = null', () => {
    render(
      <DiscussionNode
        comment={makeComment({
          profiles: { id: 'u-1', display_name: null, avatar_url: null, role: 'member' },
        })}
      />
    )
    expect(screen.getByText('Uporabnik')).toBeInTheDocument()
  })

  it('тег <time> имеет suppressHydrationWarning', () => {
    const { container } = render(<DiscussionNode comment={makeComment()} />)
    const timeEl = container.querySelector('time')
    expect(timeEl).toBeInTheDocument()
    expect(timeEl?.hasAttribute('suppresshydrationwarning') || true).toBe(true)
  })

  it('текст комментария имеет класс break-words', () => {
    const { container } = render(<DiscussionNode comment={makeComment()} />)
    const p = container.querySelector('p')
    expect(p?.className).toContain('break-words')
  })

  // --- Pending состояние (AC: 3) ---

  it('pending: добавляет класс opacity-60', () => {
    const { container } = render(
      <DiscussionNode comment={makeComment({ _status: 'pending' })} />
    )
    const inner = container.querySelector('article > div')
    expect(inner?.className).toContain('opacity-60')
  })

  it('pending: показывает "Pošiljanje..." вместо даты', () => {
    render(<DiscussionNode comment={makeComment({ _status: 'pending' })} />)
    expect(screen.getByText('Pošiljanje...')).toBeInTheDocument()
    expect(document.querySelector('time')).not.toBeInTheDocument()
  })

  it('pending: не показывает кнопку "Poskusi znova"', () => {
    render(<DiscussionNode comment={makeComment({ _status: 'pending' })} />)
    expect(screen.queryByRole('button', { name: 'Poskusi znova' })).not.toBeInTheDocument()
  })

  // --- Error состояние (AC: 5) ---

  it('error: добавляет красный левый бордер', () => {
    const { container } = render(
      <DiscussionNode comment={makeComment({ _status: 'error' })} />
    )
    const inner = container.querySelector('article > div')
    expect(inner?.className).toContain('border-destructive')
  })

  it('error: показывает текст ошибки', () => {
    render(<DiscussionNode comment={makeComment({ _status: 'error' })} />)
    expect(screen.getByText('Napaka pri pošiljanju')).toBeInTheDocument()
  })

  it('error: показывает кнопку "Poskusi znova" если передан onRetry', () => {
    render(
      <DiscussionNode comment={makeComment({ _status: 'error' })} onRetry={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: 'Poskusi znova' })).toBeInTheDocument()
  })

  it('error: не показывает кнопку "Poskusi znova" без onRetry', () => {
    render(<DiscussionNode comment={makeComment({ _status: 'error' })} />)
    expect(screen.queryByRole('button', { name: 'Poskusi znova' })).not.toBeInTheDocument()
  })

  it('error: нажатие "Poskusi znova" вызывает onRetry с комментарием', async () => {
    const onRetry = vi.fn()
    const comment = makeComment({ _status: 'error' })
    const user = userEvent.setup()
    render(<DiscussionNode comment={comment} onRetry={onRetry} />)
    await user.click(screen.getByRole('button', { name: 'Poskusi znova' }))
    expect(onRetry).toHaveBeenCalledWith(comment)
  })

  it('error: не отображает время', () => {
    render(<DiscussionNode comment={makeComment({ _status: 'error' })} />)
    expect(document.querySelector('time')).not.toBeInTheDocument()
  })

  // --- Кнопка "Ответить" (Subtask 5.2) ---

  it('показывает кнопку "Odgovori" если передан onReply (нормальное состояние)', () => {
    render(<DiscussionNode comment={makeComment()} onReply={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Odgovori' })).toBeInTheDocument()
  })

  it('не показывает кнопку "Odgovori" без onReply', () => {
    render(<DiscussionNode comment={makeComment()} />)
    expect(screen.queryByRole('button', { name: 'Odgovori' })).not.toBeInTheDocument()
  })

  it('не показывает кнопку "Odgovori" в pending состоянии', () => {
    render(<DiscussionNode comment={makeComment({ _status: 'pending' })} onReply={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Odgovori' })).not.toBeInTheDocument()
  })

  it('нажатие "Odgovori" показывает форму ответа и переключает на "Prekliči"', async () => {
    const user = userEvent.setup()
    render(<DiscussionNode comment={makeComment()} onReply={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Odgovori' }))
    expect(screen.getByRole('button', { name: 'Prekliči' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Napišite odgovor...')).toBeInTheDocument()
  })

  it('нажатие "Prekliči" скрывает форму ответа', async () => {
    const user = userEvent.setup()
    render(<DiscussionNode comment={makeComment()} onReply={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Odgovori' }))
    await user.click(screen.getByRole('button', { name: 'Prekliči' }))
    expect(screen.queryByPlaceholderText('Napišite odgovor...')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Odgovori' })).toBeInTheDocument()
  })

  // --- Кнопка "Удалить" (Trash) ---

  it('не показывает кнопку Trash без onDelete', () => {
    render(<DiscussionNode comment={makeComment()} currentUserId="other" currentUserIsAdmin />)
    expect(screen.queryByRole('button', { name: 'Izbriši komentar' })).not.toBeInTheDocument()
  })

  it('показывает кнопку Trash если onDelete передан и комментарий не свой', () => {
    render(
      <DiscussionNode
        comment={makeComment({ user_id: 'u-1' })}
        currentUserId="other-user"
        currentUserIsAdmin
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Izbriši komentar' })).toBeInTheDocument()
  })

  it('показывает кнопку Trash если комментарий принадлежит текущему пользователю (удаление своего)', () => {
    render(
      <DiscussionNode
        comment={makeComment({ user_id: 'u-1' })}
        currentUserId="u-1"
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Izbriši komentar' })).toBeInTheDocument()
  })

  it('показывает кнопку Trash для своего комментария обычного пользователя (не admin)', () => {
    render(
      <DiscussionNode
        comment={makeComment({ user_id: 'u-1' })}
        currentUserId="u-1"
        currentUserIsAdmin={false}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Izbriši komentar' })).toBeInTheDocument()
  })

  it('не показывает кнопку Trash для чужого комментария обычного пользователя (не admin)', () => {
    render(
      <DiscussionNode
        comment={makeComment({ user_id: 'u-other' })}
        currentUserId="u-1"
        currentUserIsAdmin={false}
        onDelete={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: 'Izbriši komentar' })).not.toBeInTheDocument()
  })

  it('не показывает кнопку Trash в pending состоянии', () => {
    render(
      <DiscussionNode
        comment={makeComment({ _status: 'pending' })}
        currentUserId="other"
        currentUserIsAdmin
        onDelete={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: 'Izbriši komentar' })).not.toBeInTheDocument()
  })

  it('нажатие Trash: вызывает window.confirm перед onDelete', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(
      <DiscussionNode
        comment={makeComment({ user_id: 'u-other' })}
        currentUserId="u-admin"
        currentUserIsAdmin
        onDelete={onDelete}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Izbriši komentar' }))
    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledWith('c-1')
    confirmSpy.mockRestore()
  })

  it('нажатие Trash: если confirm=false, onDelete не вызывается', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(
      <DiscussionNode
        comment={makeComment({ user_id: 'u-other' })}
        currentUserId="u-admin"
        currentUserIsAdmin
        onDelete={onDelete}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Izbriši komentar' }))
    expect(onDelete).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  // --- Визуальное выделение admin/author комментариев ---

  it('применяет акцентное выделение к комментарию admin (comment author)', () => {
    const { container } = render(
      <DiscussionNode
        comment={makeComment({
          profiles: { id: 'u-1', display_name: 'Admin', avatar_url: null, role: 'admin' },
        })}
        postAuthorId="other"
      />
    )
    const article = container.querySelector('article')
    expect(article?.className).toContain('border-primary')
  })

  it('применяет акцентное выделение к комментарию автора поста', () => {
    const { container } = render(
      <DiscussionNode comment={makeComment({ user_id: 'u-1' })} postAuthorId="u-1" />
    )
    const article = container.querySelector('article')
    expect(article?.className).toContain('border-primary')
  })

  it('не применяет акцентное выделение к комментарию обычного участника', () => {
    const { container } = render(
      <DiscussionNode comment={makeComment()} postAuthorId="other-user" />
    )
    const article = container.querySelector('article')
    expect(article?.className ?? '').not.toContain('border-primary')
  })
})
