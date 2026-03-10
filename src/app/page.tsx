import type { Metadata } from 'next'
import { HeroSection } from '@/features/landing/components/HeroSection'
import { BenefitsSection } from '@/features/landing/components/BenefitsSection'
import { PreviewPostsSection } from '@/features/landing/components/PreviewPostsSection'
import { TestimonialsSection } from '@/features/landing/components/TestimonialsSection'
import { PricingSection } from '@/features/landing/components/PricingSection'
import { CtaSection } from '@/features/landing/components/CtaSection'

export const metadata: Metadata = {
  title: 'PROCONTENT — Закрытое сообщество для создательниц контента',
  description:
    'Закрытый клуб для профессиональных создательниц контента в Словении. База знаний, живое комьюнити и оффлайн-встречи.',
}

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <BenefitsSection />
      <PreviewPostsSection />
      <TestimonialsSection />
      <PricingSection />
      <CtaSection />
    </main>
  )
}
