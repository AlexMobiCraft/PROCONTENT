'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// timeZone: 'UTC' гарантирует одинаковый вывод на сервере и клиенте — нет hydration mismatch
function formatPeriodEnd(currentPeriodEnd: string | null): string | null {
  if (!currentPeriodEnd) return null
  const date = new Date(currentPeriodEnd)
  if (isNaN(date.getTime())) return currentPeriodEnd
  return date.toLocaleDateString('sl-SI', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// periodEndDisplay — уже отформатированная строка (или null)
function getStatusLabel(
  status: string | null,
  periodEndDisplay: string | null
): { label: string; active: boolean } {
  if (status === 'active' || status === 'trialing') {
    return {
      label: periodEndDisplay ? `Aktivna do ${periodEndDisplay}` : 'Aktivna',
      active: true,
    }
  }
  if (status === 'canceled') return { label: 'Preklicana', active: false }
  if (status === 'past_due') return { label: 'Zahteva plačilo', active: false }
  if (status === 'unpaid') return { label: 'Neplačana', active: false }
  if (status === 'paused') return { label: 'Začasno prekinjena', active: false }
  if (status === 'incomplete' || status === 'incomplete_expired')
    return { label: 'Ni dokončana', active: false }
  return { label: 'Ni aktivne naročnine', active: false }
}

interface SubscriptionCardProps {
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  hasStripeCustomer: boolean
}

export function SubscriptionCard({
  subscriptionStatus,
  currentPeriodEnd,
  hasStripeCustomer,
}: SubscriptionCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // BFCache fix: если пользователь нажал "Назад" и страница загружена из BFCache,
  // isLoading может остаться true (кнопка заблокирована). Сбрасываем при восстановлении.
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        setIsLoading(false)
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])
  // Форматируем синхронно — timeZone: 'UTC' устраняет расхождение сервер/клиент без useEffect.
  // suppressHydrationWarning на элементе — дополнительная защита от layout shift.
  const periodEndDisplay = formatPeriodEnd(currentPeriodEnd)

  async function handleManageSubscription() {
    setIsLoading(true)
    setError(null)
    try {
      // Передаём клиентский origin, чтобы return_url корректно формировался за reverse proxy
      const returnUrl = window.location.origin + '/profile'
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl }),
      })
      const data = (await response.json()) as { url?: string; error?: string }

      if (!response.ok || !data.url) {
        if (response.status === 429 && data.error) {
          setError(data.error)
        } else {
          setError('Portala za upravljanje naročnine ni bilo mogoče odpreti')
        }
        setIsLoading(false)
        return
      }

      // isLoading остаётся true — кнопка заблокирована до завершения навигации браузером
      window.location.href = data.url
    } catch (err) {
      console.error('[SubscriptionCard] Ошибка запроса к /api/stripe/portal:', err)
      setError('Napaka povezave')
      setIsLoading(false)
    }
  }

  const { label, active } = getStatusLabel(subscriptionStatus, periodEndDisplay)

  return (
    <div className="border-border space-y-4 border p-6">
      <div>
        <p className="text-muted-foreground mb-1 text-xs tracking-[0.15em] uppercase">
          Naročnina
        </p>
        <p
          className={cn(
            'font-medium',
            active ? 'text-foreground' : 'text-muted-foreground'
          )}
          suppressHydrationWarning
        >
          {label}
        </p>
      </div>

      {hasStripeCustomer && (
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManageSubscription}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? 'Nalaganje…' : 'Upravljanje naročnine'}
          </Button>
          {error && (
            <p className="text-destructive text-xs" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
