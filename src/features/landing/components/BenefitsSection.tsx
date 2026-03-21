import { BookOpen, Users, Zap, Archive } from 'lucide-react'

const benefits = [
  {
    icon: BookOpen,
    title: '2 leti baze znanja',
    description:
      'Stotine objav o snemanju, algoritmih in delu z blagovnimi znamkami — filtriraj po temi z enim dotikom.',
  },
  {
    icon: Users,
    title: 'Svoja skupnost',
    description:
      'WhatsApp pogovor, kjer lahko zastaviš "neumno" vprašanje in dobiš iskren odgovor brez obsojanja.',
  },
  {
    icon: Zap,
    title: 'Žive analize',
    description:
      'Analiza profilov, trendov in primerov vsak teden — da znanje takoj uporabiš.',
  },
  {
    icon: Archive,
    title: 'Srečanja v živo',
    description:
      'Mreženje in sodelovanje z drugimi ustvarjalkami vsebin v Sloveniji.',
  },
]

export function BenefitsSection() {
  return (
    <section className="bg-background px-5 py-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-10 flex flex-col gap-2">
          <p className="text-xs font-medium tracking-[0.3em] uppercase text-primary">
            Kaj je znotraj
          </p>
          <h2 className="font-serif text-foreground text-balance text-[clamp(2rem,8vw,3.5rem)] font-light leading-none uppercase">
            Vse za rast
          </h2>
        </div>

        <div className="flex flex-col gap-6">
          {benefits.map((benefit) => {
            const Icon = benefit.icon
            return (
              <div key={benefit.title} className="flex gap-4">
                <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="size-5 text-primary" aria-hidden />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-serif text-foreground text-xl font-light uppercase tracking-wide">
                    {benefit.title}
                  </h3>
                  <p className="text-xs tracking-[0.1em] uppercase leading-relaxed text-muted-foreground">
                    {benefit.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
