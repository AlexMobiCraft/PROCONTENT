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
    price: '€34',
    per: '/ 3 месяца',
    sub: '≈ €11,33 в месяц',
    badge: 'Экономия €4,97',
  },
}

export function PricingSection() {
  const [selected, setSelected] = useState<Plan>('quarterly')

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
                  'flex flex-col gap-3 border p-5 text-left transition-colors cursor-pointer',
                  isActive
                    ? 'border-primary bg-card'
                    : 'border-border bg-card hover:border-foreground/30',
                ].join(' ')}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground">
                      {plan.label}
                    </p>
                    {plan.badge && (
                      <span className="bg-primary/10 px-2 py-0.5 text-[10px] tracking-wide uppercase text-primary">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={[
                      'font-serif text-4xl font-light leading-none',
                      isActive ? 'text-foreground' : 'text-foreground/80',
                    ].join(' ')}
                  >
                    {plan.price}
                  </span>
                  <p className="text-[11px] tracking-[0.1em] uppercase text-muted-foreground">
                    {plan.per}
                  </p>
                  {plan.sub && (
                    <p className="text-[10px] text-muted-foreground">{plan.sub}</p>
                  )}
                </div>

                {/* Selection indicator */}
                <div
                  className={[
                    'mt-auto flex h-4 w-4 items-center justify-center border transition-colors',
                    isActive ? 'border-primary bg-primary' : 'border-border',
                  ].join(' ')}
                  aria-hidden
                >
                  {isActive && <span className="h-1.5 w-1.5 bg-background" />}
                </div>
              </button>
            )
          })}
        </div>

        {/* CTA button — changes based on selection */}
        <div className="mt-4">
          <Link
            href="/login"
            className="inline-flex min-h-[48px] w-full items-center justify-center border border-primary bg-primary/5 px-8 font-sans text-xs font-medium tracking-[0.2em] uppercase text-foreground transition-colors hover:bg-primary/15"
          >
            {selected === 'quarterly'
              ? 'Вступить за €34 / 3 месяца'
              : 'Вступить за €12,99 / месяц'}
          </Link>
        </div>

        {/* Features checklist — applies to both plans */}
        <div className="mt-6 border-t border-border pt-6">
          <ul className="flex flex-col gap-3" aria-label="Что входит в подписку">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
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
