import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { HeroSection } from '@/features/landing/components/HeroSection'
import { BenefitsSection } from '@/features/landing/components/BenefitsSection'
import { PreviewPostsSection } from '@/features/landing/components/PreviewPostsSection'
import { TestimonialsSection } from '@/features/landing/components/TestimonialsSection'
import { PricingCheckoutWrapper } from '@/features/landing/components/PricingCheckoutWrapper'
import { CtaSection } from '@/features/landing/components/CtaSection'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'PROCONTENT — Zaprta skupnost za ustvarjalke vsebin',
  description:
    'Zaprti klub za profesionalne ustvarjalke vsebin v Sloveniji. Baza znanja, živa skupnost in srečanja v živo.',
}

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing') {
      redirect('/feed')
    }
  }

  return (
    <main>
      <HeroSection />
      <BenefitsSection />
      <PreviewPostsSection />
      <TestimonialsSection />
      <PricingCheckoutWrapper />
      <CtaSection />
    </main>
  )
}
