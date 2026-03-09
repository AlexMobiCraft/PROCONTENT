'use client'

import Link from 'next/link'

export function PricingSection() {
  return (
    <section id="pricing" className="bg-muted/40 px-5 py-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex flex-col gap-2">
          <p className="text-xs font-medium tracking-[0.3em] text-primary uppercase">
            Вступление
          </p>
          <h2 className="font-serif text-foreground text-balance text-[clamp(2rem,8vw,3.5rem)] font-light leading-none uppercase">
            Всё включено
          </h2>
          <p className="text-muted-foreground text-xs tracking-[0.1em] uppercase leading-relaxed">
            Никаких скрытых платежей. Отменить можно в любой момент.
          </p>
        </div>

        {/* Pricing card */}
        <div className="rounded-2xl border border-primary/20 bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-6">
            {/* Price */}
            <div className="flex flex-col gap-1">
              <div className="flex items-end gap-2">
                <span className="font-serif text-foreground text-5xl font-light tracking-tight">
                  €29
                </span>
                <span className="mb-1.5 text-xs tracking-[0.15em] uppercase text-muted-foreground">
                  / месяц
                </span>
              </div>
              <p className="text-xs tracking-[0.1em] uppercase text-muted-foreground">
                Или €290/год — 2 месяца бесплатно
              </p>
            </div>

            {/* Features */}
            <ul className="flex flex-col gap-3" aria-label="Что входит в подписку">
              {[
                'Полный доступ к базе знаний (2+ года контента)',
                'Еженедельные разборы и лайв-сессии',
                'Чат комьюнити в WhatsApp',
                'Оффлайн-встречи в Словении',
                'Шаблоны, чек-листы и скрипты',
                'Ответы автора в комментариях',
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <svg
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                  <span className="text-sm text-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="flex flex-col gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center border border-primary px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase text-foreground transition-colors hover:bg-primary/10 w-full sm:w-auto sm:self-center"
              >
                Вступить сейчас
              </Link>
              <p className="text-center text-xs text-muted-foreground">
                Безопасная оплата через Stripe. Отмена в 1 клик.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
