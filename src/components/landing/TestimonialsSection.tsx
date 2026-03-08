const testimonials = [
  {
    id: '1',
    name: 'Маша К.',
    handle: '@masha.creates',
    role: 'UGC-криэйтор',
    text: 'За 3 месяца в клубе подписала контракты с 4 брендами. База знаний — это моя тайная суперсила.',
    badge: 'Опытная',
  },
  {
    id: '2',
    name: 'Аня Р.',
    handle: '@anya.reels',
    role: 'Начинающий контент-мейкер',
    text: 'Наконец-то нашла место, где можно задать вопрос без страха быть осуждённой. Комьюнити — огонь!',
    badge: 'Участница',
  },
  {
    id: '3',
    name: 'Лена В.',
    handle: '@lena.brand',
    role: 'Владелица малого бизнеса',
    text: 'Научилась снимать контент для своего кафе сама. Теперь не трачу деньги на SMM-агентство.',
    badge: 'Участница',
  },
]

export function TestimonialsSection() {
  return (
    <section className="bg-background px-5 py-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex flex-col gap-2">
          <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
            Отзывы
          </p>
          <h2 className="font-heading text-foreground text-balance text-2xl font-semibold leading-snug">
            Что говорят участницы
          </h2>
        </div>

        <div className="flex flex-col gap-4">
          {testimonials.map((t) => (
            <blockquote
              key={t.id}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex flex-col gap-4">
                <p className="text-foreground text-sm leading-relaxed">
                  {'"'}{t.text}{'"'}
                </p>
                <footer className="flex items-center gap-3">
                  {/* Avatar placeholder with initials */}
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary"
                    aria-hidden
                  >
                    {t.name.charAt(0)}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {t.name}
                      </span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {t.badge}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
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
