const testimonials = [
  {
    quote:
      'За 3 месяца в клубе подписала контракты с 4 брендами. База знаний — это моя тайная суперсила.',
    avatar: 'М',
    name: 'Маша К.',
    badge: 'Опытная',
    role: 'UGC-криэйтор',
  },
  {
    quote:
      'Наконец-то нашла место, где можно задать вопрос без страха быть осуждённой. Комьюнити — огонь!',
    avatar: 'А',
    name: 'Аня Р.',
    badge: 'Участница',
    role: 'Начинающий контент-мейкер',
  },
  {
    quote:
      'Научилась снимать контент для своего кафе сама. Теперь не трачу деньги на SMM-агентство.',
    avatar: 'Л',
    name: 'Лена В.',
    badge: 'Участница',
    role: 'Владелица малого бизнеса',
  },
]

export function TestimonialsSection() {
  return (
    <section className="bg-background px-5 py-16" aria-label="Отзывы">
      <p className="font-sans text-xs tracking-[0.3em] uppercase text-primary mb-3">
        Отзывы
      </p>
      <h2
        className="font-serif font-light uppercase leading-none text-foreground mb-10"
        style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)' }}
      >
        Что говорят
      </h2>

      <ul className="flex flex-col gap-4">
        {testimonials.map((t) => (
          <li key={t.name}>
            <blockquote className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-4">
              <p className="font-serif text-foreground text-lg font-light leading-snug italic">
                &ldquo;{t.quote}&rdquo;
              </p>
              <footer className="flex items-center gap-3">
                <div
                  className="rounded-full bg-primary/20 size-9 flex items-center justify-center text-xs font-semibold text-primary shrink-0"
                  aria-hidden="true"
                >
                  {t.avatar}
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <cite className="not-italic text-xs font-medium tracking-[0.15em] uppercase text-foreground">
                      {t.name}
                    </cite>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs uppercase tracking-wide text-primary">
                      {t.badge}
                    </span>
                  </div>
                  <p className="text-xs tracking-[0.1em] uppercase text-muted-foreground">
                    {t.role}
                  </p>
                </div>
              </footer>
            </blockquote>
          </li>
        ))}
      </ul>
    </section>
  )
}
