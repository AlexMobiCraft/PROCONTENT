import Link from 'next/link'

export function CtaSection() {
  return (
    <section className="bg-foreground px-5 py-16">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-3">
          <p
            className="text-xs font-medium tracking-[0.3em] uppercase"
            style={{ color: 'oklch(0.75 0.1 35)' }}
          >
            Pripravljena?
          </p>
          <h2 className="font-serif text-primary-foreground text-balance text-[clamp(2.5rem,10vw,5rem)] font-light leading-none uppercase">
            Tvoje novo
            <br />
            okolje
          </h2>
          <p className="mx-auto max-w-xs text-xs tracking-[0.15em] uppercase leading-relaxed text-primary-foreground/60">
            Pridruži se zaprtemu klubu ustvarjalk vsebin in začni rasti skupaj.
          </p>
        </div>

        <Link
          href="#pricing"
          className="inline-flex min-h-[44px] items-center justify-center border border-primary px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase text-primary-foreground transition-colors hover:bg-primary/20"
        >
          Pridruži se klubu
        </Link>

        <p className="text-xs text-primary-foreground/40">
          Že članica?{' '}
          <Link
            href="/login"
            className="text-primary-foreground/60 underline underline-offset-4 hover:text-primary-foreground"
          >
            Prijava
          </Link>
        </p>
      </div>
    </section>
  )
}
