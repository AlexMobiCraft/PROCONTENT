const testimonials = [
  {
    id: '1',
    name: 'Maša K.',
    role: 'UGC-ustvarjalka',
    text: 'V 3 mesecih v klubu sem podpisala pogodbe s 4 blagovnimi znamkami. Baza znanja je moja skrivna supermoč.',
    badge: 'Izkušena',
  },
  {
    id: '2',
    name: 'Anja R.',
    role: 'Začetnica ustvarjanja vsebin',
    text: 'Končno sem našla kraj, kjer lahko zastavim vprašanje brez strahu pred obsojanjem. Skupnost je super!',
    badge: 'Članica',
  },
  {
    id: '3',
    name: 'Lena V.',
    role: 'Lastnica majhnega podjetja',
    text: 'Naučila sem se sama snemati vsebino za svojo kavarno. Zdaj ne trošim denarja za SMM agencijo.',
    badge: 'Članica',
  },
]

export function TestimonialsSection() {
  return (
    <section className="bg-background px-5 py-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex flex-col gap-2">
          <p className="text-xs font-medium tracking-[0.3em] uppercase text-primary">
            Mnenja
          </p>
          <h2 className="font-serif text-foreground text-balance text-[clamp(2rem,8vw,3.5rem)] font-light leading-none uppercase">
            Kaj pravijo
          </h2>
        </div>

        <div className="flex flex-col gap-4">
          {testimonials.map((t) => (
            <blockquote
              key={t.id}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex flex-col gap-4">
                <p className="font-serif text-lg font-light leading-snug italic text-foreground">
                  {'"'}
                  {t.text}
                  {'"'}
                </p>
                <footer className="flex items-center gap-3">
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary"
                    aria-hidden
                  >
                    {t.name.charAt(0)}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium tracking-[0.15em] uppercase text-foreground">
                        {t.name}
                      </span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium tracking-wide uppercase text-primary">
                        {t.badge}
                      </span>
                    </div>
                    <span className="text-xs tracking-[0.1em] uppercase text-muted-foreground">
                      {t.role}
                    </span>
                  </div>
                </footer>
              </div>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}
