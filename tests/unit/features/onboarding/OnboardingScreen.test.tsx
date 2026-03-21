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
      'Pozdravljena, zdaj si del PROCONTENT!'
    )
  })

  it('рендерит подзаголовок', () => {
    render(<OnboardingScreen {...defaultProps} />)
    expect(
      screen.getByText('Veseli nas, da si tu. Tukaj je, od kje začeti:')
    ).toBeInTheDocument()
  })

  it('рендерит ссылку WhatsApp с корректным href и атрибутами безопасности', () => {
    render(<OnboardingScreen {...defaultProps} />)
    const link = screen.getByRole('link', { name: /Pridruži se WhatsApp skupini/i })
    expect(link).toHaveAttribute('href', 'https://chat.whatsapp.com/test')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('рендерит список из 5 карточек постов', () => {
    render(<OnboardingScreen {...defaultProps} />)
    const postLinks = screen.getAllByRole('link', { name: /Pojdi na objavo:/i })
    expect(postLinks).toHaveLength(5)
  })

  it('рендерит заголовок секции "Начни здесь"', () => {
    render(<OnboardingScreen {...defaultProps} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Začni tukaj')
  })

  it('рендерит кнопку перехода в ленту', () => {
    render(<OnboardingScreen {...defaultProps} />)
    const feedLink = screen.getByRole('link', { name: /Pojdi na feed/i })
    expect(feedLink).toHaveAttribute('href', '/feed')
  })

  it('использует переданный whatsappUrl', () => {
    render(<OnboardingScreen {...defaultProps} whatsappUrl="https://chat.whatsapp.com/custom" />)
    expect(screen.getByRole('link', { name: /Pridruži se WhatsApp skupini/i })).toHaveAttribute(
      'href',
      'https://chat.whatsapp.com/custom'
    )
  })
})
