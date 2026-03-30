import Image from 'next/image'
import Link from 'next/link'

export function HeroSection() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-foreground">
      {/* Background image */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Image
          src="/images/hero-bg.png"
          alt="Ustvarjalka vsebine pri delu"
          width={1080}
          height={1920}
          className="opacity-60 mix-blend-luminosity"
          style={{ height: '100svh', width: 'auto' }}
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/20 via-foreground/40 to-foreground/80" />
      </div>

      {/* Content */}
      <div className="relative flex min-h-[100svh] items-center justify-center px-5 py-14">
        {/* Main text — центрирован по вертикали и горизонтали */}
        <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p
              className="font-sans text-[10px] font-medium tracking-[0.3em] uppercase"
              style={{ color: 'oklch(0.75 0.1 35)' }}
            >
              Zaprti klub
            </p>
            <h1 className="font-serif text-balance text-[clamp(3rem,12vw,6rem)] font-light leading-none tracking-tight uppercase text-primary-foreground">
              PRO
              <br />
              CONTENT
            </h1>
            <p className="max-w-xs font-sans text-xs tracking-[0.15em] uppercase leading-relaxed text-primary-foreground/70">
              Baza znanja, živa skupnost in srečanja v živo za ustvarjalke
              vsebin v Sloveniji.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="#pricing"
              className="inline-flex min-h-[44px] w-full items-center justify-center border border-primary px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase text-primary-foreground transition-colors hover:bg-primary/20 sm:w-auto"
            >
              Pridruži se klubu
            </Link>
            <Link
              href="#preview"
              className="inline-flex min-h-[44px] w-full items-center justify-center border border-primary-foreground/30 px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase text-primary-foreground/60 transition-colors hover:border-primary-foreground/60 hover:text-primary-foreground sm:w-auto"
            >
              Oglej si predogled
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[44px] w-full items-center justify-center border border-primary-foreground/20 px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase text-primary-foreground/50 transition-colors hover:border-primary-foreground/40 hover:text-primary-foreground/80 sm:w-auto"
            >
              Prijava
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
