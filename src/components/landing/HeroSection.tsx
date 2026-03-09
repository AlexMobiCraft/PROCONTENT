'use client'

import Image from 'next/image'
import Link from 'next/link'

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
        <div className="mx-auto w-full max-w-xl">
          <span className="font-sans text-sm font-semibold tracking-[0.2em] text-primary-foreground/80 uppercase">
            PROCONTENT
          </span>
        </div>

        {/* Main text */}
        <div className="mx-auto w-full max-w-xl flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-sans font-medium tracking-[0.3em] uppercase" style={{ color: 'oklch(0.75 0.1 35)' }}>
              Закрытый клуб
            </p>
            <h1 className="font-serif text-primary-foreground text-balance text-[clamp(3rem,12vw,6rem)] font-light leading-none tracking-tight uppercase">
              PRO<br />CONTENT
            </h1>
            <p className="text-primary-foreground/70 font-sans text-xs tracking-[0.15em] uppercase leading-relaxed max-w-xs">
              База знаний, живое комьюнити и оффлайн-встречи для создательниц контента в Словении.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Primary CTA — тонкая рамка в цвете акцента */}
            <Link
              href="#pricing"
              className="inline-flex items-center justify-center border border-primary px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase text-primary-foreground transition-colors hover:bg-primary/20 sm:w-auto w-full"
            >
              Вступить в клуб
            </Link>
            {/* Secondary CTA — полупрозрачная рамка */}
            <Link
              href="#preview"
              className="inline-flex items-center justify-center border border-primary-foreground/30 px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase text-primary-foreground/60 transition-colors hover:border-primary-foreground/60 hover:text-primary-foreground sm:w-auto w-full"
            >
              Посмотреть превью
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
