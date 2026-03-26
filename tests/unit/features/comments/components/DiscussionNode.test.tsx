import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DiscussionNode } from '@/features/comments/components/DiscussionNode'
import type { CommentWithProfile } from '@/features/comments/types'

function makeComment(overrides: Partial<CommentWithProfile> = {}): CommentWithProfile {
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
        comment={makeComment({ profiles: { id: 'u-1', display_name: 'Ana', avatar_url: null, role: 'admin' } })}
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
    expect(container.querySelector('article')?.className).toContain('pl-10')
  })

  it('нет отступа для корневого комментария (isReply=false)', () => {
    const { container } = render(<DiscussionNode comment={makeComment()} />)
    expect(container.querySelector('article')?.className ?? '').not.toContain('pl-10')
  })

  it('отображает дату в формате sl-SI', () => {
    render(<DiscussionNode comment={makeComment({ created_at: '2026-03-25T10:00:00Z' })} />)
    // sl-SI формат: "25. marca 2026" или подобное
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
        comment={makeComment({ profiles: { id: 'u-1', display_name: null, avatar_url: null, role: 'member' } })}
      />
    )
    expect(screen.getByText('Uporabnik')).toBeInTheDocument()
  })
})
