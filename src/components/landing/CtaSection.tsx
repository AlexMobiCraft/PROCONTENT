'use client'

import Link from 'next/link'

export function CtaSection() {
  return (
    <section className="bg-foreground px-5 py-16">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium tracking-[0.3em] uppercase" style={{ color: 'oklch(0.75 0.1 35)' }}>
            Готова?
          </p>
          <h2 className="font-serif text-primary-foreground text-balance text-[clamp(2.5rem,10vw,5rem)] font-light leading-none uppercase">
            Твоя стая ждёт
          </h2>
          <p className="text-primary-foreground/60 text-xs tracking-[0.15em] uppercase leading-relaxed max-w-xs mx-auto">
            Присоединяйся к закрытому клубу создательниц контента и начни расти вместе.
          </p>
        </div>

        <Link
          href="/login"
          className="inline-flex items-center justify-center border border-primary px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase text-primary-foreground transition-colors hover:bg-primary/20"
        >
          Вступить в клуб
        </Link>

        <p className="text-primary-foreground/40 text-xs">
          Уже участница?{' '}
          <Link
            href="/login"
            className="text-primary-foreground/60 underline underline-offset-4 hover:text-primary-foreground"
          >
            Войти
          </Link>
        </p>
      </div>
    </section>
  )
}
