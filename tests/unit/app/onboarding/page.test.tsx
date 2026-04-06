import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}))

vi.mock('@/features/onboarding/api/onboardingServer', () => ({
  getOnboardingPosts: vi.fn(async () => [
    { id: '1', title: 'Kako začeti ustvarjati UGC vsebino', category: '#insight', type: 'text' },
    { id: '2', title: 'Prva predstavitev blagovni znamki: vodnik po korakih', category: '#blagovne-znamke', type: 'text' },
    { id: '3', title: 'Snemanje Reelsov v 15 minutah', category: '#reels', type: 'video' },
    { id: '4', title: 'Analiza: kako delujejo algoritmi v 2026', category: '#analize', type: 'text' },
    { id: '5', title: 'Domači foto studio za €50', category: '#snemanje', type: 'photo' },
  ]),
}))

vi.mock('@/features/admin/api/settingsServer', () => ({
  getSettingsServer: vi.fn(async () => ({
    whatsapp_url: 'https://chat.whatsapp.com/test',
  })),
}))

import OnboardingPage from '@/app/(app)/onboarding/page'

describe('OnboardingPage (Server Component)', () => {
  it('рендерит OnboardingScreen с данными из конфигурации', async () => {
    const jsx = await OnboardingPage({ searchParams: Promise.resolve({}) })
    render(jsx)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Vesela sem, da si z nami'
    )
  })

  it('рендерит все 5 постов из БД', async () => {
    const jsx = await OnboardingPage({ searchParams: Promise.resolve({}) })
    render(jsx)
    const postLinks = screen.getAllByRole('link', { name: /Pojdi na objavo:/i })
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
      screen.getByRole('link', { name: /Pridruži se WhatsApp skupini/i })
    ).toBeInTheDocument()
  })

  it('WhatsApp ссылка использует url из БД', async () => {
    const jsx = await OnboardingPage({ searchParams: Promise.resolve({}) })
    render(jsx)
    const link = screen.getByRole('link', { name: /Pridruži se WhatsApp skupini/i })
    expect(link).toHaveAttribute('href', 'https://chat.whatsapp.com/test')
  })
})
