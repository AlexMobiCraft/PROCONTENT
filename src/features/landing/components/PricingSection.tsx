'use client'

import { useRef, useState } from 'react'
import { Check } from 'lucide-react'

const features = [
  'Popoln dostop do baze znanja (2+ leti vsebine)',
  'Tedenske analize in žive seje',
  'WhatsApp skupnostni klepet',
  'Srečanja v živo v Sloveniji',
  'Predloge, kontrolni seznami in skripte',
  'Odgovori avtorice v komentarjih',
]

type Plan = 'monthly' | 'quarterly'

const plans: Record<Plan, { label: string; price: string; per: string; sub?: string; badge?: string }> = {
  monthly: {
    label: 'Mesečno',
    price: '€12,99',
    per: '/ mesec',
  },
  quarterly: {
    label: '3 mesece',
    price: '€34,00',
    per: '/ 3 mesece',
    sub: '≈ €11,33 / mes.',
    badge: 'Prihranek €4,97',
  },
}

interface PricingSectionProps {
  onCheckout: (plan: 'monthly' | 'quarterly') => void
  isLoading: boolean
}

export function PricingSection({ onCheckout, isLoading }: PricingSectionProps) {
  const [selected, setSelected] = useState<Plan>('quarterly')
  const active = plans[selected]
  const planKeys = Object.keys(plans) as Plan[]
  const buttonRefs = useRef<Partial<Record<Plan, HTMLButtonElement | null>>>({})

  const handleRadioKeyDown = (e: React.KeyboardEvent, key: Plan) => {
    const currentIndex = planKeys.indexOf(key)
    let nextIndex: number | null = null

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      nextIndex = (currentIndex + 1) % planKeys.length
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      nextIndex = (currentIndex - 1 + planKeys.length) % planKeys.length
    }

    if (nextIndex !== null) {
      const nextKey = planKeys[nextIndex]
      setSelected(nextKey)
      buttonRefs.current[nextKey]?.focus()
    }
  }

  return (
    <section id="pricing" className="px-4 py-16 sm:px-5">
      <div className="mx-auto max-w-xl">

        {/* Section header */}
        <div className="mb-6 flex flex-col gap-1.5">
          <p className="text-xs font-medium tracking-[0.3em] uppercase text-primary">
            Včlanitev
          </p>
          <h2 className="font-serif text-foreground text-balance text-5xl sm:text-6xl font-light leading-none uppercase">
            Vse vključeno
          </h2>
          <p className="mt-1 text-[11px] tracking-[0.15em] uppercase text-muted-foreground">
            Brez skritih plačil. Odpoved kadar koli.
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
          <div role="radiogroup" aria-label="Izberite paket" className="grid grid-cols-2 gap-3">
            {(Object.entries(plans) as [Plan, typeof plans[Plan]][]).map(([key, plan]) => {
              const isActive = selected === key
              return (
                <button
                  key={key}
                  ref={(el) => { buttonRefs.current[key] = el }}
                  type="button"
                  role="radio"
                  onClick={() => setSelected(key)}
                  onKeyDown={(e) => handleRadioKeyDown(e, key)}
                  tabIndex={isActive ? 0 : -1}
                  aria-checked={isActive}
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
          <ul className="flex flex-col gap-3" aria-label="Kaj je vključeno v naročnino">
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
              {isLoading ? (
                <span className="animate-pulse">Nalaganje...</span>
              ) : (
                'Pridruži se zdaj'
              )}
            </button>
            <p className="text-[11px] text-muted-foreground text-center">
              Varno plačilo prek Stripe · Odpoved z 1 klikom.
            </p>
          </div>

        </div>
      </div>
    </section>
  )
}
