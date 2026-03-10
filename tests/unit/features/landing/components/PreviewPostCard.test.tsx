import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PreviewPostCard } from '@/features/landing/components/PreviewPostCard'

const baseProps = {
  category: '#insight',
  title: 'Заголовок тестового поста',
  excerpt: 'Краткое описание тестового поста для проверки рендера',
  date: '1 мар',
  likes: 42,
  comments: 7,
  isLocked: false,
}

describe('PreviewPostCard', () => {
  it('рендерит категорию, заголовок, дату и excerpt', () => {
    render(<PreviewPostCard {...baseProps} />)

    expect(screen.getByText('#insight')).toBeInTheDocument()
    expect(screen.getByText('Заголовок тестового поста')).toBeInTheDocument()
    expect(screen.getByText('1 мар')).toBeInTheDocument()
    expect(
      screen.getByText('Краткое описание тестового поста для проверки рендера')
    ).toBeInTheDocument()
  })

  it('рендерит количество лайков и комментариев', () => {
    render(<PreviewPostCard {...baseProps} />)

    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('кнопки лайков и комментариев имеют корректные aria-label', () => {
    render(<PreviewPostCard {...baseProps} />)

    expect(screen.getByRole('button', { name: '42 лайков' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '7 комментариев' })).toBeInTheDocument()
  })

  it('кнопки имеют touch target min-h-[44px]', () => {
    render(<PreviewPostCard {...baseProps} />)

    const likesBtn = screen.getByRole('button', { name: '42 лайков' })
    const commentsBtn = screen.getByRole('button', { name: '7 комментариев' })

    expect(likesBtn.className).toContain('min-h-[44px]')
    expect(commentsBtn.className).toContain('min-h-[44px]')
  })

  it('НЕ показывает замок и бейдж "Для участниц" когда isLocked=false', () => {
    render(<PreviewPostCard {...baseProps} isLocked={false} />)

    expect(screen.queryByText('Для участниц')).not.toBeInTheDocument()
  })

  it('показывает бейдж "Для участниц" когда isLocked=true', () => {
    render(<PreviewPostCard {...baseProps} isLocked={true} />)

    expect(screen.getByText('Для участниц')).toBeInTheDocument()
  })

  it('рендерится как article элемент', () => {
    render(<PreviewPostCard {...baseProps} />)

    expect(screen.getByRole('article')).toBeInTheDocument()
  })
})
