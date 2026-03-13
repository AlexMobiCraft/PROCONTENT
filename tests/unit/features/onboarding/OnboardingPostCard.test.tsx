import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}))

import { OnboardingPostCard } from '@/features/onboarding/components/OnboardingPostCard'

describe('OnboardingPostCard', () => {
  const defaultProps = {
    id: '1',
    title: 'Как начать создавать UGC-контент',
    category: '#insight',
    type: 'text' as const,
  }

  it('рендерит заголовок поста', () => {
    render(<OnboardingPostCard {...defaultProps} />)
    expect(screen.getByText('Как начать создавать UGC-контент')).toBeInTheDocument()
  })

  it('рендерит бейдж категории', () => {
    render(<OnboardingPostCard {...defaultProps} />)
    expect(screen.getByText('#insight')).toBeInTheDocument()
  })

  it('рендерит бейдж типа: Текст', () => {
    render(<OnboardingPostCard {...defaultProps} type="text" />)
    expect(screen.getByText('Текст')).toBeInTheDocument()
  })

  it('рендерит бейдж типа: Видео', () => {
    render(<OnboardingPostCard {...defaultProps} type="video" />)
    expect(screen.getByText('Видео')).toBeInTheDocument()
  })

  it('рендерит бейдж типа: Фото', () => {
    render(<OnboardingPostCard {...defaultProps} type="photo" />)
    expect(screen.getByText('Фото')).toBeInTheDocument()
  })

  it('ссылка содержит aria-label с заголовком поста', () => {
    render(<OnboardingPostCard {...defaultProps} />)
    expect(
      screen.getByRole('link', { name: /Перейти к посту: Как начать создавать UGC-контент/ })
    ).toBeInTheDocument()
  })

  it('ссылка ведёт на /feed (MVP)', () => {
    render(<OnboardingPostCard {...defaultProps} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/feed')
  })

  it('touch target — ссылка имеет класс min-h-[44px]', () => {
    render(<OnboardingPostCard {...defaultProps} />)
    expect(screen.getByRole('link')).toHaveClass('min-h-[44px]')
  })
})
