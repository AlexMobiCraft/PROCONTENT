import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CommentsList } from '@/features/comments/components/CommentsList'
import type { Comment } from '@/features/comments/types'

function makeComment(id: string, parentId: string | null = null): Comment {
  return {
    id,
    post_id: 'p-1',
    user_id: `u-${id}`,
    parent_id: parentId,
    content: `Komentar ${id}`,
    created_at: '2026-03-25T10:00:00Z',
    updated_at: '2026-03-25T10:00:00Z',
    profiles: {
      id: `u-${id}`,
      display_name: `Avtor ${id}`,
      avatar_url: null,
      role: 'member',
    },
    replies: [],
  }
}

describe('CommentsList', () => {
  it('рендерит сообщение если нет комментариев', () => {
    render(<CommentsList comments={[]} />)
    expect(screen.getByText('Še ni komentarjev. Bodite prvi!')).toBeInTheDocument()
  })

  it('рендерит корневые комментарии', () => {
    const comments = [makeComment('1'), makeComment('2')]
    render(<CommentsList comments={comments} />)
    expect(screen.getByText('Komentar 1')).toBeInTheDocument()
    expect(screen.getByText('Komentar 2')).toBeInTheDocument()
  })

  it('рендерит ответы под родительским комментарием', () => {
    const parent = makeComment('1')
    const reply = { ...makeComment('r1', '1'), content: 'Odgovor 1' }
    parent.replies = [reply]
    render(<CommentsList comments={[parent]} />)
    expect(screen.getByText('Komentar 1')).toBeInTheDocument()
    expect(screen.getByText('Odgovor 1')).toBeInTheDocument()
  })

  it('ответ рендерится с отступом (isReply=true)', () => {
    const parent = makeComment('1')
    const reply = { ...makeComment('r1', '1'), content: 'Odgovor 1' }
    parent.replies = [reply]
    const { container } = render(<CommentsList comments={[parent]} />)
    const articles = container.querySelectorAll('article')
    // Первый article — родительский (без ml-10), второй — ответ (с ml-10)
    expect(articles[0].className).not.toContain('ml-10')
    expect(articles[1].className).toContain('ml-10')
  })

  it('не рендерит empty state если есть комментарии', () => {
    render(<CommentsList comments={[makeComment('1')]} />)
    expect(screen.queryByText('Še ni komentarjev. Bodite prvi!')).not.toBeInTheDocument()
  })
})
