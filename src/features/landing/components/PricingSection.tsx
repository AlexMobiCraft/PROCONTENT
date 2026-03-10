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

const plans: Record<Plan, { label: string; price: string; per: string; sub?: string; badge?: string }> = {
  monthly: {
    label: 'Ежемесячно',
    price: '€12,99',
    per: '/ месяц',
  },
  quarterly: {
    label: '3 месяца',
    price: '€34,00',
    per: '/ 3 месяца',
    sub: '≈ €11,33 в месяц',
    badge: 'Экономия €4,97',
  },
}

export function PricingSection() {
  const [selected, setSelected] = useState<Plan>('quarterly')

  const active = plans[selected]

  return (
    <section id="pricing" className="px-5 py-16">
      <div className="mx-auto max-w-xl">

        {/* Section header — outside the card, like the reference */}
        <div className="mb-6 flex flex-col gap-1.5">
          <p className="text-xs font-medium tracking-[0.3em] uppercase text-primary">
            Вступление
          </p>
          <h2 className="font-serif text-foreground text-balance text-[clamp(2.2rem,9vw,4rem)] font-light leading-none uppercase">
            Всё включено
          </h2>
          <p className="mt-1 text-[11px] tracking-[0.15em] uppercase text-muted-foreground">
            Никаких скрытых платежей. Отменить можно в любой момент.
          </p>
        </div>

        {/* Single unified card — price, plan toggle, features, cta */}
        <div className="border border-border bg-card px-8 py-8 rounded-lg flex flex-col gap-6">

          {/* Price display — fixed height, no layout jump */}
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[clamp(2.8rem,10vw,4rem)] font-light leading-none text-foreground">
              {active.price}
            </span>
            <span className="text-xs tracking-[0.15em] uppercase text-muted-foreground">
              {active.per}
            </span>
          </div>

          {/* Plan toggle — two buttons with gap */}
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
                    'flex flex-col gap-0.5 border px-4 py-3 text-left transition-colors cursor-pointer',
                    isActive
                      ? 'border-primary'
                      : 'border-border hover:border-foreground/30',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground">
                      {plan.label}
                    </span>
                    {plan.badge && (
                      <span className="bg-primary/10 px-1.5 py-px text-[9px] tracking-wide uppercase text-primary">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <span className={['font-serif text-xl font-light leading-none', isActive ? 'text-foreground' : 'text-foreground/60'].join(' ')}>
                    {plan.price}
                  </span>
                  {plan.sub && (
                    <span className="text-[10px] text-muted-foreground mt-0.5">{plan.sub}</span>
                  )}
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
