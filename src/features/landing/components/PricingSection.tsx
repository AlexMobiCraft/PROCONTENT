'use client'

import { useState } from 'react'
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

type Plan = 'monthly' | 'quarterly'

const plans: Record<Plan, { label: string; integer: string; cents: string; per: string; sub?: string; badge?: string }> = {
  monthly: {
    label: 'Ежемесячно',
    integer: '€12',
    cents: ',99',
    per: '/ месяц',
  },
  quarterly: {
    label: '3 месяца',
    integer: '€34',
    cents: ',00',
    per: '/ 3 месяца',
    sub: '≈ €11,33 / мес.',
    badge: 'Экономия €4,97',
  },
}

// Renders a price with consistent sizing: large integer, small superscript cents
function PriceDisplay({
  integer,
  cents,
  integerClass,
  centsClass,
}: {
  integer: string
  cents: string
  integerClass: string
  centsClass: string
}) {
  return (
    <span className={integerClass}>
      {integer}
      <span className={centsClass}>{cents}</span>
    </span>
  )
}

export function PricingSection() {
  const [selected, setSelected] = useState<Plan>('quarterly')
  const active = plans[selected]

  return (
    <section id="pricing" className="px-4 py-16 sm:px-5">
      <div className="mx-auto max-w-xl">

        {/* Section header */}
        <div className="mb-6 flex flex-col gap-1.5">
          <p className="text-xs font-medium tracking-[0.3em] uppercase text-primary">
            Вступление
          </p>
          <h2 className="font-serif text-foreground text-balance text-5xl sm:text-6xl font-light leading-none uppercase">
            Всё включено
          </h2>
          <p className="mt-1 text-[11px] tracking-[0.15em] uppercase text-muted-foreground">
            Никаких скрытых платежей. Отменить можно в любой момент.
          </p>
        </div>

        {/* Unified card */}
        <div className="rounded-lg border border-border bg-card px-5 py-6 sm:px-8 sm:py-8 flex flex-col gap-5">

          {/* Price — fixed font sizes, no clamp, no layout shift */}
          <div className="flex items-baseline gap-2">
            <PriceDisplay
              integer={active.integer}
              cents={active.cents}
              integerClass="font-serif text-5xl font-light leading-none text-foreground"
              centsClass="text-2xl align-super leading-none"
            />
            <span className="text-xs tracking-[0.15em] uppercase text-muted-foreground">
              {active.per}
            </span>
          </div>

          {/* Plan toggle */}
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(plans) as [Plan, typeof plans[Plan]][]).map(([key, plan]) => {
              const isActive = selected === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  aria-pressed={isActive}
                  className={[
                    'flex flex-col gap-1 border px-3 py-3 text-left transition-colors cursor-pointer',
                    isActive ? 'border-primary' : 'border-border hover:border-foreground/30',
                  ].join(' ')}
                >
                  <span className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground leading-none">
                    {plan.label}
                  </span>
                  <PriceDisplay
                    integer={plan.integer}
                    cents={plan.cents}
                    integerClass={[
                      'font-serif text-2xl font-light leading-none',
                      isActive ? 'text-foreground' : 'text-foreground/60',
                    ].join(' ')}
                    centsClass="text-sm align-super leading-none"
                  />
                  {/* Sub-label and badge always reserve space to avoid height jump */}
                  <span className="text-[10px] text-primary leading-none min-h-[12px]">
                    {plan.badge ?? ''}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-none min-h-[12px]">
                    {plan.sub ?? ''}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Features */}
          <ul className="flex flex-col gap-3" aria-label="Что входит в подписку">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span className="text-sm text-foreground">{feature}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/login"
              className="inline-flex min-h-[48px] w-full items-center justify-center border border-primary bg-transparent px-8 font-sans text-xs font-medium tracking-[0.2em] uppercase text-foreground transition-colors hover:bg-primary/10"
            >
              Вступить сейчас
            </Link>
            <p className="text-[11px] text-muted-foreground text-center">
              Безопасная оплата через Stripe · Отмена в 1 клик.
            </p>
          </div>

        </div>
      </div>
    </section>
  )
}
