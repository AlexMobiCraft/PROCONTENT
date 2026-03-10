import { Check } from 'lucide-react'
import Link from 'next/link'

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
    <section className="bg-muted/40 px-5 py-16" aria-label="Тарифы">
      <p className="font-sans text-xs tracking-[0.3em] uppercase text-primary mb-3">
        Вступление
      </p>
      <h2
        className="font-serif font-light uppercase leading-none text-foreground mb-2"
        style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)' }}
      >
        Всё включено
      </h2>
      <p className="font-sans text-xs tracking-[0.1em] uppercase text-muted-foreground mb-8 leading-relaxed">
        Никаких скрытых платежей. Отменить можно в любой момент.
      </p>

      {/* Pricing cards */}
      <div className="flex flex-col gap-4">
        {/* Monthly plan */}
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3">
          <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-muted-foreground">
            Ежемесячно
          </p>
          <div className="flex items-baseline gap-1">
            <span
              className="font-serif font-light leading-none text-foreground"
              style={{ fontSize: 'clamp(2.5rem, 10vw, 3rem)' }}
            >
              €12,99
            </span>
          </div>
          <p className="font-sans text-xs tracking-[0.15em] uppercase text-muted-foreground -mt-2">
            / месяц
          </p>
          <Link
            href="/login"
            className="border border-primary font-sans text-xs font-medium tracking-[0.2em] uppercase text-foreground px-8 py-3 min-h-[44px] flex items-center justify-center hover:bg-primary/10 transition-colors mt-2"
          >
            Вступить
          </Link>
        </div>

        {/* 3-month plan (highlighted) */}
        <div className="rounded-2xl border border-primary/30 bg-card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-muted-foreground">
              3 месяца
            </p>
            <span className="rounded-full bg-primary/10 text-primary font-sans text-[10px] px-2 py-0.5 uppercase tracking-wide">
              Экономия €4,97
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className="font-serif font-light leading-none text-foreground"
              style={{ fontSize: 'clamp(2.5rem, 10vw, 3rem)' }}
            >
              €34
            </span>
          </div>
          <div className="-mt-2">
            <p className="font-sans text-xs tracking-[0.15em] uppercase text-muted-foreground">
              / 3 месяца
            </p>
            <p className="font-sans text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
              ≈ €11,33 в месяц
            </p>
          </div>
          <Link
            href="/login"
            className="border border-primary font-sans text-xs font-medium tracking-[0.2em] uppercase text-foreground px-8 py-3 min-h-[44px] flex items-center justify-center hover:bg-primary/10 transition-colors mt-2 bg-primary/5"
          >
            Выбрать
          </Link>
        </div>
      </div>

      {/* Features list */}
      <div className="border-t border-border mt-6 pt-6">
        <ul className="flex flex-col gap-3">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <Check
                className="size-4 text-primary shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span className="font-sans text-xs tracking-[0.08em] uppercase text-muted-foreground leading-relaxed">
                {feature}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-center font-sans text-xs text-muted-foreground uppercase tracking-[0.08em] mt-6">
          Безопасная оплата через Stripe · Отмена в 1 клик.
        </p>
      </div>
    </section>
  )
}
