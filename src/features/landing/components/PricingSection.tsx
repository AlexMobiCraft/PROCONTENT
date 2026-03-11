'use client'

import { useState } from 'react'
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
    sub: '≈ €11,33 / мес.',
    badge: 'Экономия €4,97',
  },
}

interface PricingSectionProps {
  onCheckout: (plan: 'monthly' | 'quarterly') => void
  isLoading: boolean
  errorMessage?: string | null
}

export function PricingSection({ onCheckout, isLoading, errorMessage }: PricingSectionProps) {
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

          {/* Price — single string, fixed size, no superscript */}
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-5xl font-light leading-none text-foreground [font-variant-numeric:lining-nums_tabular-nums]">
              {active.price}
            </span>
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
                    'flex flex-col gap-1.5 border px-3 py-3 text-left transition-colors cursor-pointer',
                    isActive ? 'border-primary' : 'border-border hover:border-foreground/30',
                  ].join(' ')}
                >
                  {/* Period label */}
                  <span className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground leading-none">
                    {plan.label}
                  </span>
                  {/* Price */}
                  <span className={[
                    'font-serif text-lg font-light leading-none [font-variant-numeric:lining-nums_tabular-nums]',
                    isActive ? 'text-foreground' : 'text-foreground/60',
                  ].join(' ')}>
                    {plan.price}
                  </span>
                  {/* Sub + badge on same row, always reserve height */}
                  <span className="flex items-center gap-1.5 min-h-[14px]">
                    {plan.sub && (
                      <span className="text-[10px] text-muted-foreground leading-none">{plan.sub}</span>
                    )}
                    {plan.badge && (
                      <span className="text-[10px] text-primary leading-none">{plan.badge}</span>
                    )}
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
            <button
              type="button"
              onClick={() => onCheckout(selected)}
              disabled={isLoading}
              className="inline-flex min-h-[48px] w-full items-center justify-center border border-primary bg-transparent px-8 font-sans text-xs font-medium tracking-[0.2em] uppercase text-foreground transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Загрузка...' : 'Вступить сейчас'}
            </button>
            {errorMessage && (
              <p role="alert" className="text-[11px] text-destructive text-center">
                {errorMessage}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground text-center">
              Безопасная оплата через Stripe · Отмена в 1 клик.
            </p>
          </div>

        </div>
      </div>
    </section>
  )
}
