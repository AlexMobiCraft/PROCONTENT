import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}))

import { OnboardingScreen } from '@/features/onboarding/components/OnboardingScreen'
import { ONBOARDING_CONFIG } from '@/features/onboarding/data/onboarding-config'

const defaultProps = {
  posts: ONBOARDING_CONFIG.topPosts,
  whatsappUrl: 'https://chat.whatsapp.com/test',
}

describe('OnboardingScreen', () => {
  it('рендерит приветственный заголовок', () => {
    render(<OnboardingScreen {...defaultProps} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Привет, ты теперь часть PROCONTENT!'
    )
  })

  it('рендерит подзаголовок', () => {
    render(<OnboardingScreen {...defaultProps} />)
    expect(
      screen.getByText('Мы рады, что ты здесь. Вот с чего начать:')
    ).toBeInTheDocument()
  })

  it('рендерит ссылку WhatsApp с корректным href и атрибутами безопасности', () => {
    render(<OnboardingScreen {...defaultProps} />)
    const link = screen.getByRole('link', { name: /Вступить в WhatsApp-группу/i })
    expect(link).toHaveAttribute('href', 'https://chat.whatsapp.com/test')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('рендерит список из 5 карточек постов', () => {
    render(<OnboardingScreen {...defaultProps} />)
    const postLinks = screen.getAllByRole('link', { name: /Перейти к посту:/i })
    expect(postLinks).toHaveLength(5)
  })

  it('рендерит заголовок секции "Начни здесь"', () => {
    render(<OnboardingScreen {...defaultProps} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Начни здесь')
  })

  it('рендерит кнопку перехода в ленту', () => {
    render(<OnboardingScreen {...defaultProps} />)
    const feedLink = screen.getByRole('link', { name: /Перейти к ленте/i })
    expect(feedLink).toHaveAttribute('href', '/feed')
  })

  it('использует переданный whatsappUrl', () => {
    render(<OnboardingScreen {...defaultProps} whatsappUrl="https://chat.whatsapp.com/custom" />)
    expect(screen.getByRole('link', { name: /Вступить в WhatsApp-группу/i })).toHaveAttribute(
      'href',
      'https://chat.whatsapp.com/custom'
    )
  })
})
