import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}))

import OnboardingPage from '@/app/(app)/onboarding/page'

describe('OnboardingPage (Server Component)', () => {
  it('рендерит OnboardingScreen с данными из конфигурации', async () => {
    const jsx = await OnboardingPage({ searchParams: Promise.resolve({}) })
    render(jsx)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Привет, ты теперь часть PROCONTENT!'
    )
  })

  it('рендерит все 5 постов из ONBOARDING_CONFIG', async () => {
    const jsx = await OnboardingPage({ searchParams: Promise.resolve({}) })
    render(jsx)
    const postLinks = screen.getAllByRole('link', { name: /Перейти к посту:/i })
    expect(postLinks).toHaveLength(5)
  })

  it('логирует session_id если передан в searchParams', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const jsx = await OnboardingPage({
      searchParams: Promise.resolve({ session_id: 'cs_test_abc123' }),
    })
    render(jsx)
    expect(consoleSpy).toHaveBeenCalledWith('[onboarding] session_id:', 'cs_test_abc123')
    consoleSpy.mockRestore()
  })

  it('не логирует если session_id не передан', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const jsx = await OnboardingPage({ searchParams: Promise.resolve({}) })
    render(jsx)
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('рендерит ссылку в WhatsApp-группу', async () => {
    const jsx = await OnboardingPage({ searchParams: Promise.resolve({}) })
    render(jsx)
    expect(
      screen.getByRole('link', { name: /Вступить в WhatsApp-группу/i })
    ).toBeInTheDocument()
  })
})
