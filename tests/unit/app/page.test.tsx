import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Единственный рубильник акции — выражение isPromoActive в src/app/page.tsx.
// Без этого теста его можно инвертировать или опечатать в имени переменной,
// и вся сюита останется зелёной: акция либо не запустится, либо покажется
// с неработающим checkout.

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
  })),
}))

vi.mock('@/features/landing/api/publicPreview', () => ({
  getLandingPreviewPosts: vi.fn(async () => []),
}))

vi.mock('@/features/landing/components/HeroSection', () => ({
  HeroSection: () => null,
}))
vi.mock('@/features/landing/components/BenefitsSection', () => ({
  BenefitsSection: () => null,
}))
vi.mock('@/features/landing/components/PreviewPostsSection', () => ({
  PreviewPostsSection: () => null,
}))
vi.mock('@/features/landing/components/TestimonialsSection', () => ({
  TestimonialsSection: () => null,
}))
vi.mock('@/features/landing/components/CtaSection', () => ({
  CtaSection: () => null,
}))

// Зонд вместо реального компонента: наблюдаем именно значение пропа
vi.mock('@/features/landing/components/PricingCheckoutWrapper', () => ({
  PricingCheckoutWrapper: ({ isPromoActive }: { isPromoActive: boolean }) => (
    <div data-testid="pricing" data-promo={String(isPromoActive)} />
  ),
}))

import LandingPage from '@/app/page'

async function renderLanding() {
  render(await LandingPage())
  return screen.getByTestId('pricing')
}

describe('LandingPage — рубильник временного предложения', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.STRIPE_PROMO_PRICE_ID
  })

  it('включает promo, когда задан корректный Price ID', async () => {
    process.env.STRIPE_PROMO_PRICE_ID = 'price_1UAnWo06opmqEqpLtcIW4aqE'

    expect(await renderLanding()).toHaveAttribute('data-promo', 'true')
  })

  it('выключает promo, когда переменная не задана', async () => {
    expect(await renderLanding()).toHaveAttribute('data-promo', 'false')
  })

  it('не включает promo на плейсхолдере из .env.example', async () => {
    process.env.STRIPE_PROMO_PRICE_ID = 'price_...'

    expect(await renderLanding()).toHaveAttribute('data-promo', 'false')
  })

  it('не включает promo на пустой строке и пробелах', async () => {
    process.env.STRIPE_PROMO_PRICE_ID = '   '

    expect(await renderLanding()).toHaveAttribute('data-promo', 'false')
  })
})
