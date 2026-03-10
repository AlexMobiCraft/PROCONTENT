import Link from 'next/link'

export function HeroSection() {
  return (
    <section
      className="min-h-[100svh] flex flex-col bg-foreground px-5 py-8 relative overflow-hidden"
      aria-label="Главная секция"
    >
      {/* Subtle texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, oklch(0.993 0.006 90) 2px, oklch(0.993 0.006 90) 3px)',
        }}
        aria-hidden="true"
      />

      {/* Logo */}
      <header className="relative z-10 flex items-center justify-between">
        <div>
          <p className="font-sans text-sm tracking-[0.2em] uppercase text-primary-foreground/80">
            PROCONTENT
          </p>
          <p
            className="text-[10px] tracking-[0.3em] uppercase mt-0.5"
            style={{ color: 'oklch(0.75 0.1 35)' }}
          >
            Закрытый клуб
          </p>
        </div>
        <Link
          href="/login"
          className="font-sans text-xs tracking-[0.2em] uppercase text-primary-foreground/50 hover:text-primary-foreground/80 transition-colors min-h-[44px] flex items-center"
        >
          Войти
        </Link>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col justify-center gap-8 mt-12">
        <div>
          <h1
            className="font-serif font-light uppercase leading-none text-primary-foreground"
            style={{ fontSize: 'clamp(3rem, 22vw, 6rem)' }}
          >
            PRO
            <br />
            CONTENT
          </h1>
          <p className="font-sans text-xs tracking-[0.15em] uppercase text-primary-foreground/70 mt-5 leading-relaxed max-w-xs">
            База знаний, живое комьюнити и оффлайн-встречи для создательниц
            контента в Словении.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col gap-3 max-w-xs">
          <Link
            href="/login"
            className="border border-primary font-sans text-xs font-medium tracking-[0.2em] uppercase text-primary-foreground px-8 py-3 min-h-[44px] flex items-center justify-center hover:bg-primary/20 transition-colors"
          >
            Вступить в клуб
          </Link>
          <a
            href="#preview"
            className="border border-primary-foreground/30 font-sans text-xs font-medium tracking-[0.2em] uppercase text-primary-foreground/60 px-8 py-3 min-h-[44px] flex items-center justify-center hover:bg-primary-foreground/5 transition-colors"
          >
            Посмотреть превью
          </a>
        </div>
      </main>

      {/* Scroll indicator */}
      <div
        className="relative z-10 flex justify-center pb-4"
        aria-hidden="true"
      >
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-px h-8 bg-primary-foreground/20" />
          <p className="font-sans text-[9px] tracking-[0.3em] uppercase text-primary-foreground/30">
            Scroll
          </p>
        </div>
      </div>
    </section>
  )
}
