import Link from 'next/link'

export function CtaSection() {
  return (
    <section
      className="bg-foreground px-5 py-16 flex flex-col gap-8"
      aria-label="Призыв к действию"
    >
      <div className="flex flex-col gap-4">
        <p
          className="font-sans text-xs tracking-[0.3em] uppercase"
          style={{ color: 'oklch(0.75 0.1 35)' }}
        >
          Готова?
        </p>
        <h2
          className="font-serif text-primary-foreground font-light uppercase leading-none"
          style={{ fontSize: 'clamp(2.5rem, 10vw, 5rem)' }}
        >
          Твоё новое окружение
        </h2>
        <p className="font-sans text-primary-foreground/60 text-xs tracking-[0.15em] uppercase leading-relaxed max-w-xs">
          Присоединяйся к закрытому клубу создательниц контента и начни расти
          вместе.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Link
          href="/login"
          className="border border-primary font-sans text-xs font-medium tracking-[0.2em] uppercase text-primary-foreground px-8 py-3 min-h-[44px] flex items-center justify-center hover:bg-primary/20 transition-colors"
        >
          Вступить в клуб
        </Link>
        <Link
          href="/login"
          className="font-sans text-primary-foreground/40 text-xs uppercase tracking-[0.15em] underline underline-offset-4 hover:text-primary-foreground/70 transition-colors min-h-[44px] flex items-center justify-center"
        >
          Уже участница? Войти
        </Link>
      </div>
    </section>
  )
}
