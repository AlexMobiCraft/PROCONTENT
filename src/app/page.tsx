import type { Metadata } from 'next'
import { HeroSection } from '@/components/landing/HeroSection'
import { BenefitsSection } from '@/components/landing/BenefitsSection'
import { PreviewPostsSection } from '@/components/landing/PreviewPostsSection'
import { TestimonialsSection } from '@/components/landing/TestimonialsSection'
import { PricingSection } from '@/components/landing/PricingSection'
import { CtaSection } from '@/components/landing/CtaSection'

export const metadata: Metadata = {
  title: 'PROCONTENT — Закрытый клуб для создателей контента',
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
