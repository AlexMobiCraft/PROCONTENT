import Link from 'next/link'
import { Check } from 'lucide-react'

const features = [
  'Полный доступ к базе знаний (2+ года контента)',
  'Еженедельные разборы и лайв-сессии',
  'Чат комьюнити в WhatsApp',
  'Оффлайн-встречи в Словении',
  'Шаблоны, чек-листы и скрипты',
  'Ответы автора в комментариях',
]

export function PricingSection() {
  return (
    <section id="pricing" className="bg-muted/40 px-5 py-16">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-2">
          <p className="text-xs font-medium tracking-[0.3em] uppercase text-primary">
            Вступление
          </p>
          <h2 className="font-serif text-foreground text-balance text-[clamp(2rem,8vw,3.5rem)] font-light leading-none uppercase">
            Всё включено
          </h2>
          <p className="text-xs tracking-[0.1em] uppercase leading-relaxed text-muted-foreground">
            Никаких скрытых платежей. Отменить можно в любой момент.
          </p>
        </div>

        {/* Two plan cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Plan 1 — Monthly */}
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-col gap-1">
              <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground">
                Ежемесячно
              </p>
              <span className="font-serif text-5xl font-light leading-none text-foreground">
                €12,99
              </span>
              <p className="text-xs tracking-[0.15em] uppercase text-muted-foreground">
                / месяц
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex min-h-[44px] w-full items-center justify-center border border-primary px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase text-foreground transition-colors hover:bg-primary/10"
            >
              Вступить
            </Link>
          </div>

          {/* Plan 2 — 3 months (highlighted) */}
          <div className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-card p-5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground">
                  3 месяца
                </p>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] tracking-wide uppercase text-primary">
                  Экономия €4,97
                </span>
              </div>
              <span className="font-serif text-5xl font-light leading-none text-foreground">
                €34
              </span>
              <p className="text-xs tracking-[0.15em] uppercase text-muted-foreground">
                / 3 месяца
              </p>
              <p className="text-[10px] text-muted-foreground">
                ≈ €11,33 в месяц
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex min-h-[44px] w-full items-center justify-center border border-primary bg-primary/5 px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase text-foreground transition-colors hover:bg-primary/15"
            >
              Выбрать
            </Link>
          </div>
        </div>

        {/* Features checklist — applies to both plans */}
        <div className="mt-6 border-t border-border pt-6">
          <ul className="flex flex-col gap-3" aria-label="Что входит в подписку">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden
                />
                <span className="text-sm text-foreground">{feature}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Безопасная оплата через Stripe · Отмена в 1 клик.
          </p>
        </div>
      </div>
    </section>
  )
}
