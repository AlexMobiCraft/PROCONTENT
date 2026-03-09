'use client'

import Image from 'next/image'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function HeroSection() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-foreground">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src="/images/hero-bg.jpg"
          alt="Создательница контента за работой"
          fill
          className="object-cover opacity-60 mix-blend-luminosity"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/20 via-foreground/40 to-foreground/80" />
      </div>

      {/* Content */}
      <div className="relative flex min-h-[100svh] flex-col justify-between px-5 pb-10 pt-14">
        {/* Logo */}
        <div>
          <span className="font-heading text-sm font-semibold tracking-[0.2em] text-primary-foreground/80 uppercase">
            PROCONTENT
          </span>
        </div>

        {/* Main text */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium tracking-[0.3em] uppercase" style={{ color: 'oklch(0.75 0.1 35)' }}>
              Закрытый клуб
            </p>
            <h1 className="font-serif text-primary-foreground text-balance text-[clamp(3rem,12vw,6rem)] font-light leading-none tracking-tight uppercase">
              PRO<br />CONTENT
            </h1>
            <p className="text-primary-foreground/70 text-sm tracking-[0.15em] uppercase leading-relaxed max-w-xs">
              База знаний, живое комьюнити и оффлайн-встречи для создательниц контента в Словении.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="#pricing"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'w-full sm:w-auto bg-primary text-primary-foreground text-base font-medium hover:bg-primary/90'
              )}
            >
              Вступить в клуб
            </Link>
            <Link
              href="#preview"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'lg' }),
                'w-full sm:w-auto text-primary-foreground/70 hover:text-primary-foreground hover:bg-white/10'
              )}
            >
              Посмотреть превью
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
